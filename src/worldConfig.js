export const GAME_WIDTH = 320;
export const GAME_HEIGHT = 180;
export const TILE_SIZE = 16;
export const WORLD_COLUMNS = 64;
export const WORLD_ROWS = 48;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;
export const PLAYER_SPEED = 87;

export const OUTDOOR_TEXTURE_KEY = "basic-village-outdoor";
export const HOUSE_TEXTURE_KEY = "basic-village-house";
export const TREES_TEXTURE_KEY = "basic-village-trees";

export const OUTDOOR_IMAGE_URL = new URL(
  "../tasks/basic-village/source/basic/BasicVillageTileset/Outdoor_tileset.png",
  import.meta.url,
).href;
export const HOUSE_IMAGE_URL = new URL(
  "../tasks/basic-village/source/basic/BasicVillageTileset/House_tileset.png",
  import.meta.url,
).href;
export const TREES_IMAGE_URL = new URL(
  "../tasks/basic-village/source/basic/BasicVillageTileset/Trees_and_bushes.png",
  import.meta.url,
).href;

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
  dirt: 7,
  dirtDetails: Object.freeze([6, 8, 18, 19]),
});

export const HOUSE_FRAMES = Object.freeze({
  floor: 54,
  floorDetails: Object.freeze([53, 54, 55, 65, 66, 67, 77, 78, 79]),
  topLeft: 0,
  top: 1,
  topRight: 2,
  upperLeft: 24,
  upper: 25,
  upperRight: 26,
  sideLeft: 3,
  sideRight: 4,
  lowerLeft: 24,
  lower: 25,
  lowerRight: 26,
});
