import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from "./fullscreen.js";
import {
  BUILD_LABEL,
  FULLSCREEN_HIT_AREA,
  HUD_COLORS,
  HUD_DEPTH,
  compactBuildLabel,
  drawBitmapText,
  drawFullscreenIcon,
  isPointInRect,
  measureBitmapText,
  renderFullscreenIcon,
} from "./hud.js";
import { GAME_HEIGHT, GAME_WIDTH } from "./worldConfig.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";

export const NEW_GAME_HIT_AREA = Object.freeze({ x: 8, y: 4, width: 78, height: 30 });
export const FULLSCREEN_HUD_AREA = Object.freeze({ x: GAME_WIDTH - 34, y: 4, width: 30, height: 30 });
export const LANGUAGE_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 84, y: 4, width: 44, height: 30 });
export const SOUND_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 122, y: 4, width: 32, height: 30 });
export const SOUND_PANEL_AREA = Object.freeze({ x: GAME_WIDTH - 166, y: 34, width: 158, height: 66 });
export const SOUND_SLIDER_RECTS = Object.freeze({
  master: Object.freeze({ x: SOUND_PANEL_AREA.x + 58, y: SOUND_PANEL_AREA.y + 14, width: 66, height: 14 }),
  music: Object.freeze({ x: SOUND_PANEL_AREA.x + 58, y: SOUND_PANEL_AREA.y + 32, width: 66, height: 14 }),
  effects: Object.freeze({ x: SOUND_PANEL_AREA.x + 58, y: SOUND_PANEL_AREA.y + 50, width: 66, height: 14 }),
});
export const NEW_GAME_CONFIRM_PANEL = Object.freeze({ x: 24, y: 46, width: GAME_WIDTH - 48, height: 88 });
export const NEW_GAME_CONFIRM_HIT_AREA = Object.freeze({ x: 44, y: 98, width: 96, height: 26 });
export const NEW_GAME_CANCEL_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 140, y: 98, width: 96, height: 26 });

export function createGameHud(scene, options) {
  const {
    buildId,
    localization,
    gameContainer,
    onLanguageChange = () => {},
    onNewGame = () => {},
    audioSettings,
  } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const label = compactBuildLabel(buildId);
  drawBitmapText(scene, BUILD_LABEL.x - measureBitmapText(label), BUILD_LABEL.y, label);

  let destroyed = false;
  let confirmingNewGame = false;
  let fullscreenHud = null;
  let fullscreenHandler = null;
  let languageLatched = false;
  let soundPanelOpen = false;
  let draggingChannel = null;

  const languageHit = createZone(scene, LANGUAGE_HIT_AREA);
  const soundHit = createZone(scene, SOUND_HIT_AREA);
  const soundPanelHit = createZone(scene, SOUND_PANEL_AREA).disableInteractive();
  const sliderHits = Object.fromEntries(Object.entries(SOUND_SLIDER_RECTS).map(([channel, rect]) => [channel, createZone(scene, rect).disableInteractive()]));
  const newGameHit = createZone(scene, NEW_GAME_HIT_AREA);
  const confirmHit = createZone(scene, NEW_GAME_CONFIRM_HIT_AREA);
  const cancelHit = createZone(scene, NEW_GAME_CANCEL_HIT_AREA);

  const languageText = createText(scene);
  const newGameText = createText(scene);
  const confirmMessageText = createText(scene, { align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } });
  const confirmText = createText(scene);
  const cancelText = createText(scene);
  const soundTexts = { title: createText(scene), master: createText(scene), music: createText(scene), effects: createText(scene), masterValue: createText(scene), musicValue: createText(scene), effectsValue: createText(scene) };

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
    if (languageLatched || confirmingNewGame) return;
    languageLatched = true;
    const next = getNextLocale();
    await localization.changeLanguage(next.code);
    onLanguageChange(localization.getLanguage());
    render();
  }

  soundHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (confirmingNewGame) return;
    soundPanelOpen = !soundPanelOpen;
    render();
  });
  soundPanelHit.on("pointerdown", stop);
  soundPanelHit.on("pointerup", stop);
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
    if (confirmingNewGame) return;
    confirmingNewGame = true;
    soundPanelOpen = false;
    render();
  });
  confirmHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (!confirmingNewGame) return;
    confirmingNewGame = false;
    onNewGame();
  });
  cancelHit.on("pointerdown", (pointer, _x, _y, event) => {
    stop(pointer, event);
    if (!confirmingNewGame) return;
    confirmingNewGame = false;
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

  function render() {
    if (destroyed) return;
    graphics.clear();
    const current = localization.getLocale().label;

    renderButton(NEW_GAME_HIT_AREA, newGameText, localization.t("hud:progress.newGame"));
    renderButton(
      LANGUAGE_HIT_AREA,
      languageText,
      current,
    );

    confirmMessageText.setVisible(false);
    confirmText.setVisible(false);
    cancelText.setVisible(false);

    renderSoundButton();
    renderSoundPanel();

    if (confirmingNewGame) {
      graphics.fillStyle(HUD_COLORS.panel, 0.97).fillRect(
        NEW_GAME_CONFIRM_PANEL.x,
        NEW_GAME_CONFIRM_PANEL.y,
        NEW_GAME_CONFIRM_PANEL.width,
        NEW_GAME_CONFIRM_PANEL.height,
      );
      graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(
        NEW_GAME_CONFIRM_PANEL.x + 0.5,
        NEW_GAME_CONFIRM_PANEL.y + 0.5,
        NEW_GAME_CONFIRM_PANEL.width - 1,
        NEW_GAME_CONFIRM_PANEL.height - 1,
      );
      setManagedTextStyle(confirmMessageText, scene, textStyle({ fontSize: "10px", align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } }))
        .setText(localization.t("hud:progress.confirmNewGame"))
        .setVisible(true)
        .setPosition(NEW_GAME_CONFIRM_PANEL.x + 12, NEW_GAME_CONFIRM_PANEL.y + 14);
      renderButton(NEW_GAME_CONFIRM_HIT_AREA, confirmText, localization.t("hud:progress.confirm"));
      renderButton(NEW_GAME_CANCEL_HIT_AREA, cancelText, localization.t("hud:progress.cancel"));
      newGameHit.disableInteractive();
      languageHit.disableInteractive();
      soundHit.disableInteractive();
      setSoundPanelInteractive(false);
      confirmHit.setInteractive({ useHandCursor: true });
      cancelHit.setInteractive({ useHandCursor: true });
    } else {
      newGameHit.setInteractive({ useHandCursor: true });
      languageHit.setInteractive({ useHandCursor: true });
      soundHit.setInteractive({ useHandCursor: true });
      setSoundPanelInteractive(soundPanelOpen);
      confirmHit.disableInteractive();
      cancelHit.disableInteractive();
    }

    if (fullscreenHud) {
      renderFullscreenIcon(fullscreenHud.graphics, isFullscreenActive(document, gameContainer));
    }
  }

  function setSliderValue(channel, localX) {
    const rect = SOUND_SLIDER_RECTS[channel];
    audioSettings?.setChannel(channel, Math.min(1, Math.max(0, localX / rect.width)));
    render();
  }

  function setSoundPanelInteractive(active) {
    if (active) {
      soundPanelHit.setInteractive({ useHandCursor: false });
      for (const zone of Object.values(sliderHits)) zone.setInteractive({ useHandCursor: true });
    } else {
      soundPanelHit.disableInteractive();
      for (const zone of Object.values(sliderHits)) zone.disableInteractive();
    }
  }

  function renderSoundButton() {
    const muted = (audioSettings?.getSettings?.().master ?? 1) <= 0;
    graphics.fillStyle(HUD_COLORS.panel, 0.86).fillRect(SOUND_HIT_AREA.x + 3, SOUND_HIT_AREA.y + 3, SOUND_HIT_AREA.width - 6, SOUND_HIT_AREA.height - 6);
    graphics.lineStyle(1, HUD_COLORS.border, 0.9).strokeRect(SOUND_HIT_AREA.x + 3.5, SOUND_HIT_AREA.y + 3.5, SOUND_HIT_AREA.width - 7, SOUND_HIT_AREA.height - 7);
    const x = SOUND_HIT_AREA.x;
    const y = SOUND_HIT_AREA.y;
    graphics
      .fillStyle(HUD_COLORS.light, 0.95)
      .fillRect(x + 10, y + 14, 4, 6)
      .fillRect(x + 14, y + 12, 3, 10)
      .fillRect(x + 17, y + 10, 2, 14)
      .fillRect(x + 19, y + 12, 1, 10);
    if (muted) {
      graphics
        .lineStyle(2, 0xd95757, 1)
        .lineBetween(x + 23, y + 13, x + 28, y + 22)
        .lineBetween(x + 28, y + 13, x + 23, y + 22);
    } else {
      graphics
        .fillStyle(HUD_COLORS.mid, 1)
        .fillRect(x + 23, y + 13, 2, 2)
        .fillRect(x + 25, y + 15, 2, 2)
        .fillRect(x + 25, y + 18, 2, 2)
        .fillRect(x + 23, y + 20, 2, 2)
        .fillRect(x + 28, y + 10, 2, 2)
        .fillRect(x + 30, y + 12, 2, 4)
        .fillRect(x + 31, y + 16, 2, 3)
        .fillRect(x + 30, y + 19, 2, 4)
        .fillRect(x + 28, y + 23, 2, 2);
    }
  }

  function renderSoundPanel() {
    for (const text of Object.values(soundTexts)) text.setVisible(false);
    if (!soundPanelOpen || confirmingNewGame) return;
    graphics.fillStyle(HUD_COLORS.panel, 0.97).fillRect(SOUND_PANEL_AREA.x, SOUND_PANEL_AREA.y, SOUND_PANEL_AREA.width, SOUND_PANEL_AREA.height);
    graphics.lineStyle(1, HUD_COLORS.border, 1).strokeRect(SOUND_PANEL_AREA.x + 0.5, SOUND_PANEL_AREA.y + 0.5, SOUND_PANEL_AREA.width - 1, SOUND_PANEL_AREA.height - 1);
    const settings = audioSettings?.getSettings?.() ?? { master: 1, music: 0.5, effects: 1 };
    for (const channel of ["master", "music", "effects"]) {
      const rect = SOUND_SLIDER_RECTS[channel];
      const y = rect.y + 2;
      setManagedTextStyle(soundTexts[channel], scene, textStyle({ fontSize: "8px" })).setText(localization.t(`hud:sound.${channel}`)).setVisible(true).setPosition(SOUND_PANEL_AREA.x + 6, y);
      const percent = Math.round(settings[channel] * 100);
      setManagedTextStyle(soundTexts[`${channel}Value`], scene, textStyle({ fontSize: "8px" })).setText(`${percent}%`).setVisible(true).setPosition(rect.x + rect.width + 8, y);
      graphics.fillStyle(HUD_COLORS.shadow, 0.9).fillRect(rect.x, rect.y + 5, rect.width, 4);
      graphics.fillStyle(HUD_COLORS.mid, 1).fillRect(rect.x, rect.y + 5, Math.round(rect.width * settings[channel]), 4);
      graphics.fillStyle(HUD_COLORS.light, 1).fillRect(rect.x + Math.round(rect.width * settings[channel]) - 2, rect.y + 2, 4, 10);
    }
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
    isConfirming() { return confirmingNewGame; },
    getLayoutState() { return { soundPanelOpen, areas: { newGame: NEW_GAME_HIT_AREA, sound: SOUND_HIT_AREA, language: LANGUAGE_HIT_AREA, fullscreen: FULLSCREEN_HIT_AREA, build: BUILD_LABEL, soundPanel: SOUND_PANEL_AREA } }; },
    isPointInHud(x, y) {
      return (
        isPointInRect(x, y, NEW_GAME_HIT_AREA) ||
        isPointInRect(x, y, LANGUAGE_HIT_AREA) ||
        isPointInRect(x, y, SOUND_HIT_AREA) ||
        (soundPanelOpen && isPointInRect(x, y, SOUND_PANEL_AREA)) ||
        isPointInRect(x, y, FULLSCREEN_HIT_AREA) ||
        (confirmingNewGame && isPointInRect(x, y, NEW_GAME_CONFIRM_PANEL))
      );
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      for (const zone of [languageHit, soundHit, soundPanelHit, ...Object.values(sliderHits), newGameHit, confirmHit, cancelHit]) zone.destroy();
      for (const text of [languageText, newGameText, confirmMessageText, confirmText, cancelText, ...Object.values(soundTexts)]) text.destroy();
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
