export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;
export const TILE_SIZE = 16;
export const WORLD_COLUMNS = 64;
export const WORLD_ROWS = 48;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;
export const PLAYER_SPEED = 87;

export const BASIC_VILLAGE_ASSET_PATH = "assets/third-party/basic-village";
export const OUTDOOR_TEXTURE_KEY = "basic-village-outdoor";
export const HOUSE_TEXTURE_KEY = "basic-village-house";
export const TREES_TEXTURE_KEY = "basic-village-trees";
export const OUTDOOR_IMAGE_PATH = "Outdoor_tileset.png";
export const HOUSE_IMAGE_PATH = "House_tileset.png";
export const TREES_IMAGE_PATH = "Trees_and_bushes.png";

export const HOUSE = Object.freeze({
  x: 19,
  y: 11,
  columns: 26,
  rows: 17,
  doorWidth: 2,
});

export const DOOR_LEFT = HOUSE.x + Math.floor((HOUSE.columns - HOUSE.doorWidth) / 2);
export const DOOR_Y = HOUSE.y + HOUSE.rows - 1;

export const OUTDOOR_FRAMES = Object.freeze({
  grass: 0,
  grassDetails: Object.freeze([1, 2, 12, 13, 14, 24, 25, 26]),
  pathTop: Object.freeze([3, 4, 5]),
  pathMiddle: Object.freeze([15, 16, 17]),
  pathBottom: Object.freeze([27, 28, 29]),
});

export const HOUSE_FRAMES = Object.freeze({
  topLeft: 0,
  top: 1,
  topRight: 2,
  sideLeft: 3,
  sideRight: 4,
  bottomLeft: 24,
  bottom: 25,
  bottomRight: 26,
  floor: Object.freeze([53, 54, 55, 65, 66, 67, 77, 78, 79]),
});
