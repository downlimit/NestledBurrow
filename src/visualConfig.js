export const ART_SCALE = 3;
export const TILE_SIZE = 16;
export const WALL_TILES = 1;
export const PLAYER_FOOT_WIDTH = 24;
export const PLAYER_FOOT_DEPTH = 10;
export const FACING_HYSTERESIS = 0.15;
export const WALK_FRAME_RATE = 8;
export const PLAYER_IDLE_FRAME_INDEX = 0;

export const PLAYER_FRAMES = Object.freeze({
  down: Object.freeze(["tile_0267", "tile_0294", "tile_0321"]),
  up: Object.freeze(["tile_0268", "tile_0295", "tile_0322"]),
  left: Object.freeze(["tile_0266", "tile_0293", "tile_0320"]),
  right: Object.freeze(["tile_0269", "tile_0296", "tile_0323"]),
});

export const ROOM_TEXTURES = Object.freeze({
  floor: "room-floor",
  wallHorizontal: "room-wall-horizontal",
  wallVertical: "room-wall-vertical",
  corner: "room-wall-corner",
});
