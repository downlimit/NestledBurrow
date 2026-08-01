import { bindCompositeSpriteVisual } from "./facilityPreviewVisuals.js";
import { TILE_SIZE, TREE_FRAMES, TREES_TEXTURE_KEY } from "./worldConfig.js";

export function drawLog(graphics, progress = 0, size = "small", options = {}) {
  const color = (value) => options.colorOverride ?? value;
  const scale = size === "large" ? 1.5 : 1;
  graphics.setScale?.(scale);
  const damage = Math.min(5, Math.floor(Math.max(0, progress) * 5));
  graphics.fillStyle(color(0x3d2517), 1).fillRect(2, 6, 12, 5);
  graphics.fillStyle(color(0x6f3f22), 1).fillRect(3, 5, 10, 2).fillRect(3, 10, 10, 2);
  graphics.fillStyle(color(0x9b6337), 1).fillRect(2, 6, 2, 5).fillRect(12, 6, 2, 5);
  graphics.fillStyle(color(0xd49a55), 1).fillRect(3, 7, 1, 2).fillRect(12, 7, 1, 2);
  graphics.fillStyle(color(0xf2eadc), 0.9);
  for (let index = 0; index < damage; index += 1) graphics.fillRect(5 + index * 2, 7 + (index % 2), 1, 3);
  graphics.fillStyle(color(0x2f6b2f), 1).fillRect(6, 3, 2, 3).fillRect(9, 11, 2, 2);
}

export function drawRuby(graphics, progress = 0, options = {}) {
  const color = (value) => options.colorOverride ?? value;
  const damage = Math.min(5, Math.floor(Math.max(0, progress) * 5));
  graphics.fillStyle(color(0x5c1028), 1).fillRect(6, 2, 4, 2).fillRect(4, 4, 8, 7).fillRect(6, 11, 4, 3);
  graphics.fillStyle(color(0xd92767), 1).fillRect(6, 3, 3, 8).fillRect(5, 5, 6, 4);
  graphics.fillStyle(color(0xff8ab3), 1).fillRect(7, 4, 2, 2);
  graphics.fillStyle(color(0x2f1730), 1).fillRect(4, 13, 8, 2);
  graphics.fillStyle(color(0xf2eadc), 0.9);
  for (let index = 0; index < damage; index += 1) graphics.fillRect(5 + index * 2, 7, 1, 3);
}

export function drawStone(graphics, progress = 0, size = "small", options = {}) {
  const color = (value) => options.colorOverride ?? value;
  graphics.setScale?.(size === "large" ? 1.5 : 1);
  const damage = Math.min(5, Math.floor(Math.max(0, progress) * 5));
  graphics.fillStyle(color(0x353b46), 1).fillRect(3, 5, 10, 7).fillRect(5, 3, 6, 11);
  graphics.fillStyle(color(0x667080), 1).fillRect(4, 5, 7, 5).fillRect(6, 3, 4, 2);
  graphics.fillStyle(color(0x9aa3ad), 1).fillRect(5, 5, 3, 2);
  graphics.fillStyle(color(0x20242c), 1).fillRect(4, 12, 8, 2);
  graphics.fillStyle(color(0xf2eadc), 0.85);
  for (let index = 0; index < damage; index += 1) graphics.fillRect(5 + index * 2, 7 + (index % 2), 1, 3);
}

export function drawResourceVisual(graphics, profile, progress = 0, options = {}) {
  if (profile.visual === "tree") {
    if (!graphics.spriteContainer) {
      bindCompositeSpriteVisual(
        graphics,
        { key: TREES_TEXTURE_KEY, frames: TREE_FRAMES.planted, columns: 3, frameWidth: TILE_SIZE, frameHeight: TILE_SIZE },
        options.colorOverride ?? null,
      );
    }
    return graphics;
  }
  if (profile.visual === "log") return drawLog(graphics, progress, profile.size, options);
  if (profile.visual === "stone") return drawStone(graphics, progress, profile.size, options);
  if (profile.visual === "ruby") return drawRuby(graphics, progress, options);
  throw new Error(`Unknown resource visual: ${String(profile.visual)}`);
}

export const drawResource = drawResourceVisual;
