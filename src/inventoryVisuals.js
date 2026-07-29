import { drawLog, drawRuby, drawStone } from "./resourceVisuals.js";
import { FARMING_FRAMES, FARMING_TEXTURE_KEY } from "./farmingConfig.js";
import { LEMONADE_TEXTURE_KEY, lemonadeInventoryFrame } from "./lemonadeConfig.js";

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
  graphics.fillStyle(color(0x4a332a), 1).fillRect(3, 3, 10, 10);
  graphics.fillStyle(color(0xf2eadc), 0.9).fillRect(7, 5, 2, 5).fillRect(7, 12, 2, 2);
  return graphics;
}

export function inventoryItemAsset(itemId, gameplay = {}) {
  const lemonadeFrame = lemonadeInventoryFrame(itemId, gameplay?.farm?.waterBucket?.currentWater ?? 0);
  if (lemonadeFrame !== null) return { textureKey: LEMONADE_TEXTURE_KEY, frame: lemonadeFrame };
  if (itemId === "potato-seed") return { textureKey: FARMING_TEXTURE_KEY, frame: FARMING_FRAMES.potatoSeeds };
  if (itemId === "potato") return { textureKey: FARMING_TEXTURE_KEY, frame: FARMING_FRAMES.potato };
  if (itemId === "fried-potato-dish") return { textureKey: "facility.fried-potato-dish", frame: 0 };
  return null;
}

export function renderInventoryItem(graphics, image, itemId, gameplay, x = 0, y = 0) {
  const asset = inventoryItemAsset(itemId, gameplay);
  graphics.clear().setPosition(x, y).setVisible(asset === null);
  image.setPosition(x, y).setVisible(asset !== null);
  if (asset) image.setTexture(asset.textureKey, asset.frame);
  else drawInventoryItem(graphics, itemId);
  return asset;
}
