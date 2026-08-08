import { assetDepthFromPivot, WORLD_DEPTH_BASE } from "../build/buildWorldGeometry.js";
import { HUD_COLORS, HUD_DEPTH } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import {
  createWildAtollArenaResources,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  getWildAtollSegmentDefinition,
  WILD_ATOLL_ALL_ARENAS,
  WILD_ATOLL_ARENAS,
} from "./wildAtollDomain.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "./worldLocationConfig.js";
import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  WORLD_GROUND_OVERLAY_DEPTH,
  WORLD_TRANSITION_ASSETS,
  WORLD_TRANSITION_PROFILE_KEYS,
} from "./worldConfig.js";

const INTERACTION_RADIUS = 44;
const NEST_ATOLL_ENTRANCE = Object.freeze({ x: 11 * TILE_SIZE, y: 6 * TILE_SIZE });
const NEST_RETURN_SPAWN = Object.freeze({ x: 11 * TILE_SIZE, y: 9 * TILE_SIZE, facing: { x: 0, y: -1 } });
const SOUTH_SPAWN = Object.freeze({ ...ATOLL_WORLD_MODEL.spawn });
const SEGMENT_TITLE_Y = 46;
const ARENA_TITLE_Y = 56;
const TITLE_MAX_WIDTH = 180;
const PROMPT_RECT = Object.freeze({ x: 62, y: 128, width: 196, height: 20 });
const COLLAPSE_FADE_OUT_MS = 5000;
const COLLAPSE_BLACK_HOLD_MS = 2000;
const COLLAPSE_FADE_IN_MS = 3000;
const COLLAPSE_SIMULATION_STEP_MS = 1000;
const COLLAPSE_SIMULATION_MAX_STEPS = 360;

const GLIDER_BASE_COLLIDER = Object.freeze({ left: 8, right: 40, top: 40, bottom: 48 });
const TELEPORT_PLATFORM_BASE_COLLIDER = Object.freeze({ left: 10, right: 54, top: 52, bottom: 60 });
const TELEPORT_CONSTRUCT_BASE_COLLIDER = Object.freeze({ left: 24, right: 40, top: 50, bottom: 62 });

export function createWildAtollRuntime(scene, {
  localization,
  getPlayerCharacter = () => scene.playerCharacter ?? null,
  getWorldId = () => scene.sessionState?.currentWorldId ?? null,
  transitionWorld = (worldId, spawn) => scene.worldLocationCoordinator?.transitionTo?.(worldId, spawn)
    ?? { status: "unavailable", transitioned: false },
  showMessage = (keyOrText, options) => scene.gameHud?.showTransientMessage?.(keyOrText, options),
} = {}) {
  const promptBackground = scene.add.graphics().setDepth(HUD_DEPTH + 34).setScrollFactor(0).setVisible(false);
  const promptText = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 35).setScrollFactor(0).setVisible(false);
  const promptZone = scene.add.zone(PROMPT_RECT.x, PROMPT_RECT.y, PROMPT_RECT.width, PROMPT_RECT.height)
    .setOrigin(0)
    .setDepth(HUD_DEPTH + 36)
    .setScrollFactor(0)
    .disableInteractive();
  const segmentTitleText = createManagedText(scene, 0, SEGMENT_TITLE_Y, "", {
    fontSize: "7px",
    color: "#d9cda9",
  }).setDepth(HUD_DEPTH + 26).setScrollFactor(0).setVisible(false);
  const arenaTitleText = createManagedText(scene, 0, ARENA_TITLE_Y, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 27).setScrollFactor(0).setVisible(false);
  const blackout = scene.add.rectangle(0, 0, 320, 180, 0x000000, 1)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(HUD_DEPTH + 200)
    .setAlpha(0)
    .setVisible(false);

  let mountedWorldId = null;
  let observedWorldId = null;
  let runActive = false;
  let runSeed = "";
  let arenaId = null;
  let candidate = null;
  let arenaVisuals = [];
  let arenaAuthoringInstances = [];
  let activeResourceIds = [];
  let destroyed = false;
  let runSerial = 0;
  let collapseRecoveryActive = false;
  let collapseDelay = null;
  let originalGetSleepTimeScale = null;

  function debrisRuntime() {
    return scene.worldLocationRuntime?.getOwners?.().debrisRuntime ?? scene.debrisRuntime ?? null;
  }

  function mountNestEntrance() {
    mountedWorldId = WORLD_IDS.nest;
    runActive = false;
    arenaId = null;
    candidate = null;
    clearArenaPresentation({ removeResourceState: true });
    arenaVisuals.push(...createCave(scene, NEST_ATOLL_ENTRANCE.x, NEST_ATOLL_ENTRANCE.y));
    setTitlesVisible(false);
  }

  function mountAtollRun() {
    mountedWorldId = WORLD_IDS.atoll;
    runActive = true;
    runSerial += 1;
    runSeed = `${Date.now()}-${runSerial}`;
    clearKnownArenaResourceState();
    renderArena(WILD_ATOLL_ARENAS.root);
    showMessage("atoll:arrival");
  }

  function unmountCurrentWorld() {
    mountedWorldId = null;
    runActive = false;
    arenaId = null;
    candidate = null;
    clearArenaPresentation({ removeResourceState: true });
    renderPrompt();
    setTitlesVisible(false);
  }

  function enterAtoll() {
    const result = transitionWorld(WORLD_IDS.atoll, SOUTH_SPAWN);
    if (!result?.transitioned) return false;
    clearArenaPresentation({ removeResourceState: true });
    mountedWorldId = null;
    candidate = null;
    setTitlesVisible(false);
    return true;
  }

  function leaveAtoll({ silent = false } = {}) {
    clearArenaPresentation({ removeResourceState: true });
    clearKnownArenaResourceState();
    const result = transitionWorld(WORLD_IDS.nest, NEST_RETURN_SPAWN);
    if (!result?.transitioned) return false;
    mountedWorldId = null;
    runActive = false;
    arenaId = null;
    candidate = null;
    setTitlesVisible(false);
    if (!silent) showMessage("atoll:leftRun");
    return true;
  }

  function renderArena(nextArenaId) {
    arenaId = nextArenaId;
    candidate = null;
    clearArenaPresentation({ removeResourceState: true });
    const definition = getWildAtollArenaDefinition(arenaId);
    registerArenaResources(definition);
    for (const exit of definition.exits) createExitVisual(exit);
    setTitles(definition.segmentKey, definition.arenaKey);
    setPlayerPosition(SOUTH_SPAWN);
    scene.interactionRuntime?.refresh?.();
  }

  function registerArenaResources(definition) {
    const owner = debrisRuntime();
    if (!owner) return;
    const resources = createWildAtollArenaResources(runSeed, "current", definition.id);
    activeResourceIds = resources.map((resource) => resource.id);
    for (const resource of resources) owner.registerResource?.(resource);
  }

  function ensureArenaResourcesRegistered() {
    if (mountedWorldId !== WORLD_IDS.atoll || !runActive || !arenaId || activeResourceIds.length > 0) return;
    const definition = getWildAtollArenaDefinition(arenaId);
    if (definition.resources.length === 0 || !debrisRuntime()) return;
    registerArenaResources(definition);
    scene.interactionRuntime?.refresh?.();
  }

  function clearArenaPresentation({ removeResourceState = true, resetCandidate = true } = {}) {
    const owner = debrisRuntime();
    for (const resourceId of activeResourceIds) {
      if (owner?.getResourceDefinition?.(resourceId)) {
        owner.unregisterResource?.(resourceId, { removeState: removeResourceState });
      } else if (removeResourceState) {
        const nodes = scene.sessionState?.gameplay?.resourceNodes;
        if (nodes) delete nodes[resourceId];
      }
    }
    activeResourceIds = [];
    for (const instance of arenaAuthoringInstances) scene.worldLayout?.clearWorldObjectCollider?.(instance.id);
    arenaAuthoringInstances = [];
    for (const object of arenaVisuals) object.destroy?.();
    arenaVisuals = [];
    if (resetCandidate) scene.interactionRuntime?.resetCandidate?.();
  }

  function clearKnownArenaResourceState() {
    const nodes = scene.sessionState?.gameplay?.resourceNodes;
    if (!nodes) return;
    for (const knownArenaId of WILD_ATOLL_ALL_ARENAS) {
      const definitions = createWildAtollArenaResources("cleanup", "current", knownArenaId);
      for (const definition of definitions) delete nodes[definition.id];
    }
  }

  function createExitVisual(exit) {
    const point = getWildAtollExitPoint(exit.direction, TILE_SIZE);
    if (exit.kind === "teleport") {
      createTeleportVisual(exit, point);
      return;
    }
    createGliderVisual(exit, point);
  }

  function createGliderVisual(exit, point) {
    const diagonal = exit.direction !== "north";
    const profileKey = diagonal
      ? WORLD_TRANSITION_PROFILE_KEYS.atollPathDiagonal
      : WORLD_TRANSITION_PROFILE_KEYS.atollPathNorth;
    const asset = diagonal
      ? WORLD_TRANSITION_ASSETS.atollPathDiagonal
      : WORLD_TRANSITION_ASSETS.atollPathNorth;
    createAuthoredAssetVisual({
      id: `atoll:${arenaId}:${exit.id}:glider`,
      profileKey,
      asset,
      center: point,
      baseCollider: GLIDER_BASE_COLLIDER,
      depthMode: "fixed",
      fixedDepth: WORLD_GROUND_OVERLAY_DEPTH,
      flipX: exit.direction === "north-east",
    });
  }

  function createTeleportVisual(exit, point) {
    createAuthoredAssetVisual({
      id: `atoll:${arenaId}:${exit.id}:platform`,
      profileKey: WORLD_TRANSITION_PROFILE_KEYS.atollTeleportPlatform,
      asset: WORLD_TRANSITION_ASSETS.atollTeleportPlatform,
      center: point,
      baseCollider: TELEPORT_PLATFORM_BASE_COLLIDER,
      depthMode: "fixed",
      fixedDepth: WORLD_GROUND_OVERLAY_DEPTH,
    });
    createAuthoredAssetVisual({
      id: `atoll:${arenaId}:${exit.id}:construct`,
      profileKey: WORLD_TRANSITION_PROFILE_KEYS.atollTeleportConstruct,
      asset: WORLD_TRANSITION_ASSETS.atollTeleportConstruct,
      center: point,
      baseCollider: TELEPORT_CONSTRUCT_BASE_COLLIDER,
      authoringBounds: Object.freeze({ left: 16, right: 48, top: 0, bottom: 64 }),
      depthMode: "pivot",
    });
  }

  function createAuthoredAssetVisual({
    id,
    profileKey,
    asset,
    center,
    baseCollider,
    authoringBounds = null,
    depthMode = "pivot",
    fixedDepth = null,
    flipX = false,
  }) {
    const anchor = {
      x: Math.round(center.x - asset.width / 2),
      y: Math.round(center.y - asset.height / 2),
    };
    const sprite = scene.add.image(anchor.x, anchor.y, asset.textureKey).setOrigin(0, 0);
    sprite.setFlipX?.(Boolean(flipX));
    const instance = {
      id,
      profileKey,
      anchor,
      bounds: authoringBounds
        ? {
            left: anchor.x + authoringBounds.left,
            right: anchor.x + authoringBounds.right,
            top: anchor.y + authoringBounds.top,
            bottom: anchor.y + authoringBounds.bottom,
          }
        : {
            left: anchor.x,
            right: anchor.x + asset.width,
            top: anchor.y,
            bottom: anchor.y + asset.height,
          },
      visualBasePosition: { ...anchor },
      targets: [sprite],
      special: true,
      depthMode,
      ...(fixedDepth === null ? {} : { fixedDepth }),
    };
    syncAuthoredAssetVisual(instance, asset);
    const collider = {
      left: anchor.x + baseCollider.left,
      right: anchor.x + baseCollider.right,
      top: anchor.y + baseCollider.top,
      bottom: anchor.y + baseCollider.bottom,
    };
    scene.worldLayout?.setWorldObjectCollider?.(id, collider, profileKey, {
      kind: "wild-atoll-transition",
      profileKey,
    });
    arenaAuthoringInstances.push(instance);
    arenaVisuals.push(sprite);
    return instance;
  }

  function syncAuthoredAssetVisual(instance, asset) {
    const profile = scene.assetProfiles?.[instance.profileKey] ?? {};
    const visualOffset = profile.visualOffset ?? { x: 0, y: 0 };
    const pivot = profile.snapAnchorOffset ?? { x: asset.width / 2, y: asset.height };
    instance.targets.forEach((target, index) => {
      target.setPosition?.(
        Math.round(instance.visualBasePosition.x + Number(visualOffset.x || 0)),
        Math.round(instance.visualBasePosition.y + Number(visualOffset.y || 0)),
      );
      const depth = instance.depthMode === "fixed"
        ? Number(instance.fixedDepth ?? WORLD_GROUND_OVERLAY_DEPTH)
        : assetDepthFromPivot(instance.anchor, pivot, WORLD_DEPTH_BASE, instance.id);
      target.setDepth?.(depth + index * 0.01);
      const crop = profile.visualCropInsets;
      if (crop) {
        const left = Math.max(0, Number(crop.left) || 0);
        const right = Math.max(0, Number(crop.right) || 0);
        const top = Math.max(0, Number(crop.top) || 0);
        const bottom = Math.max(0, Number(crop.bottom) || 0);
        target.setCrop?.(
          left,
          top,
          Math.max(1, asset.width - left - right),
          Math.max(1, asset.height - top - bottom),
        );
      } else {
        target.setCrop?.();
      }
    });
  }

  function activateCandidate() {
    if (!candidate || collapseRecoveryActive) return false;
    if (candidate.kind === "enter") return enterAtoll();
    if (candidate.kind !== "exit") return false;
    return activateExit(candidate.exit);
  }

  function activateExit(exit) {
    if (exit.kind === "path") {
      renderArena(exit.targetArenaId);
      return true;
    }
    if (exit.kind === "teleport") return leaveAtoll();
    if (exit.kind === "segment") {
      const nextSegment = getWildAtollSegmentDefinition(exit.targetSegmentId);
      renderArena(nextSegment.entryArenaId);
      return true;
    }
    return false;
  }

  function onAction(actionId) {
    if (!mountedWorldId || destroyed || collapseRecoveryActive || actionId !== "space") return;
    if (candidate && activateCandidate()) scene.suppressNextInteract = true;
  }

  function onKeyboard(event) {
    if (event?.repeat || isEditableTarget(event?.target) || event.code !== "Space") return;
    onAction("space");
  }

  function update() {
    if (destroyed) return;
    const worldId = getWorldId();
    if (worldId !== observedWorldId) {
      observedWorldId = worldId;
      unmountCurrentWorld();
      if (worldId === WORLD_IDS.nest) mountNestEntrance();
      else if (worldId === WORLD_IDS.atoll) mountAtollRun();
    }
    ensureArenaResourcesRegistered();
    if (mountedWorldId === WORLD_IDS.atoll
      && runActive
      && !collapseRecoveryActive
      && !scene.sleeping
      && Number(scene.sessionState?.gameplay?.currentEnergy) <= 0) {
      beginCollapseRecovery();
    }
    const supportedWorld = mountedWorldId === WORLD_IDS.nest || mountedWorldId === WORLD_IDS.atoll;
    if (!supportedWorld || collapseRecoveryActive) {
      candidate = null;
      renderPrompt();
      return;
    }
    candidate = findCandidate();
    renderPrompt();
  }

  function findCandidate() {
    const position = getPlayerCharacter()?.motor?.position;
    if (!position) return null;
    if (mountedWorldId === WORLD_IDS.nest) {
      const distance = Math.hypot(NEST_ATOLL_ENTRANCE.x - position.x, NEST_ATOLL_ENTRANCE.y - position.y);
      return distance <= INTERACTION_RADIUS
        ? { kind: "enter", id: "enter", labelKey: "atoll:promptEnter", distance }
        : null;
    }
    if (mountedWorldId !== WORLD_IDS.atoll || !runActive) return null;
    const definition = getWildAtollArenaDefinition(arenaId);
    return definition.exits
      .map((exit) => {
        const point = getWildAtollExitPoint(exit.direction, TILE_SIZE);
        return {
          kind: "exit",
          id: `exit:${exit.id}`,
          exit,
          labelKey: exit.promptKey,
          distance: Math.hypot(point.x - position.x, point.y - position.y),
        };
      })
      .filter((entry) => entry.distance <= INTERACTION_RADIUS)
      .sort((left, right) => left.distance - right.distance)[0] ?? null;
  }

  function renderPrompt() {
    if (destroyed) return;
    const value = candidate ? translate(candidate.labelKey) : "";
    const visible = Boolean(mountedWorldId && candidate && value && !collapseRecoveryActive);
    promptBackground.clear().setVisible(visible);
    promptText.setVisible(visible);
    if (!visible) {
      promptZone.disableInteractive();
      return;
    }
    setManagedTextStyle(promptText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value);
    if (promptText.width > PROMPT_RECT.width - 16) {
      setManagedTextStyle(promptText, scene, {
        fontFamily: localization.getLocale().fontKey,
        fontSize: "7px",
        color: "#f2eadc",
      });
    }
    const width = Math.min(PROMPT_RECT.width, Math.max(88, Math.ceil(promptText.width) + 16));
    const x = Math.round((320 - width) / 2);
    promptBackground
      .fillStyle(HUD_COLORS.panel, 0.94).fillRect(x, PROMPT_RECT.y, width, PROMPT_RECT.height)
      .lineStyle(1, HUD_COLORS.border, 0.95).strokeRect(x + 0.5, PROMPT_RECT.y + 0.5, width - 1, PROMPT_RECT.height - 1);
    promptText.setPosition(Math.round((320 - promptText.width) / 2), PROMPT_RECT.y + 5);
    promptZone.setPosition(x, PROMPT_RECT.y).setSize(width, PROMPT_RECT.height).setInteractive({ useHandCursor: true });
  }

  function setTitles(segmentKey, arenaKey) {
    setFittedTitle(segmentTitleText, translate(segmentKey), SEGMENT_TITLE_Y, 7, "#d9cda9");
    setFittedTitle(arenaTitleText, translate(arenaKey), ARENA_TITLE_Y, 8, "#f2eadc");
  }

  function setFittedTitle(textObject, value, y, preferredSize, color) {
    const visible = Boolean(value);
    textObject.setVisible(visible);
    if (!visible) return;
    setManagedTextStyle(textObject, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: `${preferredSize}px`,
      color,
    }).setText(value);
    if (textObject.width > TITLE_MAX_WIDTH) {
      setManagedTextStyle(textObject, scene, {
        fontFamily: localization.getLocale().fontKey,
        fontSize: `${Math.max(6, preferredSize - 1)}px`,
        color,
      });
    }
    textObject.setPosition(Math.round((320 - textObject.width) / 2), y);
  }

  function setTitlesVisible(visible) {
    segmentTitleText.setVisible(Boolean(visible));
    arenaTitleText.setVisible(Boolean(visible));
  }

  function translate(key) {
    if (!key) return "";
    const value = String(localization.t(key) ?? "");
    const namespaceFreeKey = key.includes(":") ? key.slice(key.indexOf(":") + 1) : key;
    return value === key || value === namespaceFreeKey ? "" : value;
  }

  function setPlayerPosition(point) {
    const player = getPlayerCharacter();
    if (!player?.motor) return;
    player.motor.position = { x: point.x, y: point.y };
    player.motor.movement.velocity.x = 0;
    player.motor.movement.velocity.y = 0;
    if (point.facing) player.motor.movement.facingDirection = { ...point.facing };
    scene.cameraRuntime?.reset?.(player.motor.position);
  }

  function beginCollapseRecovery() {
    if (destroyed || getWorldId() !== WORLD_IDS.atoll) return false;
    if (collapseRecoveryActive) return true;
    collapseRecoveryActive = true;
    scene.atollCollapseTransitionActive = true;
    candidate = null;
    renderPrompt();
    scene.interactionRuntime?.resetCandidate?.();
    if (typeof scene.getSleepTimeScale === "function" && originalGetSleepTimeScale === null) {
      originalGetSleepTimeScale = scene.getSleepTimeScale;
      scene.getSleepTimeScale = () => 1;
    }
    scene.startSleeping?.({ exhausted: true });
    blackout.setVisible(true).setAlpha(0);
    scene.tweens.add({
      targets: blackout,
      alpha: 1,
      duration: COLLAPSE_FADE_OUT_MS,
      ease: "Linear",
      onComplete: completeCollapseBehindBlack,
    });
    return true;
  }

  function restoreSleepTimeScale() {
    if (originalGetSleepTimeScale === null) return;
    scene.getSleepTimeScale = originalGetSleepTimeScale;
    originalGetSleepTimeScale = null;
  }

  function completeCollapseBehindBlack() {
    if (destroyed || !collapseRecoveryActive) return;
    restoreSleepTimeScale();
    const minimumGameHours = Number(scene.gameplayTuning?.needs?.collapse?.minimumGameHours) || 2;
    const wakeEnergy = Number(scene.gameplayTuning?.needs?.collapse?.wakeEnergy) || 25;
    let wakeReached = false;
    let steps = 0;
    while (!wakeReached && steps < COLLAPSE_SIMULATION_MAX_STEPS) {
      const beforeElapsed = Number(scene.needsRuntime?.getState?.().collapseElapsedGameHours) || 0;
      scene.updateGameplayTime?.(COLLAPSE_SIMULATION_STEP_MS);
      const afterElapsed = Number(scene.needsRuntime?.getState?.().collapseElapsedGameHours) || 0;
      const currentEnergy = Number(scene.sessionState?.gameplay?.currentEnergy) || 0;
      wakeReached = currentEnergy >= wakeEnergy
        && (afterElapsed >= minimumGameHours || afterElapsed + 1e-9 < beforeElapsed);
      steps += 1;
    }
    scene.wakeUp?.();
    leaveAtoll({ silent: true });
    collapseDelay = scene.time.delayedCall(COLLAPSE_BLACK_HOLD_MS, () => {
      collapseDelay = null;
      if (destroyed || !collapseRecoveryActive) return;
      scene.tweens.add({
        targets: blackout,
        alpha: 0,
        duration: COLLAPSE_FADE_IN_MS,
        ease: "Linear",
        onComplete: finishCollapseRecovery,
      });
    });
  }

  function finishCollapseRecovery() {
    collapseRecoveryActive = false;
    scene.atollCollapseTransitionActive = false;
    blackout.setVisible(false).setAlpha(0);
    scene.interactionRuntime?.refresh?.();
    scene.gameHud?.render?.();
    scene.saveSession?.();
  }

  promptZone.on("pointerdown", (pointer, _x, _y, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    if (candidate && activateCandidate()) scene.suppressNextInteract = true;
  });
  globalThis.window?.addEventListener?.("keydown", onKeyboard);
  scene.events.on("update", update);
  const unsubscribe = localization?.subscribe?.(() => {
    if (runActive && arenaId) {
      const definition = getWildAtollArenaDefinition(arenaId);
      setTitles(definition.segmentKey, definition.arenaKey);
    }
    renderPrompt();
  });

  update();

  return {
    getState: () => ({
      mountedWorldId,
      active: runActive,
      runSeed,
      arenaId,
      segmentId: arenaId ? getWildAtollArenaDefinition(arenaId).segmentId : null,
      candidateId: candidate?.id ?? null,
      availableExitIds: arenaId ? getWildAtollArenaDefinition(arenaId).exits.map((exit) => exit.id) : [],
      activeResourceIds: [...activeResourceIds],
      collapseRecoveryActive,
    }),
    getAuthoringInstances: () => arenaAuthoringInstances.map((instance) => ({
      ...instance,
      anchor: { ...instance.anchor },
      bounds: { ...instance.bounds },
      visualBasePosition: { ...instance.visualBasePosition },
      targets: [...instance.targets],
    })),
    startArena(nextArenaId, { seed = `${Date.now()}` } = {}) {
      if (getWorldId() !== WORLD_IDS.atoll) return { status: "wrong-world", started: false };
      observedWorldId = WORLD_IDS.atoll;
      mountedWorldId = WORLD_IDS.atoll;
      runActive = true;
      runSeed = String(seed);
      renderArena(nextArenaId);
      return { status: "started", started: true, arenaId: nextArenaId };
    },
    beginCollapseRecovery,
    isCollapseRecoveryActive: () => collapseRecoveryActive,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      scene.events.off("update", update);
      globalThis.window?.removeEventListener?.("keydown", onKeyboard);
      restoreSleepTimeScale();
      collapseDelay?.remove?.(false);
      collapseDelay = null;
      scene.tweens.killTweensOf(blackout);
      scene.atollCollapseTransitionActive = false;
      clearArenaPresentation({ removeResourceState: true, resetCandidate: false });
      observedWorldId = null;
      mountedWorldId = null;
      runActive = false;
      arenaId = null;
      candidate = null;
      promptZone.destroy();
      promptBackground.destroy();
      promptText.destroy();
      segmentTitleText.destroy();
      arenaTitleText.destroy();
      blackout.destroy();
    },
  };
}

function createCave(scene, centerX, topY) {
  const left = centerX - TILE_SIZE;
  const parts = [
    [0, 0, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.transport.topLeft],
    [1, 0, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.transport.topRight],
    [0, 1, OUTDOOR_TEXTURE_KEY, OUTDOOR_FRAMES.transport.entranceLeft],
    [1, 1, OUTDOOR_TEXTURE_KEY, OUTDOOR_FRAMES.transport.entranceRight],
  ];
  return parts.map(([x, y, textureKey, frame]) => scene.add.image(
    left + x * TILE_SIZE,
    topY + y * TILE_SIZE,
    textureKey,
    frame,
  ).setOrigin(0).setDepth(560 + topY + 2 * TILE_SIZE));
}

function isEditableTarget(target) {
  const tag = target?.tagName?.toLowerCase?.();
  return tag === "input" || tag === "textarea" || tag === "select" || Boolean(target?.isContentEditable);
}
