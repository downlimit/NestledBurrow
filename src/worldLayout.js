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

function addTree(tiles, blocked, x, y, frameBase) {
  const frames = [
    frameBase,
    frameBase + 1,
    frameBase + 2,
    frameBase + 9,
    frameBase + 10,
    frameBase + 11,
    frameBase + 18,
    frameBase + 19,
    frameBase + 20,
  ];

  frames.forEach((frame, index) => {
    tiles.push({ x: x + (index % 3), y: y + Math.floor(index / 3), frame });
  });

  blocked.add(cellKey(x + 1, y + 2));
}

export function createWorldLayout() {
  const groundTiles = [];
  const houseFloorTiles = [];
  const houseWallTiles = [];
  const decorationTiles = [];
  const blocked = new Set();

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLUMNS; x += 1) {
      const detailSeed = (x * 17 + y * 29) % 37;
      const frame =
        detailSeed < OUTDOOR_FRAMES.grassDetails.length
          ? OUTDOOR_FRAMES.grassDetails[detailSeed]
          : OUTDOOR_FRAMES.grass;
      groundTiles.push({ x, y, frame });
    }
  }

  for (let y = DOOR_Y; y < WORLD_ROWS; y += 1) {
    for (let x = DOOR_LEFT - 1; x <= DOOR_LEFT + HOUSE.doorWidth; x += 1) {
      const detailSeed = (x + y * 3) % 11;
      const frame =
        detailSeed < OUTDOOR_FRAMES.dirtDetails.length
          ? OUTDOOR_FRAMES.dirtDetails[detailSeed]
          : OUTDOOR_FRAMES.dirt;
      groundTiles.push({ x, y, frame });
    }
  }

  for (let y = HOUSE.y + 2; y < HOUSE.y + HOUSE.rows - 1; y += 1) {
    for (let x = HOUSE.x + 1; x < HOUSE.x + HOUSE.columns - 1; x += 1) {
      const localX = (x - HOUSE.x - 1) % 3;
      const localY = (y - HOUSE.y - 2) % 3;
      houseFloorTiles.push({
        x,
        y,
        frame: HOUSE_FRAMES.floorDetails[localY * 3 + localX],
      });
    }
  }

  for (let x = HOUSE.x; x < HOUSE.x + HOUSE.columns; x += 1) {
    const firstRowFrame =
      x === HOUSE.x
        ? HOUSE_FRAMES.topLeft
        : x === HOUSE.x + HOUSE.columns - 1
          ? HOUSE_FRAMES.topRight
          : HOUSE_FRAMES.top;
    const secondRowFrame =
      x === HOUSE.x
        ? HOUSE_FRAMES.upperLeft
        : x === HOUSE.x + HOUSE.columns - 1
          ? HOUSE_FRAMES.upperRight
          : HOUSE_FRAMES.upper;

    houseWallTiles.push({ x, y: HOUSE.y, frame: firstRowFrame });
    houseWallTiles.push({ x, y: HOUSE.y + 1, frame: secondRowFrame });
    blocked.add(cellKey(x, HOUSE.y));
    blocked.add(cellKey(x, HOUSE.y + 1));
  }

  for (let y = HOUSE.y + 2; y < DOOR_Y; y += 1) {
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
        ? HOUSE_FRAMES.lowerLeft
        : x === HOUSE.x + HOUSE.columns - 1
          ? HOUSE_FRAMES.lowerRight
          : HOUSE_FRAMES.lower;
    houseWallTiles.push({ x, y: DOOR_Y, frame });
    blocked.add(cellKey(x, DOOR_Y));
  }

  addTree(decorationTiles, blocked, 7, 7, 0);
  addTree(decorationTiles, blocked, 51, 8, 3);
  addTree(decorationTiles, blocked, 8, 31, 6);
  addTree(decorationTiles, blocked, 51, 32, 0);

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
