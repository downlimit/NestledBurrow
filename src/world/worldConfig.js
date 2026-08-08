export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;
export const TILE_SIZE = 16;
export const WORLD_COLUMNS = 64;
export const WORLD_ROWS = 48;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;

export const BASIC_VILLAGE_ASSET_PATH = "assets/third-party/basic-village";
export const OUTDOOR_TEXTURE_KEY = "basic-village-outdoor";
export const HOUSE_TEXTURE_KEY = "basic-village-house";
export const TREES_TEXTURE_KEY = "basic-village-trees";
export const OUTDOOR_IMAGE_PATH = "Outdoor_tileset.png";
export const HOUSE_IMAGE_PATH = "House_tileset.png";
export const TREES_IMAGE_PATH = "Trees_and_bushes.png";

export const WORLD_TRANSITION_PROFILE_KEYS = Object.freeze({
  burrowToNest: "transition:burrow-to-nest",
  nestToBurrow: "transition:nest-to-burrow",
});

export const WORLD_TRANSITION_ASSETS = Object.freeze({
  burrowToNest: Object.freeze({
    textureKey: "world-transition-burrow-to-nest",
    path: "assets/project/world/NestledBurrow_NestStairway.png",
    width: 64,
    height: 128,
  }),
  nestToBurrow: Object.freeze({
    textureKey: "world-transition-nest-to-burrow",
    path: "assets/project/world/NestledBurrow_HighgroundEntranceStairs.png",
    width: 64,
    height: 48,
  }),
});

export const HOUSE = Object.freeze({
  x: 19,
  y: 11,
  columns: 26,
  rows: 17,
  doorWidth: 3,
});

export const DOOR_LEFT = HOUSE.x + Math.floor((HOUSE.columns - HOUSE.doorWidth) / 2);
export const DOOR_Y = HOUSE.y + HOUSE.rows;

export const OUTDOOR_FRAMES = Object.freeze({
  grass: 0,
  grassDetails: Object.freeze([1, 2, 12, 13, 14, 24, 25, 26]),
  grassOuterCorners: Object.freeze({
    topLeft: 18,
    topRight: 19,
    bottomLeft: 30,
    bottomRight: 31,
  }),
  pathTop: Object.freeze([3, 4, 5]),
  pathMiddle: Object.freeze([15, 16, 17]),
  pathBottom: Object.freeze([27, 28, 29]),
  islandCliff: Object.freeze({
    topLeft: 36,
    top: 37,
    topRight: 38,
    left: 48,
    right: 50,
    bottomLeft: 60,
    bottom: 61,
    bottomRight: 62,
  }),
  islandInnerCorner: Object.freeze({
    topLeft: 78,
    topRight: 77,
    bottomLeft: 42,
    bottomRight: 41,
  }),
  transport: Object.freeze({
    entranceLeft: 22,
    entranceRight: 23,
  }),
});

export const HOUSE_FRAMES = Object.freeze({
  topLeft: 0,
  top: 1,
  topRight: 2,
  sideLeft: 3,
  sideRight: 4,
  wallLeftCap: 12,
  wallMiddle: 13,
  wallRightCap: 14,
  bottomLeft: 24,
  bottom: 25,
  bottomRight: 26,
  floor: 66,
  carpet: Object.freeze({
    topLeft: 57,
    top: 58,
    topRight: 59,
    left: 69,
    center: 70,
    right: 71,
    bottomLeft: 81,
    bottom: 82,
    bottomRight: 83,
  }),
  transport: Object.freeze({
    topLeft: 0,
    topRight: 2,
  }),
});

export const TREE_FRAMES = Object.freeze({
  planted: Object.freeze([0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 29]),
});
