import { HUD_COLORS, HUD_DEPTH } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import {
  createWildAtollArenaResources,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  WILD_ATOLL_ARENAS,
  WILD_ATOLL_STARTER_ARENAS,
} from "./wildAtollDomain.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "./worldLocationConfig.js";
import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
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
  let runActive = false;
  let runSeed = "";
  let arenaId = null;
  let candidate = null;
  let arenaVisuals = [];
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
    clearKnownStarterResourceState();
    renderArena(WILD_ATOLL_ARENAS.root);
    showMessage("hud:atoll.arrival");
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
    clearKnownStarterResourceState();
    const result = transitionWorld(WORLD_IDS.nest, NEST_RETURN_SPAWN);
    if (!result?.transitioned) return false;
    mountedWorldId = null;
    runActive = false;
    arenaId = null;
    candidate = null;
    setTitlesVisible(false);
    if (!silent) showMessage("hud:atoll.leftRun");
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

  function clearArenaPresentation({ removeResourceState = true } = {}) {
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
    for (const object of arenaVisuals) object.destroy?.();
    arenaVisuals = [];
    scene.interactionRuntime?.resetCandidate?.();
  }

  function clearKnownStarterResourceState() {
    const nodes = scene.sessionState?.gameplay?.resourceNodes;
    if (!nodes) return;
    for (const knownArenaId of WILD_ATOLL_STARTER_ARENAS) {
      const definitions = createWildAtollArenaResources("cleanup", "current", knownArenaId);
      for (const definition of definitions) delete nodes[definition.id];
    }
  }

  function createExitVisual(exit) {
    const point = getWildAtollExitPoint(exit.direction, TILE_SIZE);
    if (exit.kind === "segment") {
      arenaVisuals.push(...createCave(scene, point.x, point.y - TILE_SIZE));
      return;
    }
    if (exit.kind === "teleport") {
      const glow = scene.add.graphics().setPosition(point.x, point.y).setDepth(570 + point.y);
      glow.fillStyle(0xffffff, 0.16).fillCircle(0, 0, 8);
      glow.fillStyle(0xeef8ff, 0.42).fillCircle(0, 0, 5);
      glow.fillStyle(0xffffff, 1).fillCircle(0, 0, 2);
      arenaVisuals.push(glow);
      return;
    }
    arenaVisuals.push(...createTrailExit(scene, point.x, point.y));
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
      showMessage(exit.blockedMessageKey);
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
    if (worldId !== mountedWorldId) {
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
    if (!mountedWorldId || collapseRecoveryActive) {
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
        ? { kind: "enter", id: "enter", labelKey: "hud:atoll.promptEnter", distance }
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
      candidateId: candidate?.id ?? null,
      availableExitIds: arenaId ? getWildAtollArenaDefinition(arenaId).exits.map((exit) => exit.id) : [],
      activeResourceIds: [...activeResourceIds],
      collapseRecoveryActive,
    }),
    startArena(nextArenaId, { seed = `${Date.now()}` } = {}) {
      if (getWorldId() !== WORLD_IDS.atoll) return { status: "wrong-world", started: false };
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
      restoreSleepTimeScale();
      collapseDelay?.remove?.(false);
      collapseDelay = null;
      scene.tweens.killTweensOf(blackout);
      scene.atollCollapseTransitionActive = false;
      unmountCurrentWorld();
      unsubscribe?.();
      scene.events.off("update", update);
      globalThis.window?.removeEventListener?.("keydown", onKeyboard);
      promptZone.destroy();
      promptBackground.destroy();
      promptText.destroy();
      segmentTitleText.destroy();
      arenaTitleText.destroy();
      blackout.destroy();
    },
  };
}

function createTrailExit(scene, centerX, centerY) {
  const ground = scene.add.graphics().setPosition(centerX, centerY).setDepth(555 + centerY);
  ground.fillStyle(0x2a211b, 0.92).fillRect(-18, -7, 36, 14);
  ground.fillStyle(0x735a3d, 1).fillRect(-14, -5, 28, 10);
  ground.fillStyle(0xb9a06a, 0.9).fillRect(-3, -6, 6, 12);
  ground.lineStyle(1, 0xd8cfaa, 0.75).strokeRect(-18.5, -7.5, 37, 15);
  const leftPost = scene.add.graphics().setPosition(centerX - 22, centerY).setDepth(556 + centerY);
  leftPost.fillStyle(0x3c3328, 1).fillRect(-2, -10, 4, 20);
  leftPost.fillStyle(0xa18c67, 1).fillRect(-3, -10, 6, 4);
  const rightPost = scene.add.graphics().setPosition(centerX + 22, centerY).setDepth(556 + centerY);
  rightPost.fillStyle(0x3c3328, 1).fillRect(-2, -10, 4, 20);
  rightPost.fillStyle(0xa18c67, 1).fillRect(-3, -10, 6, 4);
  return [ground, leftPost, rightPost];
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
