import assert from "node:assert/strict";
import { moveWithCollision } from "../src/movement.js";
import { createWorldLayout, isBlockedCell } from "../src/worldLayout.js";
import {
  DOOR_LEFT,
  DOOR_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  HOUSE,
  HOUSE_FRAMES,
  TILE_SIZE,
  WORLD_COLUMNS,
  WORLD_HEIGHT,
  WORLD_ROWS,
  WORLD_WIDTH,
} from "../src/worldConfig.js";

const layout = createWorldLayout();
const footWidth = 8;
const footDepth = 5;

assert(WORLD_WIDTH > GAME_WIDTH && WORLD_HEIGHT > GAME_HEIGHT, "world is larger than camera");
assert.equal(
  layout.groundTiles.length,
  WORLD_COLUMNS * WORLD_ROWS + (WORLD_ROWS - DOOR_Y) * 3,
  "ground contains one base tile per cell plus the three-tile path overlay",
);
assert.equal(layout.houseFloorTiles.length > 0, true);
assert(
  layout.houseFloorTiles.every((tile) => tile.frame === HOUSE_FRAMES.floor),
  "the interior uses the verified fully opaque floor tile without transparent gaps",
);
assert.equal(layout.houseWallTiles.length > 0, true);
assert.equal(layout.decorationTiles.length, 48, "four 3x4 trees are present");

for (let x = DOOR_LEFT; x < DOOR_LEFT + HOUSE.doorWidth; x += 1) {
  assert.equal(isBlockedCell(layout, x, DOOR_Y), false, "doorway is open");
}

assert.equal(isBlockedCell(layout, HOUSE.x, HOUSE.y), true, "top-left wall blocks");
assert.equal(
  isBlockedCell(layout, HOUSE.x + HOUSE.columns - 1, HOUSE.y + 5),
  true,
  "side wall blocks",
);

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

assert(routeSteps < routeStepLimit, "walkable route does not stall");
assert(position.y >= layout.outdoorTarget.y - routeStep, "route reaches the outdoor path");

const wallY = (HOUSE.y + 5) * TILE_SIZE + TILE_SIZE - 2;
const nearLeftWallX = (HOUSE.x + 1) * TILE_SIZE + TILE_SIZE / 2;
const minimumInteriorCenterX = (HOUSE.x + 1) * TILE_SIZE + footWidth / 2;

const wallResult = moveWithCollision(
  { x: nearLeftWallX, y: wallY },
  { x: -TILE_SIZE * 2, y: 0 },
  layout,
  footWidth,
  footDepth,
);
assert.equal(wallResult.blockedAxes.x, true, "wall collision reports blocked x axis");
assert.equal(wallResult.blockedAxes.y, false, "wall collision leaves y axis unblocked");
assert(
  wallResult.position.x >= minimumInteriorCenterX,
  "movement cannot cross a solid wall",
);

const highSpeedResult = moveWithCollision(
  { x: nearLeftWallX, y: wallY },
  { x: -TILE_SIZE * 8, y: 0 },
  layout,
  footWidth,
  footDepth,
);
assert.equal(highSpeedResult.blockedAxes.x, true, "high-speed collision reports blocked axis");
assert(
  highSpeedResult.position.x >= minimumInteriorCenterX,
  "large frame deltas cannot tunnel through a wall",
);

const slideResult = moveWithCollision(
  { x: nearLeftWallX, y: wallY },
  { x: -TILE_SIZE * 2, y: TILE_SIZE / 2 },
  layout,
  footWidth,
  footDepth,
);
assert.equal(slideResult.blockedAxes.x, true, "sliding reports the blocked wall axis");
assert.equal(slideResult.blockedAxes.y, false, "sliding preserves the travel axis");
assert(slideResult.position.x >= minimumInteriorCenterX, "sliding does not enter the wall");
assert(slideResult.position.y > wallY, "axis-separated movement slides along the wall");

const boundsResult = moveWithCollision(
  { x: footWidth / 2, y: footDepth },
  { x: -1, y: -1 },
  layout,
  footWidth,
  footDepth,
);
assert.deepEqual(
  boundsResult.position,
  { x: footWidth / 2, y: footDepth },
  "world bounds clamp correctly",
);
assert.deepEqual(
  boundsResult.blockedAxes,
  { x: true, y: true },
  "world bounds report both blocked axes even for a single small step",
);

console.log(
  `world checks passed: ${WORLD_WIDTH}x${WORLD_HEIGHT}, Basic Village floor, doorway, blocked axes, sliding, anti-tunneling and bounds`,
);
