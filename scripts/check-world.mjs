import assert from "node:assert/strict";
import { moveWithCollision } from "../src/movement.js";
import { createWorldLayout, isBlockedCell } from "../src/worldLayout.js";
import {
  DOOR_LEFT,
  DOOR_WIDTH,
  DOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  ROOM_COLUMNS,
  ROOM_ROWS,
  ROOM_TILE_X,
  ROOM_TILE_Y,
  TILE_SIZE,
  WORLD_COLUMNS,
  WORLD_HEIGHT,
  WORLD_ROWS,
  WORLD_WIDTH,
} from "../src/worldConfig.js";
import roomConfig from "../src/kenneyRoomConfig.json" with { type: "json" };

const layout = createWorldLayout();
const footWidth = 8;
const footDepth = 5;

assert(WORLD_WIDTH > GAME_WIDTH && WORLD_HEIGHT > GAME_HEIGHT, "world is larger than camera");
assert.equal(
  layout.outdoorTiles.length,
  WORLD_COLUMNS * WORLD_ROWS,
  "outdoor layout has exactly one terrain tile per cell",
);
assert.equal(
  new Set(layout.outdoorTiles.map((tile) => `${tile.x},${tile.y}`)).size,
  layout.outdoorTiles.length,
  "outdoor layout has no duplicate tile coordinates",
);

for (let x = DOOR_LEFT; x < DOOR_LEFT + DOOR_WIDTH; x += 1) {
  assert.equal(isBlockedCell(layout, x, DOOR_Y), false, "doorway is open");
}

for (const tile of layout.roomTiles) {
  const inDoor =
    tile.y === DOOR_Y && tile.x >= DOOR_LEFT && tile.x < DOOR_LEFT + DOOR_WIDTH;

  if (tile.frame !== roomConfig.floorFrame && !inDoor) {
    assert.equal(
      isBlockedCell(layout, tile.x, tile.y),
      true,
      `wall ${tile.x},${tile.y} blocks`,
    );
  }
}

let position = { ...layout.spawn };
const routeStep = TILE_SIZE / 2;
const routeStepLimit = WORLD_ROWS * 4;
let routeSteps = 0;

while (position.y < layout.outdoorTarget.y && routeSteps < routeStepLimit) {
  position = moveWithCollision(
    position,
    { x: 0, y: routeStep },
    layout,
    footWidth,
    footDepth,
  ).position;
  routeSteps += 1;
}

assert(routeSteps < routeStepLimit, "walkable route does not stall before reaching outdoor path");
assert(
  position.y >= layout.outdoorTarget.y - routeStep,
  "walkable route reaches outdoor path",
);

const wallY = (ROOM_TILE_Y + 4) * TILE_SIZE + TILE_SIZE - 2;
const nearLeftWallX = (ROOM_TILE_X + 1) * TILE_SIZE + TILE_SIZE / 2;
const wallResult = moveWithCollision(
  { x: nearLeftWallX, y: wallY },
  { x: -TILE_SIZE * 1.5, y: 0 },
  layout,
  footWidth,
  footDepth,
);
const wallTry = wallResult.position;
assert.equal(wallResult.blockedAxes.x, true, "wall collision reports blocked x axis");
assert.equal(wallResult.blockedAxes.y, false, "wall collision leaves y axis unblocked");
assert(
  wallTry.x > ROOM_TILE_X * TILE_SIZE + TILE_SIZE / 2,
  "movement cannot cross a solid wall",
);

const highSpeedStart = {
  x: (ROOM_TILE_X + 2) * TILE_SIZE + TILE_SIZE / 2,
  y: wallY,
};
const highSpeedTry = moveWithCollision(
  highSpeedStart,
  { x: -TILE_SIZE * 6, y: 0 },
  layout,
  footWidth,
  footDepth,
).position;
assert(
  highSpeedTry.x >= (ROOM_TILE_X + 1) * TILE_SIZE + footWidth / 2,
  "large frame deltas cannot tunnel through a wall",
);

const slideResult = moveWithCollision(
  { x: nearLeftWallX, y: wallY },
  { x: -TILE_SIZE * 1.5, y: TILE_SIZE / 2 },
  layout,
  footWidth,
  footDepth,
);
const slide = slideResult.position;
assert.equal(slideResult.blockedAxes.x, true, "sliding collision reports blocked wall axis");
assert.equal(slideResult.blockedAxes.y, false, "sliding collision keeps travel axis unblocked");
assert(slide.y > wallY, "axis-separated movement slides along wall");

assert.deepEqual(
  moveWithCollision(
    { x: footWidth / 2, y: footDepth },
    { x: -99, y: -99 },
    layout,
    footWidth,
    footDepth,
  ).position,
  { x: footWidth / 2, y: footDepth },
  "world bounds clamp correctly",
);

console.log(
  `world checks passed: ${WORLD_WIDTH}x${WORLD_HEIGHT}, room ${ROOM_COLUMNS}x${ROOM_ROWS}`,
);
