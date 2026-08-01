import { worldDepthFromAnchorY } from "./buildWorldGeometry.js";
import { createDamageNumberPresentation } from "./damageNumberPresentation.js";
import { createActorNavigation, findGridPath } from "./gridPathfinder.js";
import {
  advanceMeleeCombat,
  applyTrainingDummyDamage,
  chooseHeavyReversalDirection,
  createAutoTargetSearchSnapshot,
  createMeleeCombatState,
  createMeleeGeometrySnapshot,
  currentMeleeStep,
  doesMeleeSnapshotIntersectRect,
  effectiveKnockbackDistance,
  isMeleeStepActive,
  knockbackEaseOut,
  meleeBodyCenter,
  meleeShapePoints,
  queryMeleeTargets,
  requestMeleeAttack,
  resolveAutoTargetDirection,
} from "./meleeDomain.js";
import {
  findTrainingDummyPoint,
  getMeleeWeaponProfile,
  MELEE_DEBUG_ENABLED,
  MELEE_SWING_DIRECTIONS,
  MELEE_TURN_MODES,
  TRAINING_DUMMY,
} from "./meleeConfig.js";
import { getFootBox, moveWithCollision } from "./movement.js";

const TRAIL_COLOR = 0xf4d57b;
const DEBUG_COLOR = 0x65e6ff;
const HELD_Y_OFFSET = 8;
export const HELD_WEAPON_SCALE = 0.5;
export const SWORD_SWING_VISUAL_SPEED_MULTIPLIER = 3;
export const SWORD_CAMERA_MAX_FOLLOW_SPEED = 90;
export const MELEE_HIT_SOUND_STAGGER_MS = 50;

export function createMeleeRuntime(scene, {
  worldLayout,
  includeTrainingDummy = true,
  getPlayerCharacter = () => scene.playerCharacter ?? null,
  getSelectedItem = () => null,
  getControllerMoveDirection = () => ({ x: 0, y: 0 }),
  isSuppressed = () => false,
  playEffect = () => {},
  damageLog = () => ({ status: "ignored", mutated: false }),
  canPerformPhysicalAction = () => ({ allowed: true, cost: 0 }),
  recordPhysicalAction = () => ({ status: "spent", mutated: false, cost: 0 }),
  getCombatTargets = () => [],
  debugEnabled = MELEE_DEBUG_ENABLED,
} = {}) {
  const state = createMeleeCombatState();
  const damageNumbers = createDamageNumberPresentation(scene);
  const heldImage = scene.add.image(0, 0, getMeleeWeaponProfile("sword").heldAsset.textureKey)
    .setOrigin(0.5, 0.84375)
    .setScale(HELD_WEAPON_SCALE)
    .setVisible(false);
  const debugGraphics = scene.add.graphics().setVisible(Boolean(debugEnabled));
  const trainingDummy = includeTrainingDummy ? createTrainingDummy(scene, worldLayout) : null;
  const dummySprite = trainingDummy?.sprite ?? null;
  const hitTargetIds = new Set();
  const activeTrails = new Set();
  const activeKnockbacks = new Set();
  const pendingHitSoundTimers = new Set();
  let destroyed = false;
  let savedFacingTurnSpeed = null;
  let savedMovementMaxSpeed = null;
  let runtimeElapsedMs = 0;
  let cameraStabilizeRemainingMs = 0;
  let lastHitSnapshot = null;
  let lastFoundTargetCount = 0;
  let lastStoneHitCount = 0;
  let pendingPointerAction = null;
  let dummyHitTween = null;
  let dummyFlashTimer = null;

  function onPointerDown(pointer) {
    if (pointer?.rightButtonDown?.()) pendingPointerAction = "rmb";
    else if (pointer?.leftButtonDown?.()) pendingPointerAction = "lmb";
  }

  scene.input.on("pointerdown", onPointerDown);

  function handleActions(actions = {}) {
    if (destroyed || !actions.primary || isSuppressed()) return { status: "ignored", accepted: false };
    const selected = getSelectedItem();
    const character = getPlayerCharacter();
    const result = requestEnergyBackedMeleeAttack(
      state,
      selected?.id,
      getControllerMoveDirection(),
      character?.motor?.movement?.facingDirection,
      { canPerformPhysicalAction, recordPhysicalAction },
    );
    if (result.status === "started" || result.status === "switched") {
      startStepPresentation();
      updateHeldPresentation();
    }
    return result;
  }

  function beforeCharacterUpdate(deltaMs) {
    if (destroyed || !isMeleeStepActive(state)) return;
    const character = getPlayerCharacter();
    const motor = character?.motor;
    const profile = getMeleeWeaponProfile(state.weaponId);
    if (!motor || !profile) return;
    savedMovementMaxSpeed = motor.movementConfig.maxSpeed;
    motor.movementConfig.maxSpeed = savedMovementMaxSpeed * profile.movementSpeedMultiplier;
    if (profile.turnMode === MELEE_TURN_MODES.multiplier) {
      savedFacingTurnSpeed = motor.movementConfig.facingTurnSpeed;
      motor.movementConfig.facingTurnSpeed = savedFacingTurnSpeed * profile.turnSpeedMultiplier;
      return;
    }
    motor.movement.velocity.x = 0;
    motor.movement.velocity.y = 0;
    const distance = dashDistanceForInterval(profile, state.elapsedMs, deltaMs);
    if (distance <= 0) return;
    const result = moveWithCollision(
      motor.position,
      { x: state.direction.x * distance, y: state.direction.y * distance },
      worldLayout,
      motor.footWidth,
      motor.footDepth,
    );
    motor.position = { ...result.position };
    motor.lastBlockedAxes = { ...result.blockedAxes };
  }

  function afterCharacterUpdate(deltaMs) {
    if (destroyed) return;
    const character = getPlayerCharacter();
    const motor = character?.motor;
    if (savedFacingTurnSpeed !== null && motor) {
      motor.movementConfig.facingTurnSpeed = savedFacingTurnSpeed;
      savedFacingTurnSpeed = null;
    }
    const events = advanceMeleeCombat(state, deltaMs, {
      readMoveDirection: getControllerMoveDirection,
      readFacing: () => motor?.movement?.facingDirection,
    });
    for (const event of events) {
      if (event.type === "hit") registerHit(event);
      if (event.type === "step-start") startStepPresentation();
    }
    cameraStabilizeRemainingMs = state.weaponId === "sword" && isMeleeStepActive(state)
      ? 250
      : Math.max(0, cameraStabilizeRemainingMs - Math.max(0, Number(deltaMs) || 0));
    if (savedMovementMaxSpeed !== null && motor) {
      motor.movementConfig.maxSpeed = savedMovementMaxSpeed;
      savedMovementMaxSpeed = null;
    }
    runtimeElapsedMs += Math.max(0, Number(deltaMs) || 0);
    updateKnockbacks(deltaMs);
    updateDummyReturn(deltaMs);
    updateTrails();
    updateHeldPresentation();
  }

  function startStepPresentation() {
    hitTargetIds.clear();
    const character = getPlayerCharacter();
    const motor = character?.motor;
    const profile = getMeleeWeaponProfile(state.weaponId);
    if (!motor || !profile) return;
    if (profile.turnMode === MELEE_TURN_MODES.multiplier) {
      state.direction = chooseHeavyReversalDirection(
        motor.movement.facingDirection,
        state.direction,
        combatTargets(),
        meleeBodyCenter(motor.position),
      );
      return;
    }
    motor.movement.facingDirection = { ...state.direction };
    motor.movement.aimDirection = { ...state.direction };
    motor.movement.velocity.x = 0;
    motor.movement.velocity.y = 0;
  }

  function registerHit(event) {
    const character = getPlayerCharacter();
    const motor = character?.motor;
    const profile = getMeleeWeaponProfile(event.weaponId);
    const step = profile?.steps?.[event.stepIndex];
    if (!motor || !profile || !step) return;
    const facingAxis = profile.turnMode === MELEE_TURN_MODES.instant
      ? state.direction
      : motor.movement.facingDirection;
    const origin = meleeBodyCenter(motor.position);
    const initialSnapshot = createMeleeGeometrySnapshot({
      origin,
      facingAxis,
      radius: profile.rangePx,
      arcDeg: step.hitArcDeg,
      baseHalfWidthPx: profile.baseHalfWidthPx,
      swingDirection: step.swingDirection,
    });
    const searchSnapshot = createAutoTargetSearchSnapshot(initialSnapshot, profile.autoTargetSearchScale);
    const autoTarget = resolveAutoTargetDirection(searchSnapshot, combatTargets(), profile.autoTargetBlend);
    if (profile.autoTargetBlend > 0) {
      state.direction = { ...autoTarget.direction };
      motor.movement.facingDirection = { ...autoTarget.direction };
      motor.movement.aimDirection = { ...autoTarget.direction };
    }
    const snapshot = createMeleeGeometrySnapshot({ ...initialSnapshot, facingAxis: autoTarget.direction });
    lastHitSnapshot = snapshot;
    const targets = queryMeleeTargets(snapshot, combatTargets(), hitTargetIds);
    const resourceHits = meleeResourceHits(snapshot);
    lastStoneHitCount = resourceHits.filter((hit) => hit.material === "metal").length;
    lastFoundTargetCount = targets.length;
    for (const target of targets) {
      hitTargetIds.add(target.id);
      const result = target.applyDamage?.(profile.damage) ?? applyTrainingDummyDamage(target.id, profile.damage);
      target.onHit?.({ damage: result.acceptedDamage, atMs: runtimeElapsedMs });
      damageNumbers.notify({
        targetId: target.id,
        damage: result.acceptedDamage,
        anchor: target.damageAnchor,
      });
      scheduleKnockback(target, profile, origin);
    }
    if (event.weaponId === "battle-axe") {
      for (const hit of resourceHits.filter((entry) => entry.material === "log")) {
        damageLog(hit.id, profile.resourceDamageMultiplier);
      }
    }
    const combatEffect = event.weaponId === "sword" ? "sword-hit" : "battle-axe-hit";
    const effects = [
      ...targets.map((target) => target.hitEffect ?? combatEffect),
      ...resourceHits.map((hit) => hit.material === "metal" ? "melee-metal-ring" : "melee-log-thud"),
    ];
    playHitSoundSequence(effects.length ? effects : [combatEffect]);
    createTrail(snapshot, step);
    renderDebug(snapshot, targets.length);
  }

  function createTrail(snapshot, step) {
    const trail = scene.add.graphics()
      .setPosition(snapshot.origin.x, snapshot.origin.y)
      .setDepth(worldDepthFromAnchorY(snapshot.origin.y, `melee-trail-${state.stepIndex}`, 650));
    const localSnapshot = { ...snapshot, origin: { x: 0, y: 0 } };
    drawMeleeSnapshot(trail, localSnapshot, TRAIL_COLOR, step.trailAlpha);
    activeTrails.add(trail);
    scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: step.trailDurationMs,
      ease: "Linear",
      onComplete: () => {
        activeTrails.delete(trail);
        trail.destroy();
      },
    });
  }

  function meleeResourceHits(snapshot) {
    return (worldLayout?.getWorldObjectColliders?.() ?? []).flatMap((collider) => {
      const groupKey = String(collider.groupKey);
      const material = groupKey.startsWith("resource:log-") ? "log"
        : groupKey.startsWith("resource:stone-") || groupKey === "resource:ruby-node" ? "metal"
          : null;
      return material && doesMeleeSnapshotIntersectRect(snapshot, collider.rect)
        ? [{ id: collider.id, material }]
        : [];
    });
  }

  function playHitSoundSequence(effectTypes) {
    effectTypes.forEach((effectType, index) => {
      if (index === 0) { playEffect(effectType); return; }
      const timer = scene.time.delayedCall(index * MELEE_HIT_SOUND_STAGGER_MS, () => {
        pendingHitSoundTimers.delete(timer);
        if (!destroyed) playEffect(effectType);
      });
      pendingHitSoundTimers.add(timer);
    });
  }

  function updateTrails() {
    const position = meleeBodyCenter(getPlayerCharacter()?.motor?.position);
    if (!position) return;
    for (const trail of activeTrails) {
      trail
        .setPosition(position.x, position.y)
        .setDepth(worldDepthFromAnchorY(position.y, "melee-trail", 650));
    }
  }

  function renderDebug(snapshot, foundTargetCount) {
    if (!debugEnabled) return;
    debugGraphics.clear().setVisible(true);
    debugGraphics.lineStyle(1, DEBUG_COLOR, 0.9);
    debugGraphics.fillStyle(DEBUG_COLOR, 1).fillCircle(snapshot.origin.x, snapshot.origin.y, 1);
    debugGraphics.lineBetween(
      snapshot.origin.x,
      snapshot.origin.y,
      snapshot.origin.x + snapshot.facingAxis.x * snapshot.radius,
      snapshot.origin.y + snapshot.facingAxis.y * snapshot.radius,
    );
    strokeMeleeSnapshot(debugGraphics, snapshot);
    for (let index = 0; index < foundTargetCount; index += 1) {
      debugGraphics.fillRect(snapshot.origin.x + index * 2, snapshot.origin.y + snapshot.radius + 2, 1, 1);
    }
  }

  function updateHeldPresentation() {
    const character = getPlayerCharacter();
    const profile = getMeleeWeaponProfile(state.weaponId);
    if (!character?.motor || !profile || !isMeleeStepActive(state)) {
      heldImage.setVisible(false);
      return;
    }
    const heldState = profile.turnMode === MELEE_TURN_MODES.multiplier
      ? { ...state, direction: character.motor.movement.facingDirection }
      : state;
    heldImage
      .setTexture(profile.heldAsset.textureKey)
      .setOrigin(profile.heldAsset.originX, profile.heldAsset.originY)
      .setPosition(
        Math.round(character.motor.position.x),
        Math.round(character.motor.position.y - HELD_Y_OFFSET),
      )
      .setAngle(heldWeaponAngleDeg(heldState, profile))
      .setDepth(worldDepthFromAnchorY(character.motor.position.y, `melee-held-${profile.id}`, 701))
      .setVisible(true);
  }

  function trainingDummyTarget() {
    if (!trainingDummy) return null;
    return {
      id: TRAINING_DUMMY.id,
      position: { ...trainingDummy.position },
      home: { ...trainingDummy.home },
      combatAnchor: {
        x: trainingDummy.position.x + TRAINING_DUMMY.combatAnchorOffset.x,
        y: trainingDummy.position.y + TRAINING_DUMMY.combatAnchorOffset.y,
      },
      damageAnchor: {
        x: trainingDummy.position.x + TRAINING_DUMMY.damageAnchorOffset.x,
        y: trainingDummy.position.y + TRAINING_DUMMY.damageAnchorOffset.y,
      },
      knockbackResistance: TRAINING_DUMMY.knockbackResistance,
      hitEffect: "training-dummy-hit",
      applyKnockbackDelta: moveDummyBy,
      onHit: ({ atMs }) => {
        trainingDummy.lastHitAtMs = atMs;
        trainingDummy.returnMotion = null;
        playTrainingDummyHitReaction();
      },
    };
  }

  function playTrainingDummyHitReaction() {
    dummyHitTween?.stop?.();
    dummyFlashTimer?.remove?.();
    trainingDummy.hitLiftPx = 0;
    trainingDummy.flashSprite.setVisible(true);
    dummyFlashTimer = scene.time.delayedCall(TRAINING_DUMMY.hitReaction.flashMs, () => {
      trainingDummy.flashSprite.setVisible(false);
      dummyFlashTimer = null;
    });
    dummyHitTween = scene.tweens.add({
      targets: trainingDummy,
      hitLiftPx: TRAINING_DUMMY.hitReaction.heightPx,
      duration: TRAINING_DUMMY.hitReaction.travelMs,
      ease: "Cubic.Out",
      hold: TRAINING_DUMMY.hitReaction.holdMs,
      yoyo: true,
      onUpdate: () => syncTrainingDummy(trainingDummy, worldLayout),
      onComplete: () => { trainingDummy.hitLiftPx = 0; dummyHitTween = null; syncTrainingDummy(trainingDummy, worldLayout); },
    });
  }

  function combatTargets() {
    const unique = new Map([trainingDummyTarget(), ...(getCombatTargets() ?? [])].filter((target) => target?.id).map((target) => [target.id, target]));
    return [...unique.values()];
  }

  function scheduleKnockback(target, profile, origin) {
    const distance = effectiveKnockbackDistance(profile.knockbackDistancePx, target.knockbackResistance);
    const dx = target.combatAnchor.x - origin.x;
    const dy = target.combatAnchor.y - origin.y;
    const length = Math.hypot(dx, dy);
    if (!target.applyKnockbackDelta || distance <= 0 || length <= 0) return;
    activeKnockbacks.add({ target, direction: { x: dx / length, y: dy / length }, distance, durationMs: profile.knockbackDurationMs, delayMs: 10, elapsedMs: 0 });
  }

  function updateKnockbacks(deltaMs) {
    for (const motion of [...activeKnockbacks]) {
      let availableMs = Math.max(0, Number(deltaMs) || 0);
      const delay = Math.min(motion.delayMs, availableMs);
      motion.delayMs -= delay;
      availableMs -= delay;
      if (motion.delayMs > 0 || availableMs <= 0) continue;
      const previous = knockbackEaseOut(motion.elapsedMs / motion.durationMs);
      motion.elapsedMs = Math.min(motion.durationMs, motion.elapsedMs + availableMs);
      const distance = motion.distance * (knockbackEaseOut(motion.elapsedMs / motion.durationMs) - previous);
      motion.target.applyKnockbackDelta({ x: motion.direction.x * distance, y: motion.direction.y * distance });
      if (motion.elapsedMs >= motion.durationMs) activeKnockbacks.delete(motion);
    }
  }

  function updateDummyReturn(deltaMs) {
    if (!trainingDummy || activeKnockbacks.size || runtimeElapsedMs - trainingDummy.lastHitAtMs < TRAINING_DUMMY.returnDelayMs) return;
    const homeDistance = Math.hypot(trainingDummy.home.x - trainingDummy.position.x, trainingDummy.home.y - trainingDummy.position.y);
    if (homeDistance <= 0.1) { trainingDummy.returnMotion = null; return; }
    if (!trainingDummy.returnMotion) trainingDummy.returnMotion = planDummyReturn();
    const motion = trainingDummy.returnMotion;
    if (!motion || runtimeElapsedMs < motion.retryAtMs) return;
    if (!motion.path.length) { trainingDummy.returnMotion = planDummyReturn({ includePlayer: true, retryDelayMs: TRAINING_DUMMY.blockedPathWaitMs }); return; }
    const waypoint = motion.path[motion.waypointIndex];
    const anchor = dummyFootAnchor(trainingDummy.position);
    const dx = waypoint.x - anchor.x;
    const dy = waypoint.y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 1.25) {
      motion.waypointIndex += 1;
      motion.blockedWaitMs = 0;
      if (motion.waypointIndex >= motion.path.length) { setDummyPosition(trainingDummy.home); trainingDummy.returnMotion = null; }
      return;
    }
    const seconds = Math.max(0, Number(deltaMs) || 0) / 1000;
    const config = TRAINING_DUMMY.returnMovement;
    const brakingSpeed = Math.sqrt(2 * config.brakingDeceleration * homeDistance);
    const targetSpeed = Math.min(config.maxSpeed, brakingSpeed);
    const rate = targetSpeed < motion.speed ? config.brakingDeceleration : config.acceleration;
    motion.speed = moveToward(motion.speed, targetSpeed, rate * seconds);
    const step = Math.min(distance, motion.speed * seconds);
    const direction = { x: dx / distance, y: dy / distance };
    const lookAhead = Math.min(distance, TRAINING_DUMMY.obstacleClearancePx + config.maxSpeed * seconds);
    if (isDummyPathBlocked(direction, lookAhead)) {
      motion.speed = 0;
      motion.blockedWaitMs += Math.max(0, Number(deltaMs) || 0);
      if (motion.blockedWaitMs >= TRAINING_DUMMY.blockedPathWaitMs) {
        trainingDummy.returnMotion = planDummyReturn({ includePlayer: true });
      }
      return;
    }
    motion.blockedWaitMs = 0;
    const before = { ...trainingDummy.position };
    moveDummyBy({ x: direction.x * step, y: direction.y * step });
    const moved = Math.hypot(trainingDummy.position.x - before.x, trainingDummy.position.y - before.y);
    if (moved < step * 0.25) motion.blockedWaitMs += Math.max(0, Number(deltaMs) || 0);
  }

  function planDummyReturn({ includePlayer = false, retryDelayMs = 0 } = {}) {
    worldLayout?.clearWorldObjectCollider?.(TRAINING_DUMMY.id);
    const goal = dummyFootAnchor(trainingDummy.home);
    let path = null;
    try {
      const navigation = createActorNavigation(dummyNavigationEnvironment(includePlayer), { cellSize: 16, footWidth: 8, footDepth: 7 });
      path = findGridPath({ start: dummyFootAnchor(trainingDummy.position), goal, bounds: worldLayout.bounds, cellSize: 16, ...navigation });
    } finally {
      syncTrainingDummy(trainingDummy, worldLayout);
    }
    if (!path) return { path: [], waypointIndex: 0, speed: 0, blockedWaitMs: 0, retryAtMs: runtimeElapsedMs + Math.max(TRAINING_DUMMY.blockedPathWaitMs, retryDelayMs) };
    path.push(goal);
    return { path, waypointIndex: 0, speed: 0, blockedWaitMs: 0, retryAtMs: runtimeElapsedMs + retryDelayMs };
  }

  function isDummyPathBlocked(direction, distance) {
    if (!(distance > 0)) return false;
    worldLayout?.clearWorldObjectCollider?.(TRAINING_DUMMY.id);
    const anchor = dummyFootAnchor(trainingDummy.position);
    let moved = anchor;
    try {
      moved = moveWithCollision(anchor, { x: direction.x * distance, y: direction.y * distance }, dummyNavigationEnvironment(true), 8, 7).position;
    } finally {
      syncTrainingDummy(trainingDummy, worldLayout);
    }
    return Math.hypot(moved.x - anchor.x, moved.y - anchor.y) < distance - 0.1;
  }

  function dummyNavigationEnvironment(includePlayer) {
    const motor = getPlayerCharacter()?.motor;
    const playerBox = includePlayer && motor ? getFootBox(motor.position, motor.footWidth, motor.footDepth) : null;
    return {
      bounds: worldLayout.bounds,
      cellSize: worldLayout.cellSize,
      isBlockedCell: (x, y) => worldLayout.isBlockedCell(x, y),
      isBlockedBox: (box) => Boolean(worldLayout.isBlockedBox?.(box)) || Boolean(playerBox && boxesOverlap(box, playerBox)),
    };
  }

  function moveDummyBy(delta) {
    worldLayout?.clearWorldObjectCollider?.(TRAINING_DUMMY.id);
    const anchor = dummyFootAnchor(trainingDummy.position);
    const moved = moveWithCollision(anchor, delta, dummyNavigationEnvironment(true), 8, 7).position;
    setDummyPosition({ x: moved.x - 8, y: moved.y - 31 });
  }

  function setDummyPosition(point) {
    trainingDummy.position.x = point.x;
    trainingDummy.position.y = point.y;
    syncTrainingDummy(trainingDummy, worldLayout);
  }

  function getBuildMoveTargetAt(point) {
    if (!trainingDummy) return null;
    const position = trainingDummy.position;
    const width = TRAINING_DUMMY.asset.width;
    const height = TRAINING_DUMMY.asset.height;
    if (point.x < position.x || point.x > position.x + width || point.y < position.y || point.y > position.y + height) return null;
    return { kind: "training-dummy", definition: { id: TRAINING_DUMMY.id }, placementPosition: { ...position }, snapAnchorOffset: { x: 8, y: 16 }, targets: [dummySprite] };
  }

  function moveBuildTarget(point) {
    if (!trainingDummy) return null;
    const previous = { ...trainingDummy.home };
    const next = { x: Number(point.x), y: Number(point.y) };
    if (isDummyPlacementBlocked(next)) return null;
    trainingDummy.home = { ...next };
    trainingDummy.returnMotion = null;
    trainingDummy.lastHitAtMs = runtimeElapsedMs;
    setDummyPosition(next);
    return { previous, current: next };
  }

  function getStartingLayoutFurniture() {
    if (!trainingDummy) return [];
    return [{
      id: TRAINING_DUMMY.id,
      kind: "training-dummy",
      position: { ...trainingDummy.home },
    }];
  }

  function restoreStartingLayoutFurniture(definitions) {
    if (!trainingDummy) return false;
    const definition = definitions?.find?.((candidate) => candidate.id === TRAINING_DUMMY.id);
    if (!definition || definition.kind !== "training-dummy") return false;
    const point = { x: Number(definition.position?.x), y: Number(definition.position?.y) };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return false;
    trainingDummy.home = point;
    trainingDummy.returnMotion = null;
    setDummyPosition(point);
    return true;
  }

  function isDummyPlacementBlocked(point) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return true;
    const box = dummyColliderAt(point);
    const bounds = worldLayout?.bounds;
    return Boolean(bounds && (box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom))
      || (worldLayout?.getBlockingColliders?.(box) ?? []).some((entry) => entry.id !== TRAINING_DUMMY.id);
  }

  updateHeldPresentation();
  return {
    handleActions,
    consumePointerAction() {
      const actionId = pendingPointerAction;
      pendingPointerAction = null;
      return actionId;
    },
    beforeCharacterUpdate,
    afterCharacterUpdate,
    isAttacking: () => isMeleeStepActive(state),
    isTranslationLocked: () => state.weaponId === "sword" && isMeleeStepActive(state),
    getCameraFollowSpeedLimit: () => (state.weaponId === "sword" && isMeleeStepActive(state)) || cameraStabilizeRemainingMs > 0
      ? SWORD_CAMERA_MAX_FOLLOW_SPEED
      : null,
    getAimDirection: () => isMeleeStepActive(state) ? { ...state.direction } : null,
    getBuildMoveTargetAt,
    moveBuildTarget,
    getStartingLayoutFurniture,
    restoreStartingLayoutFurniture,
    restoreBuildTarget(point) { if (trainingDummy) { trainingDummy.home = { ...point }; setDummyPosition(point); } },
    renderBuildPreview(point) { return trainingDummy ? scene.add.image(point.x, point.y, TRAINING_DUMMY.asset.textureKey).setOrigin(0).setDepth(8988).setTint(isDummyPlacementBlocked(point) ? 0xff5364 : 0x7dff9a).setAlpha(0.58) : null; },
    getState: () => ({
      ...state,
      direction: { ...state.direction },
      lastHitSnapshot,
      lastFoundTargetCount,
      lastStoneHitCount,
      damageNumbers: damageNumbers.getState(),
      dummy: trainingDummyTarget(),
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (savedFacingTurnSpeed !== null) {
        const motor = getPlayerCharacter()?.motor;
        if (motor) motor.movementConfig.facingTurnSpeed = savedFacingTurnSpeed;
      }
      if (savedMovementMaxSpeed !== null) {
        const motor = getPlayerCharacter()?.motor;
        if (motor) motor.movementConfig.maxSpeed = savedMovementMaxSpeed;
      }
      if (trainingDummy) worldLayout?.clearWorldObjectCollider?.(TRAINING_DUMMY.id);
      scene.input.off("pointerdown", onPointerDown);
      heldImage.destroy();
      for (const trail of activeTrails) trail.destroy();
      for (const timer of pendingHitSoundTimers) timer.remove?.();
      pendingHitSoundTimers.clear();
      activeTrails.clear();
      debugGraphics.destroy();
      dummyHitTween?.stop?.();
      dummyFlashTimer?.remove?.();
      trainingDummy?.flashSprite.destroy();
      dummySprite?.destroy();
      damageNumbers.destroy();
    },
  };
}

export function requestEnergyBackedMeleeAttack(
  state,
  weaponId,
  moveDirection,
  currentFacing,
  { canPerformPhysicalAction = () => ({ allowed: true, cost: 0 }), recordPhysicalAction = () => ({ cost: 0 }) } = {},
) {
  if (!getMeleeWeaponProfile(weaponId)) return requestMeleeAttack(state, weaponId, moveDirection, currentFacing);
  const affordability = canPerformPhysicalAction(weaponId);
  if (!affordability?.allowed) return { status: "insufficient-energy", accepted: false, cost: affordability?.cost ?? 0 };
  const result = requestMeleeAttack(state, weaponId, moveDirection, currentFacing);
  if (!result.accepted) return result;
  const expenditure = recordPhysicalAction(weaponId);
  return { ...result, energyCost: expenditure?.cost ?? affordability.cost ?? 0 };
}

export function dashDistanceForInterval(profile, elapsedMs, deltaMs) {
  if (!(profile?.forcedMoveDistancePx > 0) || !(profile?.forcedMoveDurationMs > 0)) return 0;
  const start = Math.min(profile.forcedMoveDurationMs, Math.max(0, Number(elapsedMs) || 0));
  const end = Math.min(profile.forcedMoveDurationMs, start + Math.max(0, Number(deltaMs) || 0));
  return profile.forcedMoveDistancePx * (end - start) / profile.forcedMoveDurationMs;
}

export function heldWeaponAngleDeg(state, profile = getMeleeWeaponProfile(state?.weaponId)) {
  const step = profile?.steps?.[state?.stepIndex];
  if (!step) return 0;
  const facingAngle = Math.atan2(state.direction.y, state.direction.x) * 180 / Math.PI + 90;
  const progress = profile.turnMode === MELEE_TURN_MODES.instant
    ? Math.min(1, Math.max(
      0,
      (state.elapsedMs - step.windupMs) / (step.trailDurationMs / SWORD_SWING_VISUAL_SPEED_MULTIPLIER),
    ))
    : Math.min(1, Math.max(0, state.elapsedMs / step.totalDurationMs));
  const sign = step.swingDirection === MELEE_SWING_DIRECTIONS.clockwise ? 1 : -1;
  return facingAngle + sign * (-step.hitArcDeg / 2 + step.hitArcDeg * progress);
}

export function meleeSectorPoints(snapshot, segments = 20) {
  return meleeShapePoints(snapshot, segments);
}

function createTrainingDummy(scene, worldLayout) {
  const asset = TRAINING_DUMMY.asset;
  const position = findTrainingDummyPoint(worldLayout);
  const flashTextureKey = ensureWhiteSilhouetteTexture(scene, asset);
  const sprite = scene.add.image(position.x, position.y, asset.textureKey)
    .setOrigin(0)
    .setDepth(worldDepthFromAnchorY(
      position.y + asset.depthAnchor.y,
      TRAINING_DUMMY.id,
    ));
  const flashSprite = scene.add.image(position.x, position.y, flashTextureKey)
    .setOrigin(0)
    .setDepth(sprite.depth + 0.01)
    .setAlpha(0.7)
    .setVisible(false);
  worldLayout?.setWorldObjectCollider?.(
    TRAINING_DUMMY.id,
    {
      left: position.x + asset.collision.left,
      top: position.y + asset.collision.top,
      right: position.x + asset.collision.right,
      bottom: position.y + asset.collision.bottom,
    },
    "melee:training-dummy",
    { kind: "training-dummy", fixed: true },
  );
  return { sprite, flashSprite, position, home: { ...position }, lastHitAtMs: -Infinity, returnMotion: null, hitLiftPx: 0 };
}

function ensureWhiteSilhouetteTexture(scene, asset) {
  const key = `${asset.textureKey}.hit-flash`;
  if (scene.textures.exists(key)) return key;
  const source = scene.textures.get(asset.textureKey).getSourceImage();
  const texture = scene.textures.createCanvas(key, asset.width, asset.height);
  const context = texture.getContext();
  context.clearRect(0, 0, asset.width, asset.height);
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, asset.width, asset.height);
  context.globalCompositeOperation = "source-over";
  texture.refresh();
  return key;
}

function dummyColliderAt(position) {
  const collision = TRAINING_DUMMY.asset.collision;
  return { left: position.x + collision.left, top: position.y + collision.top, right: position.x + collision.right, bottom: position.y + collision.bottom };
}

function dummyFootAnchor(position) {
  return { x: position.x + 8, y: position.y + 31 };
}

function moveToward(current, target, maximumDelta) {
  return Math.abs(target - current) <= maximumDelta ? target : current + Math.sign(target - current) * maximumDelta;
}

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function syncTrainingDummy(trainingDummy, worldLayout) {
  const { position, sprite, flashSprite } = trainingDummy;
  const depth = worldDepthFromAnchorY(position.y + TRAINING_DUMMY.asset.depthAnchor.y, TRAINING_DUMMY.id);
  sprite.setPosition(position.x, position.y - trainingDummy.hitLiftPx).setDepth(depth);
  flashSprite.setPosition(sprite.x, sprite.y).setDepth(depth + 0.01);
  worldLayout?.setWorldObjectCollider?.(TRAINING_DUMMY.id, dummyColliderAt(position), "melee:training-dummy", { kind: "training-dummy", fixed: true });
}

function drawMeleeSnapshot(graphics, snapshot, color, alpha) {
  graphics.fillStyle(color, alpha);
  if (snapshot.arcDeg >= 360) {
    graphics.fillCircle(snapshot.origin.x, snapshot.origin.y, snapshot.radius);
    return graphics;
  }
  graphics.fillPoints(meleeSectorPoints(snapshot), true);
  return graphics;
}

function strokeMeleeSnapshot(graphics, snapshot) {
  if (snapshot.arcDeg >= 360) {
    graphics.strokeCircle(snapshot.origin.x, snapshot.origin.y, snapshot.radius);
    return graphics;
  }
  graphics.strokePoints(meleeSectorPoints(snapshot), true);
  return graphics;
}
