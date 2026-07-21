import { GAME_WIDTH } from "./worldConfig.js";

export const HUD_DEPTH = 10000;
export const HUD_COLORS = {
  panel: 0x171724,
  border: 0x8c6f4a,
  light: 0xf2eadc,
  mid: 0xd9c18f,
  shadow: 0x4a332a,
};

export const FULLSCREEN_HIT_AREA = Object.freeze({ x: GAME_WIDTH - 34, y: 4, width: 30, height: 30 });
export const FULLSCREEN_ICON_RECT = Object.freeze({ x: GAME_WIDTH - 26, y: 12, size: 14 });
export const BUILD_LABEL = Object.freeze({ x: GAME_WIDTH - 38, y: 8 });

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_SPACING = 1;
const SPACE_WIDTH = 3;

export const HUD_GLYPHS = Object.freeze({
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  v: ["00000", "00000", "10001", "10001", "01010", "01010", "00100"],
  d: ["00001", "00001", "01101", "10011", "10001", "10011", "01101"],
  e: ["00000", "00000", "01110", "10001", "11110", "10000", "01110"],
  f: ["00110", "01001", "01000", "11100", "01000", "01000", "01000"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "10110", "11001", "10001", "11001", "10110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10000", "01110"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
});

export function compactBuildLabel(buildId) {
  return `v ${String(buildId || "dev").slice(0, 7)}`;
}

export function measureBitmapText(text) {
  return [...text].reduce((width, char, index) => {
    const glyphWidth = char === " " ? SPACE_WIDTH : GLYPH_WIDTH;
    return width + glyphWidth + (index === text.length - 1 ? 0 : GLYPH_SPACING);
  }, 0);
}

export function isPointInRect(x, y, rect) {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height;
}

export function drawBitmapText(scene, x, y, text, { color = HUD_COLORS.light, shadow = HUD_COLORS.shadow } = {}) {
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH).setScrollFactor(0);
  let cursorX = Math.round(x);
  const baseY = Math.round(y);
  for (const char of text) {
    const glyph = HUD_GLYPHS[char] ?? HUD_GLYPHS[char.toLowerCase()] ?? HUD_GLYPHS[" "];
    if (shadow) {
      graphics.fillStyle(shadow, 0.75);
      drawGlyphPixels(graphics, glyph, cursorX + 1, baseY + 1);
    }
    graphics.fillStyle(color, 0.88);
    drawGlyphPixels(graphics, glyph, cursorX, baseY);
    cursorX += (char === " " ? SPACE_WIDTH : GLYPH_WIDTH) + GLYPH_SPACING;
  }
  return graphics;
}

function drawGlyphPixels(graphics, glyph, x, y) {
  for (let row = 0; row < GLYPH_HEIGHT; row += 1) {
    for (let col = 0; col < GLYPH_WIDTH; col += 1) {
      if (glyph[row]?.[col] === "1") graphics.fillRect(x + col, y + row, 1, 1);
    }
  }
}

export function drawFullscreenIcon(scene, active) {
  const hit = scene.add
    .zone(FULLSCREEN_HIT_AREA.x, FULLSCREEN_HIT_AREA.y, FULLSCREEN_HIT_AREA.width, FULLSCREEN_HIT_AREA.height)
    .setOrigin(0, 0)
    .setDepth(HUD_DEPTH + 2)
    .setScrollFactor(0)
    .setInteractive({ useHandCursor: true });
  const graphics = scene.add.graphics().setDepth(HUD_DEPTH + 1).setScrollFactor(0);
  renderFullscreenIcon(graphics, active);
  return { hit, graphics };
}

export function renderFullscreenIcon(graphics, active) {
  const { x, y, size } = FULLSCREEN_ICON_RECT;
  graphics.clear();
  graphics.fillStyle(HUD_COLORS.panel, 0.78).fillRect(FULLSCREEN_HIT_AREA.x + 3, FULLSCREEN_HIT_AREA.y + 3, 24, 24);
  graphics.lineStyle(1, HUD_COLORS.border, 0.9).strokeRect(FULLSCREEN_HIT_AREA.x + 3.5, FULLSCREEN_HIT_AREA.y + 3.5, 23, 23);
  graphics.fillStyle(HUD_COLORS.light, 0.95);
  const corners = active
    ? [[x + 5, y + 5, -1, -1], [x + size - 6, y + 5, 1, -1], [x + 5, y + size - 6, -1, 1], [x + size - 6, y + size - 6, 1, 1]]
    : [[x, y, 1, 1], [x + size - 1, y, -1, 1], [x, y + size - 1, 1, -1], [x + size - 1, y + size - 1, -1, -1]];
  for (const [cx, cy, sx, sy] of corners) {
    const horizontalX = sx < 0 ? cx - 4 : cx;
    const verticalY = sy < 0 ? cy - 4 : cy;
    graphics.fillRect(horizontalX, cy, 5, 1);
    graphics.fillRect(cx, verticalY, 1, 5);
  }
}
