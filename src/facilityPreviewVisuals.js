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

export function bindCompositeSpriteVisual(graphics, asset, tint = null) {
  if (!asset?.key || !Array.isArray(asset.frames) || !asset.frames.length) throw new Error("A composite sprite asset is required");
  const scene = graphics?.scene;
  if (!scene?.add?.container || !scene?.add?.image) {
    graphics.spriteAsset = asset;
    graphics.spriteTint = tint;
    return graphics;
  }
  const columns = Math.max(1, Number(asset.columns) || 1);
  const frameWidth = Math.max(1, Number(asset.frameWidth) || 16);
  const frameHeight = Math.max(1, Number(asset.frameHeight) || 16);
  const images = asset.frames.map((frame, index) => {
    const image = scene.add.image((index % columns) * frameWidth, Math.floor(index / columns) * frameHeight, asset.key, frame).setOrigin(0, 0);
    if (tint !== null) image.setTint?.(tint);
    return image;
  });
  const container = scene.add.container(graphics.x ?? 0, graphics.y ?? 0, images)
    .setDepth(graphics.depth ?? 0)
    .setVisible(graphics.visible ?? true)
    .setScale(graphics.scaleX ?? 1, graphics.scaleY ?? graphics.scaleX ?? 1)
    .setAlpha(graphics.alpha ?? 1);
  for (const method of MIRRORED_METHODS) {
    const original = typeof graphics[method] === "function" ? graphics[method].bind(graphics) : null;
    graphics[method] = (...args) => {
      original?.(...args);
      container[method]?.(...args);
      return graphics;
    };
  }
  graphics.setTint = (...args) => { for (const image of images) image.setTint?.(...args); return graphics; };
  graphics.clearTint = () => { for (const image of images) image.clearTint?.(); return graphics; };
  const originalDestroy = typeof graphics.destroy === "function" ? graphics.destroy.bind(graphics) : null;
  let destroyed = false;
  graphics.destroy = (...args) => {
    if (!destroyed) {
      destroyed = true;
      container.destroy?.(true);
    }
    originalDestroy?.(...args);
    return graphics;
  };
  graphics.spriteContainer = container;
  return graphics;
}

export function drawFacility(graphics, type, tint = null) {
  const asset = FACILITY_ASSETS[type];
  if (!asset) throw new Error(`Unknown facility preview type: ${type}`);
  return bindSpriteVisual(graphics, asset, tint);
}
