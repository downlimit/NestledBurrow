export const PLAYER_FOOT_WIDTH = 8;
export const PLAYER_FOOT_DEPTH = 5;
export const FACING_HYSTERESIS = 0.15;
export const WALK_FRAME_RATE = 8;
export const PLAYER_IDLE_FRAME_INDEX = 0;
export const PLAYER_WALK_FRAME_SEQUENCE = Object.freeze([1, 0, 2, 0]);

export const PLAYER_FRAMES = Object.freeze({
  right: Object.freeze(["tile_0269", "tile_0296", "tile_0323"]),
  down: Object.freeze(["tile_0267", "tile_0294", "tile_0321"]),
  left: Object.freeze(["tile_0266", "tile_0293", "tile_0320"]),
  up: Object.freeze(["tile_0268", "tile_0295", "tile_0322"]),
});

export const PLAYER_DIAGONAL_TEXTURE_KEY = "kenney-player-diagonal";
export const PLAYER_DIAGONAL_FRAMES = Object.freeze({
  "down-left": Object.freeze([0, 1, 2]),
  "down-right": Object.freeze([3, 4, 5]),
  "up-left": Object.freeze([6, 7, 8]),
  "up-right": Object.freeze([9, 10, 11]),
});
