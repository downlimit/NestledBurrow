import roomConfig from "./kenneyRoomConfig.json" with { type: "json" };

export const GAME_WIDTH = roomConfig.world.gameWidth;
export const GAME_HEIGHT = roomConfig.world.gameHeight;
export const TILE_SIZE = roomConfig.world.tileSize;
export const WORLD_COLUMNS = roomConfig.world.columns;
export const WORLD_ROWS = roomConfig.world.rows;
export const WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE;
export const WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE;
export const PLAYER_SPEED = 87;

export const ROOM_COLUMNS = roomConfig.world.roomColumns;
export const ROOM_ROWS = roomConfig.world.roomRows;
export const ROOM_TILE_X = roomConfig.world.roomTileX;
export const ROOM_TILE_Y = roomConfig.world.roomTileY;
export const DOOR_WIDTH = roomConfig.world.doorWidth;
export const DOOR_LEFT = ROOM_TILE_X + Math.floor((ROOM_COLUMNS - DOOR_WIDTH) / 2);
export const DOOR_Y = ROOM_TILE_Y + ROOM_ROWS - roomConfig.wallBands.length;

export const ROOM_TEXTURE_KEY = roomConfig.textureKey;
export const WORLD_TEXTURE_KEY = roomConfig.extension.textureKey;
export const ROOM_IMAGE_PATH = roomConfig.imagePath;
export const ROOM_ATLAS_PATH = roomConfig.atlasPath;
export const WORLD_IMAGE_PATH = roomConfig.extension.imagePath;
export const WORLD_ATLAS_PATH = roomConfig.extension.atlasPath;

export const WORLD_FRAMES = Object.freeze({
  grass: "grass",
  dirtPath: "dirtPath",
});

const WORLD_EXTENSION_FRAME_NAMES = new Set([
  ...Object.values(WORLD_FRAMES),
  ...roomConfig.wallBands.flatMap((band) => [band.upperLeft, band.upperRight]),
]);

export function isWorldExtensionFrame(frame) {
  return WORLD_EXTENSION_FRAME_NAMES.has(frame);
}
