import {
  advancePuddleProgress,
  puddleAlpha,
  puddleCell,
  puddleCellKey,
  PUDDLE_MULTIPLY_BLEND_MODE,
  puddleSpriteCenter,
} from "./puddleDomain.js";

export const PUDDLE_TEXTURE_KEY = "puddle";
export const PUDDLE_ASSET = Object.freeze({
  key: PUDDLE_TEXTURE_KEY,
  path: "assets/project/resources/NestledBurrow_Puddle.png",
});
export const PUDDLE_DEPTH = 100;

export function preloadPuddleAsset(scene, baseUrl = import.meta.env.BASE_URL) {
  scene.load.image(PUDDLE_ASSET.key, `${baseUrl}${PUDDLE_ASSET.path}`);
}

export function createPuddleRuntime(scene, {
  getWorldTimeSeconds = () => 0,
  blendMode = PUDDLE_MULTIPLY_BLEND_MODE,
} = {}) {
  if (!scene?.add) throw new Error("Puddle runtime requires a Phaser rendering host");
  let destroyed = false;
  const puddles = new Map();

  function spawn(position = {}) {
    if (destroyed) return { status: "destroyed", mutated: false };
    const cell = puddleCell(position);
    const key = puddleCellKey(cell);
    const existing = puddles.get(key);
    if (existing) {
      existing.progress = 0;
      existing.sprite.setAlpha(1);
      return { status: "reset", mutated: false, cell: { ...cell } };
    }
    const center = puddleSpriteCenter(cell);
    const sprite = scene.add.image(center.x, center.y, PUDDLE_TEXTURE_KEY)
      .setOrigin(0.5)
      .setDepth(PUDDLE_DEPTH)
      .setBlendMode(blendMode);
    puddles.set(key, { cell, sprite, progress: 0 });
    return { status: "spawned", mutated: true, cell: { ...cell } };
  }

  function update(deltaMs) {
    if (destroyed) return;
    const realSeconds = Math.max(0, Number(deltaMs) || 0) / 1000;
    const worldTimeSeconds = getWorldTimeSeconds();
    for (const [key, puddle] of [...puddles]) {
      puddle.progress = advancePuddleProgress(puddle.progress, realSeconds, worldTimeSeconds);
      puddle.sprite.setAlpha(puddleAlpha(puddle.progress));
      if (puddle.progress >= 1) {
        puddle.sprite.destroy();
        puddles.delete(key);
      }
    }
  }

  function clear() {
    for (const puddle of puddles.values()) puddle.sprite?.destroy?.();
    puddles.clear();
  }

  function destroy() {
    if (destroyed) return;
    clear();
    destroyed = true;
  }

  function getState() {
    return [...puddles.values()].map((puddle) => ({
      x: puddle.cell.x,
      y: puddle.cell.y,
      progress: puddle.progress,
    }));
  }

  return Object.freeze({ spawn, update, clear, destroy, getState });
}
