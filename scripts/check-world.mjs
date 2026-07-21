import assert from "node:assert/strict";
import { createGridCollisionEnvironment } from "../src/collisionEnvironment.js";
import { collides, moveWithCollision } from "../src/movement.js";
import { NPCS } from "../src/npcConfig.js";
import { cellKey, createWorldLayout, isBlockedCell } from "../src/worldLayout.js";
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
assert.deepEqual(layout.bounds, { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT }, "world layout exposes current world bounds");
assert.equal(layout.cellSize, TILE_SIZE, "world layout exposes tile-sized collision cells");
assert.equal(typeof layout.isBlockedCell, "function", "world layout implements collision query");
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
  assert.equal(isBlockedCell(layout, x, DOOR_Y), false, "doorway is open in diagnostic layout data");
  assert.equal(layout.isBlockedCell(x, DOOR_Y), false, "doorway is open through environment query");
}

const expectedBlockedCells = [
  [HOUSE.x, HOUSE.y],
  [HOUSE.x + HOUSE.columns - 1, HOUSE.y + 5],
  [7 + 1, 6 + 3],
  [52 + 1, 7 + 3],
  [8 + 1, 33 + 3],
  [51 + 1, 34 + 3],
];
for (const [x, y] of expectedBlockedCells) {
  assert.equal(layout.blocked.has(cellKey(x, y)), true, `diagnostic blocked set contains ${x},${y}`);
  assert.equal(layout.isBlockedCell(x, y), true, `environment query blocks ${x},${y}`);
}

for (const point of [layout.spawn, layout.outdoorTarget]) {
  assert.equal(collides(point, layout, footWidth, footDepth), false, "player route point is walkable");
}
for (const npc of NPCS) {
  assert.equal(collides(npc.spawn, layout, footWidth, footDepth), false, `${npc.id} spawn is walkable`);
  for (const waypoint of npc.patrol.waypoints) {
    assert.equal(collides(waypoint, layout, footWidth, footDepth), false, `${npc.id} waypoint is walkable`);
  }
}

let position = { ...layout.spawn };
const routeStep = TILE_SIZE / 2;
const routeStepLimit = WORLD_ROWS * 4;
let routeSteps = 0;
while (position.y < layout.outdoorTarget.y && routeSteps < routeStepLimit) {
  position = moveWithCollision(position, { x: 0, y: routeStep }, layout, footWidth, footDepth).position;
  routeSteps += 1;
}
assert(routeSteps < routeStepLimit, "walkable route does not stall");
assert(position.y >= layout.outdoorTarget.y - routeStep, "route reaches the outdoor path");

const wallY = (HOUSE.y + 5) * TILE_SIZE + TILE_SIZE - 2;
const nearLeftWallX = (HOUSE.x + 1) * TILE_SIZE + TILE_SIZE / 2;
const minimumInteriorCenterX = (HOUSE.x + 1) * TILE_SIZE + footWidth / 2;
const wallStart = { x: nearLeftWallX, y: wallY };

const wallResult = moveWithCollision(wallStart, { x: -TILE_SIZE * 2, y: 0 }, layout, footWidth, footDepth);
assert.deepEqual(wallResult, { position: { x: minimumInteriorCenterX, y: wallY }, blockedAxes: { x: true, y: false } }, "representative wall collision result is unchanged");

const highSpeedResult = moveWithCollision(wallStart, { x: -TILE_SIZE * 8, y: 0 }, layout, footWidth, footDepth);
assert.equal(highSpeedResult.blockedAxes.x, true, "high-speed collision reports blocked axis");
assert.equal(highSpeedResult.position.x, minimumInteriorCenterX, "large frame deltas cannot tunnel through a wall");

const slideResult = moveWithCollision(wallStart, { x: -TILE_SIZE * 2, y: TILE_SIZE / 2 }, layout, footWidth, footDepth);
assert.deepEqual(slideResult, { position: { x: minimumInteriorCenterX, y: wallY + TILE_SIZE / 2 }, blockedAxes: { x: true, y: false } }, "axis-separated sliding preserves previous result");

const boundsResult = moveWithCollision({ x: footWidth / 2, y: footDepth }, { x: -1, y: -1 }, layout, footWidth, footDepth);
assert.deepEqual(boundsResult.position, { x: footWidth / 2, y: footDepth }, "world bounds clamp correctly");
assert.deepEqual(boundsResult.blockedAxes, { x: true, y: true }, "world bounds report both blocked axes even for a single small step");
assert.equal(collides({ x: 1, y: footDepth }, layout, footWidth, footDepth), true, "world edges block the foot box");

let queryCount = 0;
const artificial = createGridCollisionEnvironment({
  bounds: { left: 100, top: 50, right: 220, bottom: 170 },
  cellSize: 10,
  isBlockedCell: (x, y) => {
    queryCount += 1;
    return x === 4 && y === 5;
  },
});
assert.equal(collides({ x: 145, y: 110 }, artificial, 8, 5), true, "artificial environment blocks its custom cell");
assert(queryCount > 0, "resolver uses the blocking query instead of a Set");
assert.equal(collides({ x: 135, y: 110 }, artificial, 8, 5), false, "artificial environment permits open cells");
const shiftedClamp = moveWithCollision({ x: 104, y: 55 }, { x: -20, y: -20 }, artificial, 8, 5);
assert.deepEqual(shiftedClamp.position, { x: 104, y: 55 }, "non-zero bounds clamp minimum character position");
assert.deepEqual(shiftedClamp.blockedAxes, { x: true, y: true }, "non-zero bounds preserve blocked axis semantics");

const collectionEnvironment = createGridCollisionEnvironment({
  bounds: { left: 10, top: 20, right: 50, bottom: 60 },
  cellSize: 10,
  blockedCells: new Set(["1,2"]),
});
assert.equal(collides({ x: 25, y: 50 }, collectionEnvironment, 8, 5), true, "blocked-cell collection can create an environment");

const invalidContracts = [
  [{ bounds: { left: 0, top: 0, right: 0, bottom: 1 }, cellSize: 1, isBlockedCell: () => false }, /right must be greater/],
  [{ bounds: { left: 0, top: 0, right: 1, bottom: 0 }, cellSize: 1, isBlockedCell: () => false }, /bottom must be greater/],
  [{ bounds: { left: 0, top: Number.NaN, right: 1, bottom: 1 }, cellSize: 1, isBlockedCell: () => false }, /bounds\.top must be finite/],
  [{ bounds: { left: 0, top: 0, right: 1, bottom: 1 }, cellSize: 0, isBlockedCell: () => false }, /cellSize must be finite and positive/],
  [{ bounds: { left: 0, top: 0, right: 1, bottom: 1 }, cellSize: 1 }, /isBlockedCell/],
];
for (const [contract, message] of invalidContracts) {
  assert.throws(() => createGridCollisionEnvironment(contract), message, "invalid environment contract reports a clear error");
}

const movementSource = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../src/movement.js", import.meta.url), "utf8"));
assert(!movementSource.includes("worldConfig.js"), "movement.js does not import worldConfig.js");
assert(!movementSource.includes(".blocked"), "production resolver does not read blocked diagnostic data");

console.log(
  `world checks passed: ${WORLD_WIDTH}x${WORLD_HEIGHT}, environment interface, Basic Village floor, doorway, blocked axes, sliding, anti-tunneling, bounds and artificial environments`,
);
