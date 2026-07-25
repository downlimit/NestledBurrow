import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from "./fullscreen.js";
import {
  FULLSCREEN_HIT_AREA,
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
import { drawLog, drawRuby, drawStone } from "./resourceVisuals.js";

export const OPTIONS_HIT_AREA = Object.freeze({ x: 8, y: 4, width: 74, height: 30 });
export const FULLSCREEN_HUD_AREA = Object.freeze({ x: GAME_WIDTH - 34, y: 4, width: 30, height: 30 });
export const CLOCK_HUD_AREA = Object.freeze({ x: 120, y: 4, width: 80, height: 24 });
export const OPTIONS_PANEL_AREA = Object.freeze({ x: 8, y: 34, width: 228, height: 80 });
export const LANGUAGE_HIT_AREA = Object.freeze({ x: 154, y: 40, width: 70, height: 28 });
export const NEW_GAME_HIT_AREA = Object.freeze({ x: 146, y: 72, width: 78, height: 30 });
export const SOUND_SLIDER_RECTS = Object.freeze({
  master: Object.freeze({ x: 68, y: 42, width: 66, height: 14 }),
  music: Object.freeze({ x: 68, y: 60, width: 66, height: 14 }),
  effects: Object.freeze({ x: 68, y: 78, width: 66, height: 14 }),
});
export const OPTIONS_BUILD_LABEL = Object.freeze({ x: 14, y: 102 });
export const RESOURCE_HUD_AREA = Object.freeze({ x: 210, y: 38, width: 40, height: 68 });
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
export const RESOURCE_HUD_LAYOUT = Object.freeze({
  woodIcon: Object.freeze({ x: 216, y: 52 }),
  woodValue: Object.freeze({ x: 229, y: 55 }),
  stoneIcon: Object.freeze({ x: 216, y: 70 }),
  stoneValue: Object.freeze({ x: 229, y: 73 }),
  rubyIcon: Object.freeze({ x: 216, y: 88 }),
  rubyValue: Object.freeze({ x: 229, y: 91 }),
});
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
  const intensity = Math.min(3, Math.max(1, Math.round(arrows) || 1));
  const time = Number(nowMs) || 0;
  const stableSeed = Number(seed) || 0;
  const randomUnit = (salt) => {
    const value = Math.sin(stableSeed * 127.1 + salt * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const baseInterval = [0, 2600, 1700, 900][intensity];
  const interval = baseInterval * (0.78 + randomUnit(1) * 0.5);
  const activeDuration = 420 + randomUnit(2) * 420;
  const phaseOffset = randomUnit(3) * interval;
  const drift = Math.sin(time * (0.00009 + randomUnit(4) * 0.00041) + randomUnit(5) * Math.PI * 2) * (80 + randomUnit(6) * 210)
    + Math.sin(time * (0.000031 + randomUnit(7) * 0.00017) + randomUnit(8) * Math.PI * 2) * (35 + randomUnit(9) * 125);
  const phase = ((time + phaseOffset + drift) % interval + interval) % interval;
  return phase < activeDuration ? Math.sin(Math.PI * phase / activeDuration) * 0.9 : 0;
}

export function createGameHud(scene, options) {
  const {
    buildId,
    localization,
    gameContainer,
    onLanguageChange = () => {},
    onNewGame = () => {},
    onConfirmationChange = () => {},
    audioSettings,
    getGameplayState = () => null,
    isCoarsePointer = () => false,
  } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const energyBarGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0);
  const energyArrowGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 3).setScrollFactor(0);
  const buildLabel = compactBuildLabel(buildId);

  let destroyed = false;
  let confirmingNewGame = false;
  let fullscreenHud = null;
  let fullscreenHandler = null;
  let languageLatched = false;
  let optionsOpen = false;
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

  const optionsHit = createZone(scene, OPTIONS_HIT_AREA);
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
  const onScenePointerDown = (pointer) => {
    if (!isCoarsePointer() || !pinnedNeedId) return;
    const point = { x: pointer?.x, y: pointer?.y };
    if (NEED_ROW_AREAS.some((rect) => isPointInRect(point.x, point.y, rect))) return;
    if (isPointInRect(point.x, point.y, NEED_TOOLTIP_AREA)) return;
    pinnedNeedId = null;
    render();
  };
  scene.input.on("pointerdown", onScenePointerDown);

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
  const woodValueText = createText(scene, { fontSize: "8px" });
  const stoneValueText = createText(scene, { fontSize: "8px" });
  const rubyValueText = createText(scene, { fontSize: "8px" });
  const needTooltipText = createText(scene, { fontSize: "8px", wordWrap: { width: NEED_TOOLTIP_AREA.width - 12 } });
  const woodIcon = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0).setScale(0.5).setVisible(false);
  const stoneIcon = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0).setScale(0.5).setVisible(false);
  const rubyIcon = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0).setScale(0.5).setVisible(false);
  drawLog(woodIcon, 0);
  drawStone(stoneIcon, 0);
  drawRuby(rubyIcon, 0);

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

  languageHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    void toggleLanguage();
  });
  languageHit.on("pointerup", () => { languageLatched = false; });
  languageHit.on("pointerout", () => { languageLatched = false; });
  languageHit.on("pointercancel", () => { languageLatched = false; });

  newGameHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (confirmingNewGame || !optionsOpen) return;
    confirmingNewGame = true;
    optionsOpen = false;
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
    textObject.setPosition(
      Math.round(rect.x + (rect.width - textObject.width) / 2),
      Math.round(rect.y + (rect.height - textObject.height) / 2),
    );
  }

  function hideManagedObjects() {
    for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, woodValueText, stoneValueText, rubyValueText, needTooltipText, ...Object.values(soundTexts)]) {
      text.setVisible(false);
    }
    woodIcon.setVisible(false);
    stoneIcon.setVisible(false);
    rubyIcon.setVisible(false);
  }

  function render() {
    if (destroyed) return;
    graphics.clear();
    energyBarGraphics.clear();
    energyArrowGraphics.clear();
    hideManagedObjects();

    if (confirmingNewGame) renderConfirmation();
    else renderNormalHud();
    updateInteractivity();

    if (fullscreenHud) renderFullscreenIcon(fullscreenHud.graphics, isFullscreenActive(document, gameContainer));
  }

  function renderNormalHud() {
    renderButton(OPTIONS_HIT_AREA, optionsText, localization.t("hud:options.title"));
    const gameplay = getGameplayState?.();
    if (gameplay) {
      renderClock(gameplay);
      if (!optionsOpen) {
        renderResources(gameplay);
        renderNeeds(gameplay);
      }
    }
    if (optionsOpen) renderOptionsPanel();
  }

  function renderClock(gameplay) {
    graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(CLOCK_HUD_AREA.x, CLOCK_HUD_AREA.y, CLOCK_HUD_AREA.width, CLOCK_HUD_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 0.8).strokeRect(CLOCK_HUD_AREA.x + 0.5, CLOCK_HUD_AREA.y + 0.5, CLOCK_HUD_AREA.width - 1, CLOCK_HUD_AREA.height - 1);
    setManagedTextStyle(clockText, scene, textStyle({ fontSize: "8px" })).setText(gameplay.clock ?? "").setVisible(true);
    clockText.setPosition(
      Math.round((GAME_WIDTH - clockText.width) / 2),
      Math.round(CLOCK_HUD_AREA.y + (CLOCK_HUD_AREA.height - clockText.height) / 2),
    );
  }

  function renderResources(gameplay) {
    graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(RESOURCE_HUD_AREA.x, RESOURCE_HUD_AREA.y, RESOURCE_HUD_AREA.width, RESOURCE_HUD_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 0.8).strokeRect(RESOURCE_HUD_AREA.x + 0.5, RESOURCE_HUD_AREA.y + 0.5, RESOURCE_HUD_AREA.width - 1, RESOURCE_HUD_AREA.height - 1);
    setManagedTextStyle(woodValueText, scene, textStyle({ fontSize: "8px" })).setText(String(gameplay.wood)).setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.woodValue.x, RESOURCE_HUD_LAYOUT.woodValue.y);
    setManagedTextStyle(stoneValueText, scene, textStyle({ fontSize: "8px" })).setText(String(gameplay.stone ?? 0)).setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.stoneValue.x, RESOURCE_HUD_LAYOUT.stoneValue.y);
    setManagedTextStyle(rubyValueText, scene, textStyle({ fontSize: "8px" })).setText(String(gameplay.rubies ?? 0)).setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.rubyValue.x, RESOURCE_HUD_LAYOUT.rubyValue.y);
    woodIcon.setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.woodIcon.x, RESOURCE_HUD_LAYOUT.woodIcon.y);
    stoneIcon.setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.stoneIcon.x, RESOURCE_HUD_LAYOUT.stoneIcon.y);
    rubyIcon.setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.rubyIcon.x, RESOURCE_HUD_LAYOUT.rubyIcon.y);
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
      drawNeedFlow(energyArrowGraphics, rect.x + 40, rect.y + 2, flow, scene.time.now, index + 1);
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
    if (confirmingNewGame) {
      optionsHit.disableInteractive();
      setOptionsPanelInteractive(false);
      setNeedsInteractive(false);
      confirmHit.setInteractive({ useHandCursor: true });
      cancelHit.setInteractive({ useHandCursor: true });
      return;
    }
    optionsHit.setInteractive({ useHandCursor: true });
    setOptionsPanelInteractive(optionsOpen);
    setNeedsInteractive(!optionsOpen);
    confirmHit.disableInteractive();
    cancelHit.disableInteractive();
  }

  function setNeedsInteractive(active) {
    for (const zone of needHits) {
      if (active) zone.setInteractive({ useHandCursor: true });
      else zone.disableInteractive();
    }
    if (!active) {
      hoveredNeedId = null;
      pinnedNeedId = null;
    }
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
    return {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "9px",
      color: "#f2eadc",
      ...overrides,
    };
  }

  render();
  const unsubscribe = localization.subscribe(render);

  return {
    render,
    triggerEnergyShake,
    getResourceState() {
      return {
        clockText: clockText.text,
        woodText: woodValueText.text,
        stoneText: stoneValueText.text,
        rubyText: rubyValueText.text,
        icons: { wood: woodIcon.visible, stone: stoneIcon.visible, ruby: rubyIcon.visible },
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
          resources: RESOURCE_HUD_AREA,
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
      };
    },
    isPointInHud(x, y) {
      if (confirmingNewGame) {
        return isPointInRect(x, y, NEW_GAME_CONFIRM_PANEL)
          || Boolean(fullscreenHud && isPointInRect(x, y, FULLSCREEN_HIT_AREA));
      }
      return isPointInRect(x, y, OPTIONS_HIT_AREA)
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
      for (const zone of [optionsHit, optionsPanelHit, languageHit, ...Object.values(sliderHits), newGameHit, confirmHit, cancelHit, ...needHits]) zone.destroy();
      scene.tweens.killTweensOf(energyBarGraphics);
      scene.tweens.killTweensOf(energyArrowGraphics);
      for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, woodValueText, stoneValueText, rubyValueText, needTooltipText, ...Object.values(soundTexts)]) text.destroy();
      woodIcon.destroy();
      stoneIcon.destroy();
      rubyIcon.destroy();
      energyBarGraphics.destroy();
      energyArrowGraphics.destroy();
      graphics.destroy();
      if (fullscreenHud) {
        if (fullscreenHandler) fullscreenHud.hit.off("pointerdown", fullscreenHandler);
        fullscreenHud.hit.destroy();
        fullscreenHud.graphics.destroy();
      }
    },
  };
}

function drawEnergyArrow(graphics, x, y, direction, alpha = 0.9) {
  const rows = direction === "up"
    ? [[2], [1, 2, 3], [0, 1, 2, 3, 4], [2], [2]]
    : [[2], [2], [0, 1, 2, 3, 4], [1, 2, 3], [2]];
  graphics.fillStyle(direction === "up" ? 0x9fd38a : 0xf2eadc, alpha);
  rows.forEach((columns, row) => columns.forEach((column) => graphics.fillRect(x + column, y + row, 1, 1)));
}

function drawNeedFlow(graphics, x, y, flow, nowMs, seed) {
  if (!flow?.direction) return;
  const arrows = Math.min(3, Math.max(1, Math.round(flow.arrows) || 1));
  const alpha = needFlowPulseAlpha(arrows, nowMs, seed);
  if (alpha <= 0) return;
  for (let index = 0; index < arrows; index += 1) {
    drawEnergyArrow(graphics, x + index * 5, y, flow.direction, alpha);
  }
}

function createZone(scene, rect) {
  return scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
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
