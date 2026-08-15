import { NEED_IDS, NEED_SYMBOLS } from "../needs/needsDomain.js";
import { HUD_COLORS, drawBitmapTextInto } from "./hud.js";

export const NEED_PANEL_SIZE = Object.freeze({ width: 60, height: 68 });
export const NEED_ROW_IDS = NEED_IDS;
export const NEED_ROW_SYMBOLS = Object.freeze(NEED_ROW_IDS.map((id) => NEED_SYMBOLS[id]));
export const NEED_VALUE_TRACK = Object.freeze({ xOffset: 12, width: 23 });

export function createNeedsPanelGeometry(x, y) {
  const panel = Object.freeze({ x, y, ...NEED_PANEL_SIZE });
  const rows = Object.freeze(NEED_ROW_IDS.map((_id, index) => Object.freeze({
    x: panel.x,
    y: panel.y + 4 + index * 10,
    width: panel.width,
    height: 10,
  })));
  return Object.freeze({ panel, rows });
}

export function drawNeedsPanel(graphics, {
  geometry,
  values,
  alpha = 1,
  criticalNeedId = "energy",
} = {}) {
  const opacity = Math.min(1, Math.max(0, Number(alpha) || 0));
  const { panel, rows } = geometry;
  graphics.fillStyle(HUD_COLORS.panel, 0.86 * opacity).fillRect(panel.x, panel.y, panel.width, panel.height);
  graphics.lineStyle(1, HUD_COLORS.border, opacity).strokeRect(panel.x + 0.5, panel.y + 0.5, panel.width - 1, panel.height - 1);
  return NEED_ROW_IDS.map((id, index) => {
    const rect = rows[index];
    const ratio = Math.min(1, Math.max(0, Number(values?.[id]) / 100 || 0));
    drawBitmapTextInto(graphics, rect.x + 3, rect.y + 1, NEED_ROW_SYMBOLS[index], { shadow: 0, alpha: opacity });
    graphics.fillStyle(HUD_COLORS.shadow, opacity).fillRect(rect.x + NEED_VALUE_TRACK.xOffset - 1, rect.y + 2, NEED_VALUE_TRACK.width + 2, 6);
    const fillWidth = ratio > 0 ? Math.max(1, Math.round(NEED_VALUE_TRACK.width * ratio)) : 0;
    const critical = id === criticalNeedId && ratio < 0.15;
    graphics.fillStyle(critical ? 0xd94a4a : HUD_COLORS.mid, opacity)
      .fillRect(rect.x + NEED_VALUE_TRACK.xOffset, rect.y + 3, fillWidth, 4);
    return {
      id,
      symbol: NEED_ROW_SYMBOLS[index],
      ratio,
      rect,
      track: {
        x: rect.x + NEED_VALUE_TRACK.xOffset,
        y: rect.y + 2,
        width: NEED_VALUE_TRACK.width,
        height: 6,
      },
    };
  });
}
