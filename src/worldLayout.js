import roomConfig from "./kenneyRoomConfig.json" with { type: "json" };
import { buildRoomLayout, ROOM_WALL_BANDS } from "./roomLayout.js";
import {
  DOOR_LEFT,
  DOOR_WIDTH,
  DOOR_Y,
  ROOM_COLUMNS,
  ROOM_ROWS,
  ROOM_TILE_X,
  ROOM_TILE_Y,
  WORLD_COLUMNS,
  WORLD_FRAMES,
  WORLD_ROWS,
} from "./worldConfig.js";

export function createWorldLayout() {
  const terrain = Array.from({ length: WORLD_ROWS }, () => Array(WORLD_COLUMNS).fill(WORLD_FRAMES.grass));
  const room = buildRoomLayout(ROOM_COLUMNS, ROOM_ROWS, { doorway: { left: DOOR_LEFT - ROOM_TILE_X, width: DOOR_WIDTH } });
  const blocked = new Set();
  const roomTiles = [];
  const outdoorTiles = [];

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLUMNS; x += 1) {
      outdoorTiles.push({ x, y, frame: terrain[y][x] });
    }
  }

  const pathX0 = DOOR_LEFT;
  const pathX1 = DOOR_LEFT + DOOR_WIDTH - 1;
  for (let y = DOOR_Y + 1; y < WORLD_ROWS; y += 1) {
    for (let x = pathX0; x <= pathX1; x += 1) {
      outdoorTiles.push({ x, y, frame: WORLD_FRAMES.dirtPath });
    }
  }

  room.forEach((row, localY) => {
    row.forEach((frame, localX) => {
      if (frame === null) return;
      const x = ROOM_TILE_X + localX;
      const y = ROOM_TILE_Y + localY;
      roomTiles.push({ x, y, frame });
      if (frame !== roomConfig.floorFrame) {
        blocked.add(cellKey(x, y));
      }
    });
  });

  return { outdoorTiles, roomTiles, blocked, spawn: getSpawnPoint(), outdoorTarget: getOutdoorTarget() };
}

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function isBlockedCell(layout, x, y) {
  return layout.blocked.has(cellKey(x, y));
}

export function getSpawnPoint() {
  return { x: (ROOM_TILE_X + Math.floor(ROOM_COLUMNS / 2)) * 16 + 8, y: (ROOM_TILE_Y + ROOM_WALL_BANDS.length + 3) * 16 + 14 };
}

export function getOutdoorTarget() {
  return { x: (DOOR_LEFT + 1) * 16 + 8, y: (DOOR_Y + 6) * 16 + 14 };
}
