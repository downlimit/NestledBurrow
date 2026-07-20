import {
  DOOR_LEFT,
  DOOR_Y,
  HOUSE,
  HOUSE_FRAMES,
  OUTDOOR_FRAMES,
  TILE_SIZE,
  WORLD_COLUMNS,
  WORLD_ROWS,
} from "./worldConfig.js";

function addTree(tiles, blocked, x, y, variant) {
  const base = variant * 3;
  const depth = 500 + (y + 4) * TILE_SIZE;

  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      tiles.push({
        x: x + column,
        y: y + row,
        frame: base + row * 9 + column,
        depth,
      });
    }
  }

  blocked.add(cellKey(x + 1, y + 3));
}

function getGrassFrame(x, y) {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  const detailFrames = OUTDOOR_FRAMES.grassDetails;

  return hash % 131 < detailFrames.length
    ? detailFrames[hash % detailFrames.length]
    : OUTDOOR_FRAMES.grass;
}

export function createWorldLayout() {
  const groundTiles = [];
  const houseFloorTiles = [];
  const houseWallTiles = [];
  const decorationTiles = [];
  const blocked = new Set();

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLUMNS; x += 1) {
      groundTiles.push({ x, y, frame: getGrassFrame(x, y) });
    }
  }

  for (let y = DOOR_Y; y < WORLD_ROWS; y += 1) {
    const frames = y === DOOR_Y ? OUTDOOR_FRAMES.pathTop : OUTDOOR_FRAMES.pathMiddle;
    for (let column = 0; column < 3; column += 1) {
      groundTiles.push({ x: DOOR_LEFT - 1 + column, y, frame: frames[column] });
    }
  }

  for (let y = HOUSE.y + 1; y < DOOR_Y; y += 1) {
    for (let x = HOUSE.x + 1; x < HOUSE.x + HOUSE.columns - 1; x += 1) {
      houseFloorTiles.push({ x, y, frame: HOUSE_FRAMES.floor });
    }
  }

  for (let x = HOUSE.x; x < HOUSE.x + HOUSE.columns; x += 1) {
    const frame =
      x === HOUSE.x
        ? HOUSE_FRAMES.topLeft
        : x === HOUSE.x + HOUSE.columns - 1
          ? HOUSE_FRAMES.topRight
          : HOUSE_FRAMES.top;
    houseWallTiles.push({ x, y: HOUSE.y, frame });
    blocked.add(cellKey(x, HOUSE.y));
  }

  for (let y = HOUSE.y + 1; y < DOOR_Y; y += 1) {
    houseWallTiles.push({ x: HOUSE.x, y, frame: HOUSE_FRAMES.sideLeft });
    houseWallTiles.push({
      x: HOUSE.x + HOUSE.columns - 1,
      y,
      frame: HOUSE_FRAMES.sideRight,
    });
    blocked.add(cellKey(HOUSE.x, y));
    blocked.add(cellKey(HOUSE.x + HOUSE.columns - 1, y));
  }

  for (let x = HOUSE.x; x < HOUSE.x + HOUSE.columns; x += 1) {
    const inDoor = x >= DOOR_LEFT && x < DOOR_LEFT + HOUSE.doorWidth;
    if (inDoor) continue;

    const frame =
      x === HOUSE.x
        ? HOUSE_FRAMES.bottomLeft
        : x === HOUSE.x + HOUSE.columns - 1
          ? HOUSE_FRAMES.bottomRight
          : HOUSE_FRAMES.bottom;
    houseWallTiles.push({ x, y: DOOR_Y, frame });
    blocked.add(cellKey(x, DOOR_Y));
  }

  addTree(decorationTiles, blocked, 7, 6, 0);
  addTree(decorationTiles, blocked, 52, 7, 1);
  addTree(decorationTiles, blocked, 8, 33, 2);
  addTree(decorationTiles, blocked, 51, 34, 0);

  return {
    groundTiles,
    houseFloorTiles,
    houseWallTiles,
    decorationTiles,
    blocked,
    spawn: {
      x: (HOUSE.x + Math.floor(HOUSE.columns / 2)) * TILE_SIZE + TILE_SIZE / 2,
      y: (HOUSE.y + 8) * TILE_SIZE + TILE_SIZE - 2,
    },
    outdoorTarget: {
      x: (DOOR_LEFT + 1) * TILE_SIZE + TILE_SIZE / 2,
      y: (DOOR_Y + 7) * TILE_SIZE + TILE_SIZE - 2,
    },
  };
}

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function isBlockedCell(layout, x, y) {
  return layout.blocked.has(cellKey(x, y));
}
