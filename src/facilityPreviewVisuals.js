import { FACILITY_ASSETS } from "./facilityConfig.js";

const MIRRORED_METHODS = Object.freeze([
  "setPosition",
  "setDepth",
  "setScrollFactor",
  "setVisible",
  "setScale",
  "setAlpha",
]);

export function bindSpriteVisual(graphics, asset, tint = null) {
  if (!asset) throw new Error("A sprite asset is required");
  const scene = graphics?.scene;
  if (!scene?.add?.image) {
    graphics.spriteAsset = asset;
    graphics.spriteTint = tint;
    return graphics;
  }

  const image = scene.add.image(graphics.x ?? 0, graphics.y ?? 0, asset.key, asset.frame ?? 0).setOrigin(0, 0);
  image.setDepth?.(graphics.depth ?? 0);
  image.setScrollFactor?.(graphics.scrollFactorX ?? 1, graphics.scrollFactorY ?? graphics.scrollFactorX ?? 1);
  image.setVisible?.(graphics.visible ?? true);
  image.setScale?.(graphics.scaleX ?? 1, graphics.scaleY ?? graphics.scaleX ?? 1);
  image.setAlpha?.(graphics.alpha ?? 1);
  if (tint !== null) image.setTint?.(tint);

  for (const method of MIRRORED_METHODS) {
    const original = typeof graphics[method] === "function" ? graphics[method].bind(graphics) : null;
    graphics[method] = (...args) => {
      original?.(...args);
      image[method]?.(...args);
      return graphics;
    };
  }

  graphics.setTint = (...args) => {
    image.setTint?.(...args);
    return graphics;
  };
  graphics.clearTint = () => {
    image.clearTint?.();
    return graphics;
  };

  const originalDestroy = typeof graphics.destroy === "function" ? graphics.destroy.bind(graphics) : null;
  let destroyed = false;
  graphics.destroy = (...args) => {
    if (!destroyed) {
      destroyed = true;
      image.destroy?.(...args);
    }
    originalDestroy?.(...args);
    return graphics;
  };
  graphics.spriteImage = image;
  return graphics;
}

export function drawFacility(graphics, type, tint = null) {
  const asset = FACILITY_ASSETS[type];
  if (!asset) throw new Error(`Unknown facility preview type: ${type}`);
  return bindSpriteVisual(graphics, asset, tint);
}
