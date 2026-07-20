export const ART_SCALE = 3;
export const TILE_SIZE = 16;
export const WALL_TILES = 1;
export const PLAYER_FOOT_WIDTH = 24;
export const PLAYER_FOOT_DEPTH = 10;
export const FACING_HYSTERESIS = 0.15;
export const WALK_FRAME_RATE = 8;
export const PLAYER_IDLE_FRAME_INDEX = 0;

export const ROOM_SHEET = Object.freeze({
  frameWidth: TILE_SIZE,
  frameHeight: TILE_SIZE,
  margin: 0,
  spacing: 1,
  sourceWidth: 968,
  sourceHeight: 526,
});

export const PLAYER_FRAMES = Object.freeze({
  down: Object.freeze(["tile_0267", "tile_0294", "tile_0321"]),
  up: Object.freeze(["tile_0268", "tile_0295", "tile_0322"]),
  left: Object.freeze(["tile_0266", "tile_0293", "tile_0320"]),
  right: Object.freeze(["tile_0269", "tile_0296", "tile_0323"]),
});

export const ROOM_FRAMES = Object.freeze({
  floor: 494,
  top: 90,
  bottom: 147,
  left: 146,
  right: 148,
  topLeft: 89,
  topRight: 91,
  bottomLeft: 203,
  bottomRight: 205,
});
