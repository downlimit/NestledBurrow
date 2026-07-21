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
import { GAME_WIDTH } from "./worldConfig.js";

export const LANGUAGE_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 86, y: 4, width: 48, height: 30 });
export const PROGRESS_ACTION_RESERVED = Object.freeze({ id: "new-game", implemented: false });

export function createGameHud(scene, options) {
  const { buildId, localization, gameContainer, onLanguageChange = () => {} } = options;
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  const label = compactBuildLabel(buildId);
  drawBitmapText(scene, BUILD_LABEL.x - measureBitmapText(label), BUILD_LABEL.y, label);

  let destroyed = false;
  let fullscreenHud = null;
  let fullscreenHandler = null;
  let languageLatched = false;
  const languageHit = scene.add.zone(LANGUAGE_HIT_AREA.x, LANGUAGE_HIT_AREA.y, LANGUAGE_HIT_AREA.width, LANGUAGE_HIT_AREA.height)
    .setOrigin(0, 0).setDepth(HUD_DEPTH + 2).setScrollFactor(0).setInteractive({ useHandCursor: true });

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
    if (languageLatched) return;
    languageLatched = true;
    const next = getNextLocale();
    await localization.changeLanguage(next.code);
    onLanguageChange(localization.getLanguage());
    render();
  }

  languageHit.on("pointerdown", (pointer, _x, _y, event) => { stop(pointer, event); void toggleLanguage(); });
  languageHit.on("pointerup", () => { languageLatched = false; });
  languageHit.on("pointerout", () => { languageLatched = false; });
  languageHit.on("pointercancel", () => { languageLatched = false; });

  if (isFullscreenSupported(gameContainer)) {
    fullscreenHud = drawFullscreenIcon(scene, isFullscreenActive(document, gameContainer));
    fullscreenHandler = (pointer, _localX, _localY, event) => {
      stop(pointer, event);
      void toggleFullscreen({ documentRef: document, element: gameContainer }).then(() => render());
    };
    fullscreenHud.hit.on("pointerdown", fullscreenHandler);
  }

  function renderLanguage() {
    graphics.clear();
    graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(LANGUAGE_HIT_AREA.x + 3, LANGUAGE_HIT_AREA.y + 3, LANGUAGE_HIT_AREA.width - 6, 24);
    graphics.lineStyle(1, HUD_COLORS.border, 0.9).strokeRect(LANGUAGE_HIT_AREA.x + 3.5, LANGUAGE_HIT_AREA.y + 3.5, LANGUAGE_HIT_AREA.width - 7, 23);
    const current = localization.getLocale().label;
    const next = getNextLocale().label;
    const text = localization.t("hud:language.currentNext", { current, next });
    const style = { fontFamily: localization.getLocale().fontKey, fontSize: "9px", color: "#f2eadc" };
    if (!renderLanguage.text) {
      renderLanguage.text = scene.add.text(LANGUAGE_HIT_AREA.x + 7, LANGUAGE_HIT_AREA.y + 10, text, style).setDepth(HUD_DEPTH + 2).setScrollFactor(0);
    } else {
      renderLanguage.text.setStyle(style).setText(text);
    }
    renderLanguage.text.setPosition(Math.round(LANGUAGE_HIT_AREA.x + 7), Math.round(LANGUAGE_HIT_AREA.y + 10));
  }

  function render() {
    if (destroyed) return;
    renderLanguage();
    if (fullscreenHud) renderFullscreenIcon(fullscreenHud.graphics, isFullscreenActive(document, gameContainer));
  }
  render();
  const unsubscribe = localization.subscribe(render);

  return {
    render,
    isPointInHud(x, y) { return isPointInRect(x, y, LANGUAGE_HIT_AREA) || isPointInRect(x, y, FULLSCREEN_HIT_AREA); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      languageHit.destroy();
      renderLanguage.text?.destroy();
      graphics.destroy();
      if (fullscreenHud) {
        if (fullscreenHandler) fullscreenHud.hit.off("pointerdown", fullscreenHandler);
        fullscreenHud.hit.destroy();
        fullscreenHud.graphics.destroy();
      }
    },
  };
}
