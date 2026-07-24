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
import { drawLog, drawRuby } from "./resourceVisuals.js";

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
export const RESOURCE_HUD_AREA = Object.freeze({ x: 244, y: 54, width: 46, height: 44 });
export const ENERGY_HUD_AREA = Object.freeze({ x: 294, y: 54, width: 16, height: 44 });
export const RESOURCE_HUD_LAYOUT = Object.freeze({
  woodIcon: Object.freeze({ x: 250, y: 60 }),
  woodValue: Object.freeze({ x: 264, y: 60 }),
  rubyIcon: Object.freeze({ x: 250, y: 78 }),
  rubyValue: Object.freeze({ x: 264, y: 78 }),
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
  } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const energyBarGraphics = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0);
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

  const optionsHit = createZone(scene, OPTIONS_HIT_AREA);
  const optionsPanelHit = createZone(scene, OPTIONS_PANEL_AREA).disableInteractive();
  const languageHit = createZone(scene, LANGUAGE_HIT_AREA).disableInteractive();
  const sliderHits = Object.fromEntries(Object.entries(SOUND_SLIDER_RECTS).map(([channel, rect]) => [channel, createZone(scene, rect).disableInteractive()]));
  const newGameHit = createZone(scene, NEW_GAME_HIT_AREA).disableInteractive();
  const confirmHit = createZone(scene, NEW_GAME_CONFIRM_HIT_AREA).disableInteractive();
  const cancelHit = createZone(scene, NEW_GAME_CANCEL_HIT_AREA).disableInteractive();

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
  const rubyValueText = createText(scene, { fontSize: "8px" });
  const woodIcon = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0).setScale(0.5).setVisible(false);
  const rubyIcon = scene.add.graphics().setDepth(HUD_DEPTH + 2).setScrollFactor(0).setScale(0.5).setVisible(false);
  drawLog(woodIcon, 5);
  drawRuby(rubyIcon, 5);

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
    for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, woodValueText, rubyValueText, ...Object.values(soundTexts)]) {
      text.setVisible(false);
    }
    woodIcon.setVisible(false);
    rubyIcon.setVisible(false);
  }

  function render() {
    if (destroyed) return;
    graphics.clear();
    energyBarGraphics.clear();
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
      renderResources(gameplay);
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
    setManagedTextStyle(rubyValueText, scene, textStyle({ fontSize: "8px" })).setText(String(gameplay.rubies ?? 0)).setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.rubyValue.x, RESOURCE_HUD_LAYOUT.rubyValue.y);
    woodIcon.setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.woodIcon.x, RESOURCE_HUD_LAYOUT.woodIcon.y);
    rubyIcon.setVisible(true).setPosition(RESOURCE_HUD_LAYOUT.rubyIcon.x, RESOURCE_HUD_LAYOUT.rubyIcon.y);
    renderEnergyBar(gameplay.currentEnergy, gameplay.maximumEnergy);
  }

  function renderEnergyBar(currentEnergy, maximumEnergy) {
    const innerHeight = ENERGY_HUD_AREA.height - 6;
    const maximum = Number(maximumEnergy);
    energyRatio = maximum > 0 ? Math.min(1, Math.max(0, Number(currentEnergy) / maximum)) : 0;
    energyFillHeight = energyRatio > 0 ? Math.max(1, Math.round(innerHeight * energyRatio)) : 0;
    energyBarGraphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(ENERGY_HUD_AREA.x, ENERGY_HUD_AREA.y, ENERGY_HUD_AREA.width, ENERGY_HUD_AREA.height);
    energyBarGraphics.fillStyle(HUD_COLORS.shadow, 0.95).fillRect(ENERGY_HUD_AREA.x + 3, ENERGY_HUD_AREA.y + 3, ENERGY_HUD_AREA.width - 6, innerHeight);
    if (energyFillHeight > 0) {
      energyBarGraphics.fillStyle(HUD_COLORS.mid, 1).fillRect(
        ENERGY_HUD_AREA.x + 3,
        ENERGY_HUD_AREA.y + 3 + innerHeight - energyFillHeight,
        ENERGY_HUD_AREA.width - 6,
        energyFillHeight,
      );
    }
    energyBarGraphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(ENERGY_HUD_AREA.x + 0.5, ENERGY_HUD_AREA.y + 0.5, ENERGY_HUD_AREA.width - 1, ENERGY_HUD_AREA.height - 1);
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
      confirmHit.setInteractive({ useHandCursor: true });
      cancelHit.setInteractive({ useHandCursor: true });
      return;
    }
    optionsHit.setInteractive({ useHandCursor: true });
    setOptionsPanelInteractive(optionsOpen);
    confirmHit.disableInteractive();
    cancelHit.disableInteractive();
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
        rubyText: rubyValueText.text,
        icons: { wood: woodIcon.visible, ruby: rubyIcon.visible },
        energyRatio,
        energyFillHeight,
        energyY: energyBarGraphics.y,
        energyBaseY: 0,
        energyShakeCount,
        energyShakeActive,
      };
    },
    isConfirming() { return confirmingNewGame; },
    getLayoutState() {
      return {
        optionsOpen,
        buildLabelVisible: optionsOpen && !confirmingNewGame,
        areas: {
          options: OPTIONS_HIT_AREA,
          clock: CLOCK_HUD_AREA,
          resources: RESOURCE_HUD_AREA,
          energy: ENERGY_HUD_AREA,
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
        || Boolean(fullscreenHud && isPointInRect(x, y, FULLSCREEN_HIT_AREA));
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (confirmingNewGame) onConfirmationChange(false);
      unsubscribe?.();
      for (const zone of [optionsHit, optionsPanelHit, languageHit, ...Object.values(sliderHits), newGameHit, confirmHit, cancelHit]) zone.destroy();
      scene.tweens.killTweensOf(energyBarGraphics);
      for (const text of [optionsText, languageText, newGameText, confirmMessageText, confirmText, cancelText, clockText, woodValueText, rubyValueText, ...Object.values(soundTexts)]) text.destroy();
      woodIcon.destroy();
      rubyIcon.destroy();
      energyBarGraphics.destroy();
      graphics.destroy();
      if (fullscreenHud) {
        if (fullscreenHandler) fullscreenHud.hit.off("pointerdown", fullscreenHandler);
        fullscreenHud.hit.destroy();
        fullscreenHud.graphics.destroy();
      }
    },
  };
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
