import { TILE_SIZE } from "../world/worldConfig.js";

export const LEMONADE_TEXTURE_KEY = "lemonade.sheet";
export const LEMONADE_SHEET_PATH = "assets/project/lemonade/NestledBurrow_Lemonade.png";
export const BROKEN_STOVE_TEXTURE_KEY = "facility.gas-stove-broken";
export const BROKEN_STOVE_PATH = "assets/project/lemonade/NestledBurrow_GasStoveBroken.png";

export const LEMONADE_FRAME_ORDER = Object.freeze([
  "axe",
  "pickaxe",
  "hoe",
  "water-bucket-empty",
  "water-bucket-full",
  "lemon-seeds",
  "lemon",
  "sliced-potato",
  "lemonade",
  "lemon-sack-full",
  "lemon-sack-empty",
  "juicer",
  "lemon-crop-planted",
  "lemon-crop-planted-rotten",
  "lemon-crop-sprout",
  "lemon-crop-young",
  "lemon-crop-mature",
  "lemon-crop-rotten",
]);

export const LEMONADE_FRAMES = Object.freeze(Object.fromEntries(
  LEMONADE_FRAME_ORDER.map((name, index) => [name, index]),
));

export function preloadLemonadeAssets(scene, baseUrl = import.meta.env.BASE_URL) {
  scene.load.spritesheet(LEMONADE_TEXTURE_KEY, `${baseUrl}${LEMONADE_SHEET_PATH}`, {
    frameWidth: TILE_SIZE,
    frameHeight: TILE_SIZE,
  });
  scene.load.image(BROKEN_STOVE_TEXTURE_KEY, `${baseUrl}${BROKEN_STOVE_PATH}`);
}

export function lemonadeInventoryFrame(itemId, currentWater = 0) {
  const frames = {
    axe: LEMONADE_FRAMES.axe,
    pickaxe: LEMONADE_FRAMES.pickaxe,
    hoe: LEMONADE_FRAMES.hoe,
    "lemon-seed": LEMONADE_FRAMES["lemon-seeds"],
    lemon: LEMONADE_FRAMES.lemon,
    "sliced-potato": LEMONADE_FRAMES["sliced-potato"],
    lemonade: LEMONADE_FRAMES.lemonade,
  };
  if (itemId === "water-bucket") {
    return currentWater > 0
      ? LEMONADE_FRAMES["water-bucket-full"]
      : LEMONADE_FRAMES["water-bucket-empty"];
  }
  return frames[itemId] ?? null;
}

export function lemonCropFrame(crop) {
  if (!crop || crop.type !== "lemon") return null;
  if (crop.rotten) return crop.firstHydratedAt === null
    ? LEMONADE_FRAMES["lemon-crop-planted-rotten"]
    : LEMONADE_FRAMES["lemon-crop-rotten"];
  if (crop.mature) return LEMONADE_FRAMES["lemon-crop-mature"];
  if (crop.firstHydratedAt === null) return LEMONADE_FRAMES["lemon-crop-planted"];
  if (crop.effectiveGrowthSeconds < 60 * 60) return LEMONADE_FRAMES["lemon-crop-sprout"];
  return LEMONADE_FRAMES["lemon-crop-young"];
}
