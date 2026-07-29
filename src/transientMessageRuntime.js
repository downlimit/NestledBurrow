import { HUD_COLORS, HUD_DEPTH } from "./hud.js";
import { createManagedText, setManagedTextStyle } from "./textResolution.js";
import { GAME_WIDTH } from "./worldConfig.js";

export const TRANSIENT_MESSAGE_DURATION_MS = 2200;
export const TRANSIENT_MESSAGE_Y = 115;
export const TRANSIENT_MESSAGE_HEIGHT = 18;

export function createTransientMessageRuntime(scene, { localization } = {}) {
  const background = scene.add.graphics().setDepth(HUD_DEPTH + 40).setScrollFactor(0).setVisible(false);
  const text = createManagedText(scene, 0, 0, "", {
    fontSize: "8px",
    color: "#f2eadc",
  }).setDepth(HUD_DEPTH + 41).setScrollFactor(0).setVisible(false);
  let expiresAtMs = 0;
  let messageKey = null;
  let literal = null;
  let destroyed = false;

  function show(keyOrText, { literalText = false, durationMs = TRANSIENT_MESSAGE_DURATION_MS } = {}) {
    if (destroyed) return;
    messageKey = literalText ? null : keyOrText;
    literal = literalText ? String(keyOrText) : null;
    expiresAtMs = (scene.time?.now ?? 0) + durationMs;
    render();
  }

  function render() {
    if (destroyed || (!messageKey && literal === null)) {
      background.clear().setVisible(false);
      text.setVisible(false);
      return;
    }
    const value = literal ?? localization.t(messageKey);
    setManagedTextStyle(text, scene, {
      fontFamily: localization.getLocale().fontKey,
      fontSize: "8px",
      color: "#f2eadc",
    }).setText(value).setVisible(true);
    const width = Math.min(GAME_WIDTH - 24, Math.max(72, Math.ceil(text.width) + 12));
    const x = Math.round((GAME_WIDTH - width) / 2);
    const y = TRANSIENT_MESSAGE_Y;
    text.setPosition(Math.round((GAME_WIDTH - text.width) / 2), y + 5);
    background.clear().setVisible(true)
      .fillStyle(HUD_COLORS.panel, 0.94).fillRect(x, y, width, TRANSIENT_MESSAGE_HEIGHT)
      .lineStyle(1, HUD_COLORS.border, 0.9).strokeRect(x + 0.5, y + 0.5, width - 1, TRANSIENT_MESSAGE_HEIGHT - 1);
  }

  const onUpdate = () => {
    if ((messageKey || literal !== null) && (scene.time?.now ?? 0) >= expiresAtMs) {
      messageKey = null;
      literal = null;
      render();
    }
  };
  const unsubscribe = localization.subscribe(render);
  scene.events.on("update", onUpdate);

  return {
    show,
    getState: () => ({
      visible: Boolean(messageKey || literal !== null),
      messageKey,
      text: text.text,
      expiresAtMs,
      rect: text.visible ? {
        x: Math.round((GAME_WIDTH - Math.min(GAME_WIDTH - 24, Math.max(72, Math.ceil(text.width) + 12))) / 2),
        y: TRANSIENT_MESSAGE_Y,
        width: Math.min(GAME_WIDTH - 24, Math.max(72, Math.ceil(text.width) + 12)),
        height: TRANSIENT_MESSAGE_HEIGHT,
      } : null,
    }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe?.();
      scene.events.off("update", onUpdate);
      background.destroy();
      text.destroy();
    },
  };
}
