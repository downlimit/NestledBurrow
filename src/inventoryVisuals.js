import { drawLog, drawRuby, drawStone } from "./resourceVisuals.js";

export function drawInventoryItem(graphics, itemId, options = {}) {
  const color = (value) => options.colorOverride ?? value;
  graphics.clear();
  graphics.setScale?.(1);
  if (itemId === "wood") {
    drawLog(graphics, 0, "small", options);
    return graphics;
  }
  if (itemId === "stone") {
    drawStone(graphics, 0, "small", options);
    return graphics;
  }
  if (itemId === "ruby") {
    drawRuby(graphics, 0, options);
    return graphics;
  }
  if (itemId === "axe") {
    graphics.fillStyle(color(0x6f3f22), 1).fillRect(7, 2, 2, 13);
    graphics.fillStyle(color(0x9aa3ad), 1).fillRect(3, 2, 8, 3).fillRect(2, 3, 3, 3);
    graphics.fillStyle(color(0xf2eadc), 0.8).fillRect(4, 2, 3, 1);
    return graphics;
  }
  if (itemId === "hoe") {
    graphics.fillStyle(color(0x6f3f22), 1).fillRect(7, 2, 2, 13);
    graphics.fillStyle(color(0x9aa3ad), 1).fillRect(2, 2, 8, 2).fillRect(2, 3, 2, 4);
    graphics.fillStyle(color(0xf2eadc), 0.8).fillRect(3, 2, 4, 1);
    return graphics;
  }
  if (itemId === "watering-can") {
    graphics.fillStyle(color(0x3e7f9b), 1).fillRect(3, 6, 9, 7).fillRect(12, 8, 3, 2);
    graphics.lineStyle(1, color(0x9dd7e6), 1).strokeRect(5.5, 2.5, 6, 5);
    graphics.fillStyle(color(0x9dd7e6), 1).fillRect(4, 7, 2, 1);
    return graphics;
  }
  graphics.fillStyle(color(0x4a332a), 1).fillRect(3, 3, 10, 10);
  graphics.fillStyle(color(0xf2eadc), 0.9).fillRect(7, 5, 2, 5).fillRect(7, 12, 2, 2);
  return graphics;
}
