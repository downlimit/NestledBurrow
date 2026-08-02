import { TILE_SIZE } from "../world/worldConfig.js";

export const FARMING_TEXTURE_KEY = "farming.sheet";
export const FARMING_WELL_TEXTURE_KEY = "farming.well";
export const FARMING_SHEET_PATH = "assets/project/farming/NestledBurrow_Farming.png";
export const FARMING_WELL_PATH = "assets/project/farming/NestledBurrow_Well.png";

export const FARMING_FRAMES = Object.freeze({
  potatoSeeds: 0,
  potato: 1,
  soilDry: 2,
  soilWet100: 3,
  soilWet66: 4,
  soilWet33: 5,
  cropPlanted: 6,
  cropPlantedRotten: 7,
  cropSprout: 8,
  cropYoung: 9,
  cropMature: 10,
  cropRotten: 11,
});

export const WATER_BUCKET_CAPACITY = 8;
export const SOLAR_DAY_START_SECONDS = 4 * 60 * 60;
export const SOLAR_DAY_END_SECONDS = 20 * 60 * 60;
export const POTATO_REQUIRED_GROWTH_SECONDS = 8 * 60 * 60;
export const POTATO_DAILY_GROWTH_CAP_SECONDS = 4 * 60 * 60;
export const LEMON_REQUIRED_GROWTH_SECONDS = 4 * 60 * 60;
export const LEMON_DAILY_GROWTH_CAP_SECONDS = 4 * 60 * 60;
export const DRY_SEED_ROT_SECONDS = 24 * 60 * 60;
export const DRY_CROP_ROT_SECONDS = 48 * 60 * 60;

export const POTATO_CROP_PROFILE = Object.freeze({
  id: "potato",
  requiredEffectiveGrowthSeconds: POTATO_REQUIRED_GROWTH_SECONDS,
  maximumEffectiveGrowthPerDay: POTATO_DAILY_GROWTH_CAP_SECONDS,
  weatherGrowthMultipliers: Object.freeze({
    clear: 1,
    cloudy: 0.5,
    rain: 2,
  }),
  collision: false,
});
export const LEMON_CROP_PROFILE = Object.freeze({
  id: "lemon",
  requiredEffectiveGrowthSeconds: LEMON_REQUIRED_GROWTH_SECONDS,
  maximumEffectiveGrowthPerDay: LEMON_DAILY_GROWTH_CAP_SECONDS,
  weatherGrowthMultipliers: POTATO_CROP_PROFILE.weatherGrowthMultipliers,
  collision: false,
});
export const CROP_PROFILES = Object.freeze({
  potato: POTATO_CROP_PROFILE,
  lemon: LEMON_CROP_PROFILE,
});

export const FARMING_INTERACTION_KINDS = Object.freeze({
  till: "farm-till",
  plant: "farm-plant",
  water: "farm-water",
  harvest: "farm-harvest",
  clearRotten: "farm-clear-rotten",
  axeCell: "farm-axe-cell",
  refill: "farm-refill-water-bucket",
});

export const WELL_PROFILE = Object.freeze({
  id: "well",
  width: TILE_SIZE,
  height: TILE_SIZE,
  depthAnchorOffset: Object.freeze({ x: 8, y: 14 }),
  collisionRect: Object.freeze({ left: 2, top: 8, right: 14, bottom: 14 }),
});

export const STARTER_WELL = Object.freeze({
  id: "farm-well-1",
  x: 544,
  y: 496,
  fixed: true,
});

export function preloadFarmingAssets(scene, baseUrl = import.meta.env.BASE_URL) {
  scene.load.spritesheet(FARMING_TEXTURE_KEY, `${baseUrl}${FARMING_SHEET_PATH}`, {
    frameWidth: TILE_SIZE,
    frameHeight: TILE_SIZE,
  });
  scene.load.image(FARMING_WELL_TEXTURE_KEY, `${baseUrl}${FARMING_WELL_PATH}`);
}
