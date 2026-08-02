import { addInventoryItem, createInventoryItem } from "../inventory/inventoryDomain.js";
import { HUD_COLORS, HUD_DEPTH } from "../ui/hud.js";
import { createManagedText, setManagedTextStyle } from "../ui/textResolution.js";
import {
  applyWildAtollRouteEntry,
  resolveWildAtollGrassDrop,
  wildAtollFrameIndex,
  WILD_ATOLL_ROUTES,
} from "./wildAtollDomain.js";
import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
} from "./worldConfig.js";

const INTERACTION_RADIUS = 28;
const SWORD_REACH = 38;
const GRASS_POSITIONS = Object.freeze([
  [5, 6], [7, 6], [9, 6], [12, 6], [14, 6], [16, 6],
  [6, 9], [8, 10], [10, 9], [12, 10], [14, 9], [16, 10],
  [7, 12], [10, 12], [13, 12], [15, 12],
]);
const ENTRY_POINTS = Object.freeze({
  forecast: Object.freeze({ x: 11 * TILE_SIZE, y: 9 * TILE_SIZE }),
  mist: Object.freeze({ x: 6 * TILE_SIZE, y: 5 * TILE_SIZE }),
  stone: Object.freeze({ x: 16 * TILE_SIZE, y: 5 * TILE_SIZE }),
});
const ROUTE_RETURN_POINT = Object.freeze({ x: 11 * TILE_SIZE, y: 4 * TILE_SIZE });
const ROUTE_SPAWN = Object.freeze({ x: 11 * TILE_SIZE, y: 13 * TILE_SIZE - 6 });
const PROMPT_RECT = Object.freeze({ x: 70, y: 148, width: 180, height: 22 });

export function createWildAtollRuntime(scene, {
  localization,
  getGameplayState = () => scene.sessionState?.gameplay ?? null,
  getPlayerCharacter = () => scene.playerCharacter ?? null,
  getWorldLayout = () => scene.worldLayout ?? null,
  getWorldId = () => scene.sessionState?.currentWorldId ?? null,
  renderHud = () => scene.gameHud?.render?.(),
  notifyInventoryGain = (result) => scene.gameHud?.notifyInventoryGain?.(result),
  spawnWorldItems = (itemId, quantity, origin) => scene.gameHud?.spawnWorldItems?.(itemId, quantity, origin),
  showMessage = (keyOrText, options) => scene.gameHud?.showTransientMessage?.(keyOrText, options),
  saveSession = () => scene.saveSession?.(),
  playEffect = (type) => scene.audioRuntime?.playEffect?.(type),
  syncNeeds = () => {
    scene.syncPlayerEnergyTarget?.();
    scene.gameHud?.render?.();
  },
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
  const titleText = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH - 2).setScrollFactor(0).setVisible(false);

  let active = false;
  let runSeed = "";
  let routeId = WILD_ATOLL_ROUTES.entry;
  let candidate = null;
  let visuals = [];
  let grass = new Map();
  let destroyed = false;
  let runSerial = 0;

  function beginRun() {
    active = true;
    runSerial += 1;
    runSeed = `${Date.now()}-${runSerial}`;
    routeId = WILD_ATOLL_ROUTES.entry;
    candidate = null;
    clearArena();
    renderEntryArena();
    showMessage("hud:atoll.arrival");
  }

  function endRun() {
    active = false;
    candidate = null;
    clearArena();
    renderPrompt();
    titleText.setVisible(false);
  }

  function clearArena() {
    const layout = getWorldLayout();
    for (const entry of grass.values()) layout?.clearWorldObjectCollider?.(entry.id);
    grass.clear();
    visuals.forEach((object) => object.destroy?.());
    visuals = [];
  }

  function renderEntryArena() {
    visuals.push(...createCave(scene, ENTRY_POINTS.mist.x, ENTRY_POINTS.mist.y));
    visuals.push(...createCave(scene, ENTRY_POINTS.stone.x, ENTRY_POINTS.stone.y));
    const marker = createManagedText(scene, ENTRY_POINTS.forecast.x - 3, ENTRY_POINTS.forecast.y - 14, "?", {
      fontSize: "12px",
      color: "#f4d57b",
    }).setDepth(620 + ENTRY_POINTS.forecast.y);
    visuals.push(marker);
    setTitle("hud:atoll.entryTitle");
  }

  function enterRoute(nextRouteId) {
    routeId = nextRouteId;
    candidate = null;
    clearArena();
    visuals.push(...createCave(scene, ROUTE_RETURN_POINT.x, ROUTE_RETURN_POINT.y));
    applyWildAtollRouteEntry(getGameplayState(), nextRouteId);
    if (nextRouteId === WILD_ATOLL_ROUTES.mist) {
      setTitle("hud:atoll.mistTitle");
      showMessage("hud:atoll.mistEntered");
    } else {
      setTitle("hud:atoll.stoneTitle");
      showMessage("hud:atoll.stoneEntered");
    }
    setPlayerPosition(ROUTE_SPAWN);
    spawnGrass();
    syncNeeds();
    saveSession();
  }

  function returnToEntry() {
    routeId = WILD_ATOLL_ROUTES.entry;
    candidate = null;
    clearArena();
    renderEntryArena();
    setPlayerPosition({ x: 11 * TILE_SIZE, y: 11 * TILE_SIZE });
    showMessage("hud:atoll.returned");
  }

  function spawnGrass() {
    const layout = getWorldLayout();
    const detailFrames = OUTDOOR_FRAMES.grassDetails;
    GRASS_POSITIONS.forEach(([tileX, tileY], index) => {
      const id = `atoll-grass-${runSerial}-${index}`;
      const x = tileX * TILE_SIZE;
      const y = tileY * TILE_SIZE;
      const frame = detailFrames[wildAtollFrameIndex(runSeed, index, detailFrames.length)];
      const sprite = scene.add.image(x, y, OUTDOOR_TEXTURE_KEY, frame)
        .setOrigin(0)
        .setTint(routeId === WILD_ATOLL_ROUTES.mist ? 0xb8d9b0 : 0xc7b69b)
        .setDepth(560 + y + TILE_SIZE);
      const rect = Object.freeze({ left: x + 2, top: y + 4, right: x + 14, bottom: y + 15 });
      layout?.setWorldObjectCollider?.(id, rect, "atoll:grass", { atollGrass: true });
      grass.set(id, { id, index, x: x + TILE_SIZE / 2, y: y + TILE_SIZE / 2, sprite, rect });
      visuals.push(sprite);
    });
  }

  function cutGrass(actionId) {
    if (!active || routeId === WILD_ATOLL_ROUTES.entry) return false;
    const item = scene.gameHud?.getCombatActionItem?.(actionId);
    if (item?.id !== "sword") return false;
    if (scene.needsRuntime?.canPerformPhysicalAction?.("sword")?.allowed === false) return false;
    const player = getPlayerCharacter();
    const position = player?.motor?.position;
    const facing = player?.motor?.movement?.facingDirection;
    if (!position || !facing) return false;
    const target = [...grass.values()]
      .map((entry) => {
        const dx = entry.x - position.x;
        const dy = entry.y - position.y;
        const distance = Math.hypot(dx, dy);
        const dot = distance > 0 ? (dx * facing.x + dy * facing.y) / distance : 1;
        return { entry, distance, dot };
      })
      .filter(({ distance, dot }) => distance <= SWORD_REACH && dot >= 0.15)
      .sort((a, b) => a.distance - b.distance || b.dot - a.dot)[0]?.entry;
    if (!target) return false;
    removeGrass(target);
    resolveGrassDrop(target);
    playEffect("melee-log-thud");
    return true;
  }

  function removeGrass(target) {
    getWorldLayout()?.clearWorldObjectCollider?.(target.id);
    grass.delete(target.id);
    target.sprite.destroy();
    visuals = visuals.filter((object) => object !== target.sprite);
  }

  function resolveGrassDrop(target) {
    const itemId = resolveWildAtollGrassDrop({ seed: runSeed, grassIndex: target.index, routeId });
    if (!itemId) return;
    const gameplay = getGameplayState();
    const result = addInventoryItem(gameplay.inventory, createInventoryItem(itemId, 1));
    if (result.mutated) {
      notifyInventoryGain(result);
      renderHud();
      saveSession();
      return;
    }
    spawnWorldItems(itemId, 1, { x: target.x, y: target.y });
  }

  function readForecast() {
    showMessage(localization.t("hud:atoll.forecastText"), { literalText: true, durationMs: 5200 });
  }

  function activateCandidate() {
    if (!candidate) return false;
    if (candidate.id === "forecast") readForecast();
    else if (candidate.id === WILD_ATOLL_ROUTES.mist) enterRoute(WILD_ATOLL_ROUTES.mist);
    else if (candidate.id === WILD_ATOLL_ROUTES.stone) enterRoute(WILD_ATOLL_ROUTES.stone);
    else if (candidate.id === "return") returnToEntry();
    return true;
  }

  function onAction(actionId) {
    if (!active || destroyed) return;
    if (actionId === "space" && candidate && activateCandidate()) return;
    cutGrass(actionId);
  }

  function onPointerDown(pointer, _currentlyOver, event) {
    if (!active || scene.isHudPoint?.(pointer.x, pointer.y)) return;
    const actionId = pointer?.rightButtonDown?.() ? "rmb" : pointer?.leftButtonDown?.() ? "lmb" : null;
    if (!actionId) return;
    if (cutGrass(actionId)) {
      event?.stopPropagation?.();
      pointer?.event?.stopPropagation?.();
    }
  }

  function onKeyboard(event) {
    if (event?.repeat || isEditableTarget(event?.target)) return;
    const actionId = event.code === "Space" ? "space"
      : event.code === "ShiftLeft" || event.code === "ShiftRight" ? "shift"
        : null;
    if (!actionId) return;
    onAction(actionId);
  }

  function update() {
    if (destroyed) return;
    const inNest = getWorldId() === "nest";
    if (inNest && !active) beginRun();
    else if (!inNest && active) endRun();
    if (!active) return;
    candidate = findCandidate();
    renderPrompt();
  }

  function findCandidate() {
    const position = getPlayerCharacter()?.motor?.position;
    if (!position) return null;
    const candidates = routeId === WILD_ATOLL_ROUTES.entry
      ? [
          { id: "forecast", point: ENTRY_POINTS.forecast, labelKey: "hud:atoll.promptForecast" },
          { id: WILD_ATOLL_ROUTES.mist, point: ENTRY_POINTS.mist, labelKey: "hud:atoll.promptMist" },
          { id: WILD_ATOLL_ROUTES.stone, point: ENTRY_POINTS.stone, labelKey: "hud:atoll.promptStone" },
        ]
      : [{ id: "return", point: ROUTE_RETURN_POINT, labelKey: "hud:atoll.promptReturn" }];
    return candidates
      .map((entry) => ({ ...entry, distance: Math.hypot(entry.point.x - position.x, entry.point.y - position.y) }))
      .filter((entry) => entry.distance <= INTERACTION_RADIUS)
      .sort((a, b) => a.distance - b.distance)[0] ?? null;
  }

  function renderPrompt() {
    const visible = active && Boolean(candidate);
    promptBackground.clear().setVisible(visible);
    promptText.setVisible(visible);
    if (!visible) {
      promptZone.disableInteractive();
      return;
    }
    const value = localization.t(candidate.labelKey);
    setManagedTextStyle(promptText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value);
    const width = Math.min(PROMPT_RECT.width, Math.max(96, Math.ceil(promptText.width) + 16));
    const x = Math.round((320 - width) / 2);
    promptBackground
      .fillStyle(HUD_COLORS.panel, 0.94).fillRect(x, PROMPT_RECT.y, width, PROMPT_RECT.height)
      .lineStyle(1, HUD_COLORS.border, 0.95).strokeRect(x + 0.5, PROMPT_RECT.y + 0.5, width - 1, PROMPT_RECT.height - 1);
    promptText.setPosition(Math.round((320 - promptText.width) / 2), PROMPT_RECT.y + 6);
    promptZone.setPosition(x, PROMPT_RECT.y).setSize(width, PROMPT_RECT.height).setInteractive({ useHandCursor: true });
  }

  function setTitle(key) {
    const value = localization.t(key);
    setManagedTextStyle(titleText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value).setPosition(Math.round((320 - titleText.width) / 2), 30).setVisible(true);
  }

  function setPlayerPosition(point) {
    const player = getPlayerCharacter();
    if (!player?.motor) return;
    player.motor.position = { x: point.x, y: point.y };
    player.motor.movement.velocity.x = 0;
    player.motor.movement.velocity.y = 0;
    scene.cameraRuntime?.reset?.(player.motor.position);
  }

  promptZone.on("pointerdown", (pointer, _x, _y, event) => {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
    activateCandidate();
  });
  scene.input.on("pointerdown", onPointerDown);
  globalThis.window?.addEventListener?.("keydown", onKeyboard);
  scene.events.on("update", update);
  const unsubscribe = localization?.subscribe?.(() => {
    if (active) {
      setTitle(routeId === WILD_ATOLL_ROUTES.mist
        ? "hud:atoll.mistTitle"
        : routeId === WILD_ATOLL_ROUTES.stone ? "hud:atoll.stoneTitle" : "hud:atoll.entryTitle");
      renderPrompt();
    }
  });

  update();

  return {
    getState: () => ({
      active,
      runSeed,
      routeId,
      grassRemaining: grass.size,
      candidateId: candidate?.id ?? null,
    }),
    startRoute(route, { seed = `${Date.now()}` } = {}) {
      if (route !== WILD_ATOLL_ROUTES.mist && route !== WILD_ATOLL_ROUTES.stone) {
        throw new Error(`Unknown Wild Atoll route: ${route}`);
      }
      if (!active) beginRun();
      runSeed = String(seed);
      enterRoute(route);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      endRun();
      unsubscribe?.();
      scene.events.off("update", update);
      scene.input.off("pointerdown", onPointerDown);
      globalThis.window?.removeEventListener?.("keydown", onKeyboard);
      promptZone.destroy();
      promptBackground.destroy();
      promptText.destroy();
      titleText.destroy();
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
