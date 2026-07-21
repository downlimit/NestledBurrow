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

export const NEW_GAME_HIT_AREA = Object.freeze({ x: 8, y: 4, width: 78, height: 30 });
export const LANGUAGE_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 86, y: 4, width: 48, height: 30 });
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
  } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const label = compactBuildLabel(buildId);
  drawBitmapText(scene, BUILD_LABEL.x - measureBitmapText(label), BUILD_LABEL.y, label);

  let destroyed = false;
  let confirmingNewGame = false;
  let fullscreenHud = null;
  let fullscreenHandler = null;
  let languageLatched = false;

  const languageHit = createZone(scene, LANGUAGE_HIT_AREA);
  const newGameHit = createZone(scene, NEW_GAME_HIT_AREA);
  const confirmHit = createZone(scene, NEW_GAME_CONFIRM_HIT_AREA);
  const cancelHit = createZone(scene, NEW_GAME_CANCEL_HIT_AREA);

  const languageText = createText(scene);
  const newGameText = createText(scene);
  const confirmMessageText = createText(scene, { align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } });
  const confirmText = createText(scene);
  const cancelText = createText(scene);

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
    textObject.setStyle(textStyle()).setText(labelText).setVisible(true);
    textObject.setPosition(
      Math.round(rect.x + (rect.width - textObject.width) / 2),
      Math.round(rect.y + (rect.height - textObject.height) / 2),
    );
  }

  function render() {
    if (destroyed) return;
    graphics.clear();
    const current = localization.getLocale().label;
    const next = getNextLocale().label;

    renderButton(NEW_GAME_HIT_AREA, newGameText, localization.t("hud:progress.newGame"));
    renderButton(
      LANGUAGE_HIT_AREA,
      languageText,
      localization.t("hud:language.currentNext", { current, next }),
    );

    confirmMessageText.setVisible(false);
    confirmText.setVisible(false);
    cancelText.setVisible(false);

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
      confirmMessageText
        .setStyle(textStyle({ fontSize: "10px", align: "center", wordWrap: { width: NEW_GAME_CONFIRM_PANEL.width - 24 } }))
        .setText(localization.t("hud:progress.confirmNewGame"))
        .setVisible(true)
        .setPosition(NEW_GAME_CONFIRM_PANEL.x + 12, NEW_GAME_CONFIRM_PANEL.y + 14);
      renderButton(NEW_GAME_CONFIRM_HIT_AREA, confirmText, localization.t("hud:progress.confirm"));
      renderButton(NEW_GAME_CANCEL_HIT_AREA, cancelText, localization.t("hud:progress.cancel"));
      newGameHit.disableInteractive();
      languageHit.disableInteractive();
      confirmHit.setInteractive({ useHandCursor: true });
      cancelHit.setInteractive({ useHandCursor: true });
    } else {
      newGameHit.setInteractive({ useHandCursor: true });
      languageHit.setInteractive({ useHandCursor: true });
      confirmHit.disableInteractive();
      cancelHit.disableInteractive();
    }

    if (fullscreenHud) {
      renderFullscreenIcon(fullscreenHud.graphics, isFullscreenActive(document, gameContainer));
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
    isPointInHud(x, y) {
      return (
        isPointInRect(x, y, NEW_GAME_HIT_AREA) ||
        isPointInRect(x, y, LANGUAGE_HIT_AREA) ||
        isPointInRect(x, y, FULLSCREEN_HIT_AREA) ||
        (confirmingNewGame && isPointInRect(x, y, NEW_GAME_CONFIRM_PANEL))
      );
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      for (const zone of [languageHit, newGameHit, confirmHit, cancelHit]) zone.destroy();
      for (const text of [languageText, newGameText, confirmMessageText, confirmText, cancelText]) text.destroy();
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
  return scene.add
    .text(0, 0, "", { fontSize: "9px", color: "#f2eadc", ...extraStyle })
    .setDepth(HUD_DEPTH + 3)
    .setScrollFactor(0)
    .setVisible(false);
}
