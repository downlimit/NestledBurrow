import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from "./fullscreen.js";
import {
  FULLSCREEN_HIT_AREA,
  FULLSCREEN_PANEL_AREA,
  HUD_COLORS,
  HUD_DEPTH,
  compactBuildLabel,
  drawBitmapTextInto,
  drawFullscreenIcon,
  isPointInRect,
  renderFullscreenIcon,
} from "./hud.js";
import { GAME_WIDTH } from "./worldConfig.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";
import { createInventoryRuntime, INVENTORY_HUD_AREA, INVENTORY_SLOT_AREAS } from "./inventoryRuntime.js";
import { createCombatLoadoutRuntime } from "./combatLoadoutRuntime.js";
import { createLoadoutDragCoordinator } from "./loadoutDragCoordinator.js";
import {
  COMBAT_PANEL_AREA,
  COMBAT_SLOT_DEFINITIONS,
  createInventoryModeRuntime,
  INVENTORY_MODES,
} from "./inventoryModeRuntime.js";
import { drawCoinSprite } from "./coinVisual.js";
import { worldPointFromPointer } from "./worldThrowDirection.js";
import {
  createInventoryGainPresentation,
  INVENTORY_GAIN_DROP_MS,
  INVENTORY_GAIN_HOLD_MS,
} from "./inventoryGainPresentation.js";
import { createTransientMessageRuntime } from "./transientMessageRuntime.js";
import { createThrowAimIndicator } from "./throwAimIndicator.js";
import { NEED_FLOW_PROFILE_BY_ARROWS } from "./presentationTuning.js";

export const OPTIONS_HIT_AREA = Object.freeze({ x: 8, y: 4, width: 74, height: 30 });
export const FULLSCREEN_HUD_AREA = Object.freeze({ x: GAME_WIDTH - 34, y: 4, width: 30, height: 30 });
export const COIN_HUD_AREA = Object.freeze({
  x: GAME_WIDTH - 82,
  y: FULLSCREEN_PANEL_AREA.y,
  width: 46,
  height: FULLSCREEN_PANEL_AREA.height,
});
export const CLOCK_HUD_AREA = Object.freeze({ x: 120, y: 4, width: 80, height: 24 });
export const TIME_CONTROL_SPEEDS = Object.freeze([0, 1, 4, 16]);
export const TIME_CONTROL_HUD_AREA = Object.freeze({ x: 120, y: 29, width: 80, height: 13 });
export const TIME_CONTROL_AREAS = Object.freeze(TIME_CONTROL_SPEEDS.map((_speed, index) => Object.freeze({
  x: TIME_CONTROL_HUD_AREA.x + index * 20,
  y: TIME_CONTROL_HUD_AREA.y,
  width: 19,
  height: TIME_CONTROL_HUD_AREA.height,
})));
export const OPTIONS_PANEL_AREA = Object.freeze({ x: 8, y: 34, width: 228, height: 80 });
export const LANGUAGE_HIT_AREA = Object.freeze({ x: 154, y: 40, width: 70, height: 28 });
export const NEW_GAME_HIT_AREA = Object.freeze({ x: 146, y: 72, width: 78, height: 30 });
export const SOUND_SLIDER_RECTS = Object.freeze({
  master: Object.freeze({ x: 68, y: 42, width: 66, height: 14 }),
  music: Object.freeze({ x: 68, y: 60, width: 66, height: 14 }),
  effects: Object.freeze({ x: 68, y: 78, width: 66, height: 14 }),
});
export const OPTIONS_BUILD_LABEL = Object.freeze({ x: 14, y: 102 });
export const RESOURCE_HUD_AREA = INVENTORY_HUD_AREA;
export const NEEDS_HUD_AREA = Object.freeze({ x: 252, y: 38, width: 60, height: 68 });
export const ENERGY_HUD_AREA = NEEDS_HUD_AREA;
export const NEED_ROW_IDS = Object.freeze(["novelty", "energy", "satiety", "toilet", "lustre", "dialogue"]);
export const NEED_ROW_SYMBOLS = Object.freeze(["N", "E", "S", "T", "L", "D"]);
export const NEED_ROW_AREAS = Object.freeze(NEED_ROW_IDS.map((_id, index) => Object.freeze({
  x: NEEDS_HUD_AREA.x,
  y: NEEDS_HUD_AREA.y + 4 + index * 10,
  width: NEEDS_HUD_AREA.width,
  height: 10,
})));
export const NEED_TOOLTIP_AREA = Object.freeze({ x: 32, y: 42, width: 174, height: 54 });
export const NEW_GAME_CONFIRM_PANEL = Object.freeze({ x: 24, y: 36, width: GAME_WIDTH - 48, height: 78 });
export const NEW_GAME_CONFIRM_HIT_AREA = Object.freeze({ x: 44, y: 82, width: 96, height: 26 });
export const NEW_GAME_CANCEL_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 140, y: 82, width: 96, height: 26 });

export function shouldShakeEnergyAfterInteraction({ mutated, energyBefore, currentEnergy, maximumEnergy }) {
  return Boolean(mutated)
    && Number(currentEnergy) < Number(energyBefore)
    && Number(maximumEnergy) > 0
    && Number(currentEnergy) / Number(maximumEnergy) < 0.15;
}

export function isEnergyCritical(currentEnergy, maximumEnergy) {
  return Number(maximumEnergy) > 0 && Number(currentEnergy) / Number(maximumEnergy) < 0.15;
}

export function needFlowPulseAlpha(arrows, nowMs, seed = 0) {
  const requestedArrows = Math.round(Number(arrows));
  if (!Number.isFinite(requestedArrows) || requestedArrows <= 0) return 0;
  const intensity = Math.min(3, requestedArrows);
  const profile = NEED_FLOW_PROFILE_BY_ARROWS[intensity];
  const time = Number(nowMs) || 0;
  const phaseOffset = needFlowPhaseOffset(seed, profile.cycleMs);
  const phase = ((time + phaseOffset) % profile.cycleMs + profile.cycleMs) % profile.cycleMs;
  if (phase < profile.fadeInMs) return smoothstep01(phase / profile.fadeInMs) * profile.peakAlpha;
  if (phase < profile.fadeInMs + profile.peakHoldMs) return profile.peakAlpha;
  if (phase < profile.fadeInMs + profile.peakHoldMs + profile.fadeOutMs) {
    const fadePhase = (phase - profile.fadeInMs - profile.peakHoldMs) / profile.fadeOutMs;
    return (1 - smoothstep01(fadePhase)) * profile.peakAlpha;
  }
  return 0;
}

export function needFlowPhaseOffset(seed, cycleMs) {
  const text = String(seed ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0) / 0x100000000 * cycleMs;
}

function smoothstep01(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function createGameHud(scene, options) {
  const {
    buildId,
    localization,
    gameContainer,
    onLanguageChange = () => {},
    onNewGame = () => {},
    onConfirmationChange = () => {},
    onOptionsChange = () => {},
    onTimeScaleChange = () => {},
    onDroppedItemCollision = () => {},
    onCoinDrop = () => ({ status: "unavailable", mutated: false }),
    playEffect = () => {},
    audioSettings,
    getGameplayState = () => null,
    isCoarsePointer = () => false,
  } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const energyBarGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0);
  const energyArrowGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 3).setScrollFactor(0);
  const coinDragGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 50).setScrollFactor(0).setVisible(false);
  const coinDeltaText = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#efbd79",
  }).setDepth(HUD_DEPTH + 51).setScrollFactor(0).setVisible(false);
  const buildLabel = compactBuildLabel(buildId);

  let destroyed = false;
  let suppressed = false;
  let confirmingNewGame = false;
  let fullscreenHud = null;
  let fullscreenHandler = null;
  let languageLatched = false;
  let optionsOpen = false;
  let gameplayOverlayActive = false;
  let draggingChannel = null;
  let energyFillHeight = 0;
  let energyRatio = 0;
  let energyShakeCount = 0;
  let energyShakeActive = false;
  let energyCritical = false;
  let energyFlow = null;
  let energyArrowState = null;
  let hoveredNeedId = null;
  let pinnedNeedId = null;
  let needsRowsState = [];
  let coinDragCandidate = null;
  let coinDragging = false;
  let coinDeltaStartedAtMs = 0;
  let coinDeltaAmount = 0;

  let inventoryHud = null;
  let combatLoadoutHud = null;
  let inventoryGainPresentation = null;
  let inventoryModeHud = null;
  const isInventoryModeSuppressed = () => suppressed
    || confirmingNewGame
    || optionsOpen
    || gameplayOverlayActive
    || Boolean(scene.interactionRuntime?.isDialogueActive?.())
    || Boolean(scene.merchantRuntime?.isActive?.())
    || Boolean(scene.buildMode?.isActive?.())
    || Boolean(getGameplayState?.()?.sleeping)
    || Boolean(scene.facilityRuntime?.isUsing?.())
    || Boolean(scene.cookingRuntime?.isActive?.());
  const transientMessages = createTransientMessageRuntime(scene, { localization });
  const throwAimIndicator = createThrowAimIndicator(scene, {
    getPlayerCharacter: () => scene.playerCharacter ?? null,
  });
  const persistInventoryMutation = () => {
    inventoryHud?.render?.();
    combatLoadoutHud?.render?.();
    scene.interactionRuntime?.refresh?.();
    scene.saveSession?.();
  };
  const loadoutDragCoordinator = createLoadoutDragCoordinator(scene, {
    getGameplayState,
    onPersistentMutation: persistInventoryMutation,
    playEffect,
    onWorldDrop: (source, pointer) => inventoryHud?.dropLoadoutSlot?.(
      source.panel,
      source.index,
      worldPointFromPointer(scene, pointer),
    ),
    onAimTarget: (pointer) => {
      if (pointer) throwAimIndicator.show(worldPointFromPointer(scene, pointer));
      else throwAimIndicator.hide();
    },
  });
  inventoryHud = createInventoryRuntime(scene, {
    getGameplayState,
    getPlayerCharacter: () => scene.playerCharacter ?? null,
    isSuppressed: isInventoryModeSuppressed,
    onPersistentMutation: persistInventoryMutation,
    onWorldItemCollision: onDroppedItemCollision,
    playEffect,
    onInventoryGain: (result) => inventoryGainPresentation?.notify?.(result),
    isSlotItemHidden: (slotIndex, itemId) => inventoryGainPresentation?.isSlotPending?.(slotIndex, itemId) ?? false,
    isHeldItemSuppressed: () => Boolean(scene.meleeRuntime?.isAttacking?.()),
    setThrowAimTarget: (target) => {
      if (target) throwAimIndicator.show(target);
      else throwAimIndicator.hide();
    },
    loadoutDragCoordinator,
    isCombatMode: () => inventoryModeHud?.getState?.().stableMode === INVENTORY_MODES.COMBAT,
  });
  combatLoadoutHud = createCombatLoadoutRuntime(scene, {
    slotDefinitions: COMBAT_SLOT_DEFINITIONS,
    getGameplayState,
    isSuppressed: isInventoryModeSuppressed,
    dragCoordinator: loadoutDragCoordinator,
  });
  inventoryGainPresentation = createInventoryGainPresentation(scene, {
    slotAreas: INVENTORY_SLOT_AREAS,
    getGameplayState,
    onChange: () => inventoryHud?.render(),
    presentation: inventoryHud.presentation,
  });
  inventoryModeHud = createInventoryModeRuntime(scene, {
    inventoryPresentation: inventoryHud.presentation,
    combatPresentation: combatLoadoutHud.presentation,
    loadoutDragCoordinator,
    isSuppressed: isInventoryModeSuppressed,
    onStateChange: () => {
      const mode = inventoryModeHud?.getState?.();
      if (mode?.stableMode === INVENTORY_MODES.COMBAT && !mode.altDown) inventoryHud?.clearSelection?.();
      scene.syncGameplayHudVisibility?.();
      scene.interactionRuntime?.refresh?.();
    },
  });

  const optionsHit = createZone(scene, OPTIONS_HIT_AREA);
  const coinHit = createZone(scene, COIN_HUD_AREA);
  const optionsPanelHit = createZone(scene, OPTIONS_PANEL_AREA).disableInteractive();
  const languageHit = createZone(scene, LANGUAGE_HIT_AREA).disableInteractive();
  const sliderHits = Object.fromEntries(Object.entries(SOUND_SLIDER_RECTS).map(([channel, rect]) => [channel, createZone(scene, rect).disableInteractive()]));
  const newGameHit = createZone(scene, NEW_GAME_HIT_AREA).disableInteractive();
  const confirmHit = createZone(scene, NEW_GAME_CONFIRM_HIT_AREA).disableInteractive();
  const cancelHit = createZone(scene, NEW_GAME_CANCEL_HIT_AREA).disableInteractive();
  const needHits = NEED_ROW_AREAS.map((rect, index) => {
    const zone = createZone(scene, rect).disableInteractive();
    zone.on("pointerover", () => { if (!isCoarsePointer()) { hoveredNeedId = NEED_ROW_IDS[index]; render(); } });
    zone.on("pointerout", () => { if (!isCoarsePointer()) { hoveredNeedId = null; render(); } });
    zone.on("pointerdown", (pointer, _x, _y, event) => {
      stop(pointer, event);
      if (!isCoarsePointer()) return;
      const needId = NEED_ROW_IDS[index];
      pinnedNeedId = pinnedNeedId === needId ? null : needId;
      render();
    });
    return zone;
  });
  const timeControlHits = TIME_CONTROL_AREAS.map((rect, index) => {
    const zone = createZone(scene, rect).disableInteractive();
    zone.on("pointerdown", (pointer, _x, _y, event) => {
      stop(pointer, event);
      onTimeScaleChange(TIME_CONTROL_SPEEDS[index]);
      render();
    });
    return zone;
  });
  const onScenePointerDown = (pointer) => {
    if (!isCoarsePointer() || !pinnedNeedId) return;
    const point = { x: pointer?.x, y: pointer?.y };
    if (NEED_ROW_AREAS.some((rect) => isPointInRect(point.x, point.y, rect))) return;
    if (isPointInRect(point.x, point.y, NEED_TOOLTIP_AREA)) return;
    pinnedNeedId = null;
    render();
  };
  const onCoinPointerDown = (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (optionsOpen || gameplayOverlayActive || confirmingNewGame || Number(getGameplayState?.()?.coins ?? 0) < 1) return;
    coinDragCandidate = { x: pointer.x, y: pointer.y };
    coinDragging = false;
  };
  const onCoinPointerMove = (pointer) => {
    if (!coinDragCandidate) return;
    if (!coinDragging && Math.hypot(pointer.x - coinDragCandidate.x, pointer.y - coinDragCandidate.y) >= 3) {
      coinDragging = true;
    }
    coinDragGraphics.clear().setVisible(coinDragging);
    if (coinDragging) {
      drawCoinSprite(coinDragGraphics, Math.round(pointer.x), Math.round(pointer.y));
      throwAimIndicator.show(worldPointFromPointer(scene, pointer));
    }
  };
  const finishCoinDrag = (pointer) => {
    if (!coinDragCandidate) return;
    const shouldDrop = coinDragging && !scene.isHudPoint?.(pointer.x, pointer.y);
    coinDragCandidate = null;
    coinDragging = false;
    coinDragGraphics.clear().setVisible(false);
    throwAimIndicator.hide();
    if (shouldDrop) {
      const result = onCoinDrop(worldPointFromPointer(scene, pointer));
      if (result?.mutated) showCoinDelta(-Math.max(1, Number(result.value) || 1));
    }
    render();
  };
  coinHit.on("pointerdown", onCoinPointerDown);
  scene.input.on("pointerdown", onScenePointerDown);
  scene.input.on("pointermove", onCoinPointerMove);
  scene.input.on("pointerup", finishCoinDrag);
  scene.input.on("pointercancel", finishCoinDrag);

  const optionsText = createText(scene);
  const languageText = createText(scene);
  const newGameText = createText(scene);
  const confirmMessageText = createText(scene, { align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } });
  const confirmText = createText(scene);
  const cancelText = createText(scene);
  const soundTexts = {
    master: createText(scene),
    music: createText(scene),
    effects: createText(scene),
  };
  const clockText = createText(scene, { fontSize: "8px" });
  const coinText = createText(scene, { fontSize: "8px" });
  const needTooltipText = createText(scene, { fontSize: "8px", wordWrap: { width: NEED_TOOLTIP_AREA.width - 12 } });

  function stop(pointer, event) {
    event?.stopPropagation?.();
    pointer?.event?.stopPropagation?.();
  }

  function getNextLocale() {
    const locales = localization.getSupportedLocales();
    const current = localization.getLanguage();
    const index = locales.findIndex((locale) => locale.code === current);
    return locales[(index + 1) % locales.length] ?? locales[0];
  }

  async function toggleLanguage() {
    if (languageLatched || confirmingNewGame || !optionsOpen) return;
    languageLatched = true;
    const next = getNextLocale();
    await localization.changeLanguage(next.code);
    onLanguageChange(localization.getLanguage());
    render();
  }

  optionsHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (confirmingNewGame) return;
    optionsOpen = !optionsOpen;
    onOptionsChange(optionsOpen);
    render();
  });
  optionsPanelHit.on("pointerdown", stop);
  optionsPanelHit.on("pointerup", stop);
  for (const [channel, zone] of Object.entries(sliderHits)) {
    zone.on("pointerdown", (pointer, localX, _localY, event) => { stop(pointer, event); draggingChannel = channel; setSliderValue(channel, localX); });
    zone.on("pointermove", (pointer, localX, _localY, event) => { stop(pointer, event); if (draggingChannel === channel && pointer.isDown) setSliderValue(channel, localX); });
    zone.on("pointerup", (pointer, localX, _localY, event) => { stop(pointer, event); if (draggingChannel === channel) setSliderValue(channel, localX); draggingChannel = null; });
    zone.on("pointerout", () => { draggingChannel = null; });
  }

  languageHit.on("pointerdown", (pointer, _x, _y, event) => { stop(pointer, event); void toggleLanguage(); });
  languageHit.on("pointerup", () => { languageLatched = false; });
  languageHit.on("pointerout", () => { languageLatched = false; });
  languageHit.on("pointercancel", () => { languageLatched = false; });

  newGameHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (confirmingNewGame || !optionsOpen) return;
    confirmingNewGame = true;
    optionsOpen = false;
    onOptionsChange(false);
    onConfirmationChange(true);
    render();
  });
  confirmHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (!confirmingNewGame) return;
    confirmingNewGame = false;
    onConfirmationChange(false);
    onNewGame();
  });
  cancelHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (!confirmingNewGame) return;
    confirmingNewGame = false;
    onConfirmationChange(false);
    render();
  });

  if (isFullscreenSupported(gameContainer)) {
    fullscreenHud = drawFullscreenIcon(scene, isFullscreenActive(document, gameContainer));
    fullscreenHandler = (pointer, _localX, _localY, event) => {
      stop(pointer, event);
      void toggleFullscreen({ documentRef: document, element: gameContainer }).then(() => render());
    };
    fullscreenHud.hit.on("pointerdown", fullscreenHandler);
  }

  function renderButton(rect, textObject, labelText) {
    graphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(rect.x + 3, rect.y + 3, rect.width - 6, rect.height - 6);
    graphics.lineStyle(1, HUD_COLORS.border, 0.9).strokeRect(rect.x + 3.5, rect.y + 3.5, rect.width - 7, rect.height - 7);
    setManagedTextStyle(textObject, scene, textStyle()).setText(labelText).setVisible(true);
    textObject.setPosition(Math.round(rect.x + (rect.width - textObject.width) / 2), Math.round(rect.y + (rect.height - textObject.height) / 2));
  }

  function showCoinDelta(amount) {
    const value = Math.trunc(Number(amount) || 0);
    if (value === 0) return;
    coinDeltaAmount = coinDeltaText.visible && Math.sign(coinDeltaAmount) === Math.sign(value)
      ? coinDeltaAmount + value
      : value;
    scene.tweens.killTweensOf(coinDeltaText);
    coinDeltaStartedAtMs = scene.time?.now ?? 0;
    setManagedTextStyle(coinDeltaText, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: coinDeltaAmount > 0 ? "#fff3a6" : "#efbd79",
    }).setText(`${coinDeltaAmount > 0 ? "+" : ""}${coinDeltaAmount}`)
      .setPosition(COIN_HUD_AREA.x - 15, COIN_HUD_AREA.y + 10)
      .setAlpha(1)
      .setVisible(true);
    scene.tweens.add({
      targets: coinDeltaText,
      x: COIN_HUD_AREA.x - 3,
      alpha: 0,
      delay: INVENTORY_GAIN_HOLD_MS,
      duration: INVENTORY_GAIN_DROP_MS,
      ease: "Linear",
      onComplete: () => {
        coinDeltaAmount = 0;
        coinDeltaText.setVisible(false);
      },
    });
  }

  function hideManagedObjects() {
    for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, coinText, needTooltipText, ...Object.values(soundTexts)]) text.setVisible(false);
  }

  function render() {
    if (destroyed) return;
    inventoryModeHud.syncSuppression();
    graphics.clear();
    energyBarGraphics.clear();
    energyArrowGraphics.clear();
    hideManagedObjects();
    if (suppressed) {
      fullscreenHud?.graphics?.clear?.();
      inventoryHud.render();
      combatLoadoutHud.render();
      updateInteractivity();
      return;
    }
    if (confirmingNewGame) renderConfirmation();
    else renderNormalHud();
    inventoryHud.render();
    combatLoadoutHud.render();
    updateInteractivity();
    if (fullscreenHud) renderFullscreenIcon(fullscreenHud.graphics, isFullscreenActive(document, gameContainer));
  }

  function renderNormalHud() {
    renderButton(OPTIONS_HIT_AREA, optionsText, localization.t("hud:options.title"));
    const gameplay = getGameplayState?.();
    if (gameplay) {
      renderClock(gameplay);
      if (!optionsOpen && !gameplayOverlayActive) {
        renderNeeds(gameplay);
        if (!gameplay.sleeping) renderTimeControls(gameplay);
        renderCoinBalance(gameplay);
      }
    }
    if (optionsOpen) renderOptionsPanel();
  }

  function renderClock(gameplay) {
    graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(CLOCK_HUD_AREA.x, CLOCK_HUD_AREA.y, CLOCK_HUD_AREA.width, CLOCK_HUD_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 0.8).strokeRect(CLOCK_HUD_AREA.x + 0.5, CLOCK_HUD_AREA.y + 0.5, CLOCK_HUD_AREA.width - 1, CLOCK_HUD_AREA.height - 1);
    setManagedTextStyle(clockText, scene, textStyle({ fontSize: "8px" })).setText(gameplay.clock ?? "").setVisible(true);
    clockText.setPosition(Math.round((GAME_WIDTH - clockText.width) / 2), Math.round(CLOCK_HUD_AREA.y + (CLOCK_HUD_AREA.height - clockText.height) / 2));
  }

  function renderCoinBalance(gameplay) {
    graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(COIN_HUD_AREA.x, COIN_HUD_AREA.y, COIN_HUD_AREA.width, COIN_HUD_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 0.8).strokeRect(COIN_HUD_AREA.x + 0.5, COIN_HUD_AREA.y + 0.5, COIN_HUD_AREA.width - 1, COIN_HUD_AREA.height - 1);
    drawCoinSprite(
      graphics,
      COIN_HUD_AREA.x + COIN_HUD_AREA.width - 10,
      Math.round(COIN_HUD_AREA.y + COIN_HUD_AREA.height / 2) - 1,
    );
    setManagedTextStyle(coinText, scene, textStyle({ fontSize: "8px" })).setText(String(gameplay.coins ?? 0)).setVisible(true);
    coinText.setPosition(COIN_HUD_AREA.x + COIN_HUD_AREA.width - 18 - coinText.width, Math.round(COIN_HUD_AREA.y + (COIN_HUD_AREA.height - coinText.height) / 2));
  }

  function renderTimeControls(gameplay) {
    const selectedScale = Number(gameplay.selectedTimeScale ?? gameplay.timeScale ?? 1);
    for (let index = 0; index < TIME_CONTROL_AREAS.length; index += 1) {
      const rect = TIME_CONTROL_AREAS[index];
      const active = TIME_CONTROL_SPEEDS[index] === selectedScale;
      graphics.fillStyle(active ? HUD_COLORS.mid : HUD_COLORS.panel, active ? 0.96 : 0.78)
        .fillRect(rect.x, rect.y, rect.width, rect.height);
      graphics.lineStyle(1, active ? HUD_COLORS.light : HUD_COLORS.border, active ? 1 : 0.8)
        .strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
      drawTimeControlIcon(graphics, rect, index, active ? HUD_COLORS.panel : HUD_COLORS.light);
    }
  }

  function renderNeeds(gameplay) {
    energyBarGraphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(NEEDS_HUD_AREA.x, NEEDS_HUD_AREA.y, NEEDS_HUD_AREA.width, NEEDS_HUD_AREA.height);
    energyBarGraphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(NEEDS_HUD_AREA.x + 0.5, NEEDS_HUD_AREA.y + 0.5, NEEDS_HUD_AREA.width - 1, NEEDS_HUD_AREA.height - 1);
    const values = {
      novelty: gameplay.needs?.novelty,
      energy: Number(gameplay.currentEnergy) / Number(gameplay.maximumEnergy) * 100,
      satiety: gameplay.needs?.satiety,
      toilet: gameplay.needs?.toilet,
      lustre: gameplay.needs?.lustre,
      dialogue: gameplay.needs?.dialogue,
    };
    const flows = { ...gameplay.needsFlow, energy: gameplay.energyFlow };
    needsRowsState = NEED_ROW_IDS.map((id, index) => {
      const rect = NEED_ROW_AREAS[index];
      const ratio = Math.min(1, Math.max(0, Number(values[id]) / 100 || 0));
      const flow = flows[id] ?? null;
      drawBitmapTextInto(energyBarGraphics, rect.x + 3, rect.y + 1, NEED_ROW_SYMBOLS[index], { shadow: 0 });
      energyBarGraphics.fillStyle(HUD_COLORS.shadow, 1).fillRect(rect.x + 11, rect.y + 2, 25, 6);
      const critical = id === "energy" && ratio < 0.15;
      const fillWidth = ratio > 0 ? Math.max(1, Math.round(23 * ratio)) : 0;
      energyBarGraphics.fillStyle(critical ? 0xd94a4a : HUD_COLORS.mid, 1).fillRect(rect.x + 12, rect.y + 3, fillWidth, 4);
      drawNeedFlow(energyArrowGraphics, rect.x + 40, rect.y + 2, flow, scene.time.now, id);
      return { id, symbol: NEED_ROW_SYMBOLS[index], ratio, flow };
    });
    const energy = needsRowsState[1];
    energyRatio = energy.ratio;
    energyFillHeight = Math.round(54 * energyRatio);
    energyCritical = energy.ratio < 0.15;
    energyFlow = gameplay.energyFlow ?? null;
    energyArrowState = energyFlow;
    if (hoveredNeedId || pinnedNeedId) renderNeedTooltip();
  }

  function renderNeedTooltip() {
    const needId = pinnedNeedId ?? hoveredNeedId;
    graphics.fillStyle(HUD_COLORS.panel, 0.97).fillRect(NEED_TOOLTIP_AREA.x, NEED_TOOLTIP_AREA.y, NEED_TOOLTIP_AREA.width, NEED_TOOLTIP_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(NEED_TOOLTIP_AREA.x + 0.5, NEED_TOOLTIP_AREA.y + 0.5, NEED_TOOLTIP_AREA.width - 1, NEED_TOOLTIP_AREA.height - 1);
    setManagedTextStyle(needTooltipText, scene, textStyle({ fontSize: "7px", wordWrap: { width: NEED_TOOLTIP_AREA.width - 12, useAdvancedWrap: true } }))
      .setText(localization.t(`hud:needs.${needId}.tooltip`))
      .setVisible(true)
      .setPosition(NEED_TOOLTIP_AREA.x + 6, NEED_TOOLTIP_AREA.y + 6);
  }

  function renderOptionsPanel() {
    graphics.fillStyle(HUD_COLORS.panel, 0.97).fillRect(OPTIONS_PANEL_AREA.x, OPTIONS_PANEL_AREA.y, OPTIONS_PANEL_AREA.width, OPTIONS_PANEL_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(OPTIONS_PANEL_AREA.x + 0.5, OPTIONS_PANEL_AREA.y + 0.5, OPTIONS_PANEL_AREA.width - 1, OPTIONS_PANEL_AREA.height - 1);
    const settings = audioSettings?.getSettings?.() ?? { master: 1, music: 0.5, effects: 1 };
    for (const channel of ["master", "music", "effects"]) {
      const rect = SOUND_SLIDER_RECTS[channel];
      const value = Math.min(1, Math.max(0, settings[channel]));
      setManagedTextStyle(soundTexts[channel], scene, textStyle({ fontSize: "8px" })).setText(localization.t(`hud:sound.${channel}`)).setVisible(true).setPosition(14, rect.y + 2);
      graphics.fillStyle(HUD_COLORS.shadow, 0.9).fillRect(rect.x, rect.y + 5, rect.width, 4);
      graphics.fillStyle(HUD_COLORS.mid, 1).fillRect(rect.x, rect.y + 5, Math.round(rect.width * value), 4);
      const knobX = Math.min(rect.x + rect.width - 4, Math.max(rect.x, rect.x + Math.round(rect.width * value) - 2));
      graphics.fillStyle(HUD_COLORS.light, 1).fillRect(knobX, rect.y + 2, 4, 10);
    }
    renderButton(LANGUAGE_HIT_AREA, languageText, localization.getLocale().label);
    renderButton(NEW_GAME_HIT_AREA, newGameText, localization.t("hud:progress.newGame"));
    drawBitmapTextInto(graphics, OPTIONS_BUILD_LABEL.x, OPTIONS_BUILD_LABEL.y, buildLabel);
  }

  function renderConfirmation() {
    graphics.fillStyle(HUD_COLORS.panel, 0.97).fillRect(NEW_GAME_CONFIRM_PANEL.x, NEW_GAME_CONFIRM_PANEL.y, NEW_GAME_CONFIRM_PANEL.width, NEW_GAME_CONFIRM_PANEL.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(NEW_GAME_CONFIRM_PANEL.x + 0.5, NEW_GAME_CONFIRM_PANEL.y + 0.5, NEW_GAME_CONFIRM_PANEL.width - 1, NEW_GAME_CONFIRM_PANEL.height - 1);
    setManagedTextStyle(confirmMessageText, scene, textStyle({ fontSize: "10px", align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } }))
      .setText(localization.t("hud:progress.confirmNewGame"))
      .setVisible(true)
      .setPosition(NEW_GAME_CONFIRM_PANEL.x + 12, NEW_GAME_CONFIRM_PANEL.y + 10);
    renderButton(NEW_GAME_CONFIRM_HIT_AREA, confirmText, localization.t("hud:progress.confirm"));
    renderButton(NEW_GAME_CANCEL_HIT_AREA, cancelText, localization.t("hud:progress.cancel"));
  }

  function updateInteractivity() {
    if (suppressed) {
      optionsHit.disableInteractive();
      coinHit.disableInteractive();
      setOptionsPanelInteractive(false);
      setNeedsInteractive(false);
      setTimeControlsInteractive(false);
      confirmHit.disableInteractive();
      cancelHit.disableInteractive();
      fullscreenHud?.hit?.disableInteractive?.();
      return;
    }
    fullscreenHud?.hit?.setInteractive?.({ useHandCursor: true });
    if (confirmingNewGame) {
      optionsHit.disableInteractive();
      coinHit.disableInteractive();
      setOptionsPanelInteractive(false);
      setNeedsInteractive(false);
      setTimeControlsInteractive(false);
      confirmHit.setInteractive({ useHandCursor: true });
      cancelHit.setInteractive({ useHandCursor: true });
      return;
    }
    optionsHit.setInteractive({ useHandCursor: true });
    if (!optionsOpen && !gameplayOverlayActive && Number(getGameplayState?.()?.coins ?? 0) > 0) {
      coinHit.setInteractive({ useHandCursor: true });
    } else {
      coinHit.disableInteractive();
    }
    setOptionsPanelInteractive(optionsOpen);
    setNeedsInteractive(!optionsOpen && !gameplayOverlayActive);
    setTimeControlsInteractive(!optionsOpen && !gameplayOverlayActive && !getGameplayState?.()?.sleeping);
    confirmHit.disableInteractive();
    cancelHit.disableInteractive();
  }

  function setNeedsInteractive(active) {
    for (const zone of needHits) active ? zone.setInteractive({ useHandCursor: true }) : zone.disableInteractive();
    if (!active) { hoveredNeedId = null; pinnedNeedId = null; }
  }

  function setTimeControlsInteractive(active) {
    for (const zone of timeControlHits) active ? zone.setInteractive({ useHandCursor: true }) : zone.disableInteractive();
  }

  function setOptionsPanelInteractive(active) {
    if (active) {
      optionsPanelHit.setInteractive({ useHandCursor: false });
      languageHit.setInteractive({ useHandCursor: true });
      newGameHit.setInteractive({ useHandCursor: true });
      for (const zone of Object.values(sliderHits)) zone.setInteractive({ useHandCursor: true });
    } else {
      optionsPanelHit.disableInteractive();
      languageHit.disableInteractive();
      newGameHit.disableInteractive();
      for (const zone of Object.values(sliderHits)) zone.disableInteractive();
    }
  }

  function triggerEnergyShake() {
    const baseY = 0;
    scene.tweens.killTweensOf(energyBarGraphics);
    energyBarGraphics.setY(baseY);
    energyShakeCount += 1;
    energyShakeActive = true;
    scene.tweens.add({
      targets: energyBarGraphics,
      y: baseY - 2,
      duration: 45,
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: 1,
      onComplete: () => { energyShakeActive = false; energyBarGraphics.setY(baseY); },
    });
  }

  function setSliderValue(channel, localX) {
    const rect = SOUND_SLIDER_RECTS[channel];
    audioSettings?.setChannel(channel, Math.min(1, Math.max(0, localX / rect.width)));
    render();
  }

  function textStyle(overrides = {}) {
    return { fontFamily: localization.getLocale().fontKey, fontSize: "9px", color: "#f2eadc", ...overrides };
  }

  render();
  const unsubscribe = localization.subscribe(render);

  return {
    render,
    setSuppressed(value) {
      suppressed = Boolean(value);
      if (suppressed) {
        if (confirmingNewGame) onConfirmationChange(false);
        confirmingNewGame = false;
        if (optionsOpen) onOptionsChange(false);
        optionsOpen = false;
      }
      render();
    },
    setGameplayOverlayActive(value) { gameplayOverlayActive = Boolean(value); render(); },
    triggerEnergyShake,
    getResourceState() {
      const gameplay = getGameplayState?.();
      return {
        clockText: clockText.text,
        coinText: coinText.text,
        coinCount: Number(gameplay?.coins ?? 0),
        coinDragging,
        coinDelta: {
          visible: coinDeltaText.visible,
          text: coinDeltaText.text,
          x: coinDeltaText.x,
          alpha: coinDeltaText.alpha,
          startedAtMs: coinDeltaStartedAtMs,
        },
        throwAim: throwAimIndicator.getState(),
        woodText: String(gameplay?.wood ?? 0),
        stoneText: String(gameplay?.stone ?? 0),
        rubyText: String(gameplay?.rubies ?? 0),
        inventory: inventoryHud.getState(),
        inventoryGain: inventoryGainPresentation.getState(),
        transientMessage: transientMessages.getState(),
        kitchenTexts: [],
        icons: { wood: false, stone: false, ruby: false },
        energyRatio,
        energyFillHeight,
        energyCritical,
        energyFlow,
        energyArrowState,
        energyY: energyBarGraphics.y,
        energyBaseY: 0,
        energyShakeCount,
        energyShakeActive,
        needsRows: needsRowsState,
        timeScale: Number(gameplay?.timeScale ?? 1),
        selectedTimeScale: Number(gameplay?.selectedTimeScale ?? gameplay?.timeScale ?? 1),
        hoveredNeedId,
        pinnedNeedId,
        tooltipVisible: needTooltipText.visible,
      };
    },
    isConfirming() { return confirmingNewGame; },
    getLayoutState() {
      return {
        optionsOpen,
        buildLabel,
        buildLabelVisible: optionsOpen && !confirmingNewGame,
        areas: {
          options: OPTIONS_HIT_AREA,
          clock: CLOCK_HUD_AREA,
          coins: COIN_HUD_AREA,
          timeControls: TIME_CONTROL_AREAS,
          resources: INVENTORY_HUD_AREA,
          inventory: INVENTORY_HUD_AREA,
          inventorySlots: INVENTORY_SLOT_AREAS,
          combat: COMBAT_PANEL_AREA,
          combatSlots: COMBAT_SLOT_DEFINITIONS,
          energy: ENERGY_HUD_AREA,
          needs: NEEDS_HUD_AREA,
          needRows: NEED_ROW_AREAS,
          needTooltip: NEED_TOOLTIP_AREA,
          language: LANGUAGE_HIT_AREA,
          newGame: NEW_GAME_HIT_AREA,
          fullscreen: FULLSCREEN_HIT_AREA,
          optionsPanel: OPTIONS_PANEL_AREA,
          confirmation: NEW_GAME_CONFIRM_PANEL,
        },
        timeControlsVisible: !suppressed && !optionsOpen && !gameplayOverlayActive && !getGameplayState?.()?.sleeping,
        inventoryMode: inventoryModeHud.getState(),
        combatLoadout: combatLoadoutHud.getState(),
        loadoutDrag: loadoutDragCoordinator.getState(),
      };
    },
    isPointInHud(x, y) {
      if (suppressed) return false;
      if (confirmingNewGame) return isPointInRect(x, y, NEW_GAME_CONFIRM_PANEL) || Boolean(fullscreenHud && isPointInRect(x, y, FULLSCREEN_HIT_AREA));
      return inventoryHud.isPointInHud(x, y)
        || combatLoadoutHud.isPointInHud(x, y)
        || isPointInRect(x, y, OPTIONS_HIT_AREA)
        || Boolean(!optionsOpen && !gameplayOverlayActive && isPointInRect(x, y, COIN_HUD_AREA))
        || Boolean(!optionsOpen && !gameplayOverlayActive && !getGameplayState?.()?.sleeping
          && TIME_CONTROL_AREAS.some((rect) => isPointInRect(x, y, rect)))
        || Boolean(optionsOpen && isPointInRect(x, y, OPTIONS_PANEL_AREA))
        || Boolean(!optionsOpen && isPointInRect(x, y, NEEDS_HUD_AREA))
        || Boolean((hoveredNeedId || pinnedNeedId) && isPointInRect(x, y, NEED_TOOLTIP_AREA))
        || Boolean(fullscreenHud && isPointInRect(x, y, FULLSCREEN_HIT_AREA));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (confirmingNewGame) onConfirmationChange(false);
      unsubscribe?.();
      scene.input.off("pointerdown", onScenePointerDown);
      scene.input.off("pointermove", onCoinPointerMove);
      scene.input.off("pointerup", finishCoinDrag);
      scene.input.off("pointercancel", finishCoinDrag);
      coinHit.off("pointerdown", onCoinPointerDown);
      inventoryModeHud.destroy();
      combatLoadoutHud.destroy();
      loadoutDragCoordinator.destroy();
      inventoryGainPresentation.destroy();
      inventoryHud.destroy();
      transientMessages.destroy();
      throwAimIndicator.destroy();
      for (const zone of [optionsHit, coinHit, optionsPanelHit, languageHit, ...Object.values(sliderHits), newGameHit, confirmHit, cancelHit, ...needHits, ...timeControlHits]) zone.destroy();
      scene.tweens.killTweensOf(energyBarGraphics);
      scene.tweens.killTweensOf(energyArrowGraphics);
      scene.tweens.killTweensOf(coinDeltaText);
      for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, coinText, needTooltipText, ...Object.values(soundTexts)]) text.destroy();
      energyBarGraphics.destroy();
      energyArrowGraphics.destroy();
      coinDragGraphics.destroy();
      coinDeltaText.destroy();
      graphics.destroy();
      if (fullscreenHud) {
        if (fullscreenHandler) fullscreenHud.hit.off("pointerdown", fullscreenHandler);
        fullscreenHud.hit.destroy();
        fullscreenHud.graphics.destroy();
      }
    },
    getSelectedInventoryItem: () => inventoryHud.getSelectedItem(),
    getCombatActionItem(actionId) {
      const mode = inventoryModeHud.getState();
      if (mode.suppressed || mode.transitioning || mode.altDown || mode.mode !== INVENTORY_MODES.COMBAT) return null;
      return combatLoadoutHud.getActionItem(actionId);
    },
    getInventoryModeState: () => inventoryModeHud.getState(),
    isInventoryInteractionBlocked: () => inventoryModeHud.getState().interactionBlocked,
    selectInventorySlot: (index) => inventoryHud.selectSlot(index),
    dropInventorySlot: (index) => inventoryHud.dropSlot(index),
    spawnWorldItems: (itemId, quantity, origin) => inventoryHud.spawnWorldItems(itemId, quantity, origin),
    notifyInventoryGain: (result) => inventoryGainPresentation.notify(result),
    notifyCoinDelta: (amount) => showCoinDelta(amount),
    showTransientMessage: (keyOrText, options) => transientMessages.show(keyOrText, options),
    getTransientMessageState: () => transientMessages.getState(),
  };
}

function drawEnergyArrow(graphics, x, y, direction, alpha = 0.9) {
  const rows = direction === "up" ? [[2], [1, 2, 3], [0, 1, 2, 3, 4], [2], [2]] : [[2], [2], [0, 1, 2, 3, 4], [1, 2, 3], [2]];
  graphics.fillStyle(direction === "up" ? 0x9fd38a : 0xf2eadc, alpha);
  rows.forEach((columns, row) => columns.forEach((column) => graphics.fillRect(x + column, y + row, 1, 1)));
}

function drawNeedFlow(graphics, x, y, flow, nowMs, seed) {
  if (!flow?.direction) return;
  const requestedArrows = Math.round(Number(flow.arrows));
  if (!Number.isFinite(requestedArrows) || requestedArrows <= 0) return;
  const arrows = Math.min(3, requestedArrows);
  const alpha = needFlowPulseAlpha(arrows, nowMs, seed);
  if (alpha <= 0) return;
  for (let index = 0; index < arrows; index += 1) drawEnergyArrow(graphics, x + index * 5, y, flow.direction, alpha);
}

function drawTimeControlIcon(graphics, rect, index, color) {
  graphics.fillStyle(color, 0.96);
  const centerY = rect.y + 3;
  if (index === 0) {
    graphics.fillRect(rect.x + 7, centerY, 2, 7);
    graphics.fillRect(rect.x + 11, centerY, 2, 7);
    return;
  }
  const count = index;
  const totalWidth = count * 4 + (count - 1);
  const startX = Math.round(rect.x + (rect.width - totalWidth) / 2);
  for (let icon = 0; icon < count; icon += 1) {
    const x = startX + icon * 5;
    graphics.fillRect(x, centerY, 1, 7);
    graphics.fillRect(x + 1, centerY + 1, 1, 5);
    graphics.fillRect(x + 2, centerY + 2, 1, 3);
    graphics.fillRect(x + 3, centerY + 3, 1, 1);
  }
}

function createZone(scene, rect) {
  return scene.add.zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setDepth(HUD_DEPTH + 2)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });
}

function createText(scene, extraStyle = {}) {
  return createManagedText(scene, 0, 0, "", { fontSize: "9px", color: "#f2eadc", ...extraStyle })
    .setDepth(HUD_DEPTH + 3)
    .setScrollFactor(0)
    .setVisible(false);
}
