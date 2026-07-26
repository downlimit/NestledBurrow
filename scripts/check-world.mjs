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
import { PLACEMENT_CELL_SIZE, RESOURCE_OBJECTS } from "../src/resourceConfig.js";
import { getResourceProfile } from "../src/resourceDomain.js";

const layout = createWorldLayout();
const footWidth = 8;
const footDepth = 5;

assert(WORLD_WIDTH > GAME_WIDTH && WORLD_HEIGHT > GAME_HEIGHT, "world is larger than camera");
assert.deepEqual(layout.bounds, { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT }, "world layout exposes current world bounds");
assert.equal(layout.cellSize, PLACEMENT_CELL_SIZE, "world layout exposes the 8 px placement collision grid");
assert.equal(typeof layout.isBlockedCell, "function", "world layout implements collision query");
assert.equal(
  layout.groundTiles.length,
  WORLD_COLUMNS * WORLD_ROWS + (WORLD_ROWS - DOOR_Y) * 3,
  "ground contains one base tile per cell plus the three-tile path overlay",
);
assert.equal(layout.houseFloorTiles.length, HOUSE.columns * HOUSE.rows, "floor fills the canonical interior footprint");
assert(
  layout.houseFloorTiles.every((tile) => (
    tile.frame === HOUSE_FRAMES.floor
    && tile.x * TILE_SIZE >= layout.houseFootprint.left
    && (tile.x + 1) * TILE_SIZE <= layout.houseFootprint.right
    && tile.y * TILE_SIZE >= layout.houseFootprint.top
    && (tile.y + 1) * TILE_SIZE <= layout.houseFootprint.bottom
  )),
  "floor cells stay inside the canonical footprint",
);
assert.equal(layout.houseWallTiles.length, layout.wallEdges.length - 4, "four room corners share their horizontal and vertical edge visuals");
assert.deepEqual(
  [...layout.houseWallTiles.flatMap((tile) => tile.edgeIds)].sort(),
  [...layout.wallEdges.map((edge) => edge.id)].sort(),
  "every collision edge is represented by exactly one wall visual",
);
assert.equal(layout.wallColliders.length, layout.wallEdges.length, "every wall edge owns one thin matching collider");
assert(layout.wallColliders.every((rect) => (
  (rect.right - rect.left === TILE_SIZE && rect.bottom - rect.top === 4)
  || (rect.right - rect.left === 4 && rect.bottom - rect.top === TILE_SIZE)
)), "wall colliders follow the same thin grid edges as the construction brush");
assert(layout.houseWallTiles.every((tile) => (
  [
      HOUSE_FRAMES.topLeft,
      HOUSE_FRAMES.top,
      HOUSE_FRAMES.topRight,
      HOUSE_FRAMES.bottomLeft,
      HOUSE_FRAMES.bottom,
      HOUSE_FRAMES.bottomRight,
  ].includes(tile.frame)
    ? tile.worldX === (
      [HOUSE_FRAMES.topLeft, HOUSE_FRAMES.bottomLeft].includes(tile.frame)
        ? tile.x - TILE_SIZE / 2
        : [HOUSE_FRAMES.topRight, HOUSE_FRAMES.bottomRight].includes(tile.frame)
          ? tile.x + TILE_SIZE / 2
          : tile.x
    )
      && tile.worldY === (tile.side === "top" ? tile.y : tile.y - TILE_SIZE)
    : tile.frame === (tile.side === "left" ? HOUSE_FRAMES.wallLeftCap : HOUSE_FRAMES.wallRightCap)
      && tile.worldX === tile.x - TILE_SIZE / 2
      && tile.worldY === tile.y
)), "initial walls use complete edge and corner sprites on the construction grid");
const wallCaps = layout.houseWallTiles.filter((tile) => [
  HOUSE_FRAMES.topLeft,
  HOUSE_FRAMES.topRight,
  HOUSE_FRAMES.bottomLeft,
  HOUSE_FRAMES.bottomRight,
].includes(tile.frame));
assert(wallCaps.every((tile) => (
  tile.supplements.length === 1
  && tile.supplements[0].cropWidth === TILE_SIZE / 2
)), "each shifted wall cap fills its remaining half-edge with a cropped middle segment");
assert.equal(layout.decorationTiles.length, 48, "four 3x4 trees are present");

assert.equal(layout.doorway.left, DOOR_LEFT * TILE_SIZE);
assert.equal(layout.doorway.right, (DOOR_LEFT + HOUSE.doorWidth) * TILE_SIZE);
assert.equal(layout.wallEdges.some((edge) => (
  edge.side === "bottom" && edge.x >= layout.doorway.left && edge.x < layout.doorway.right
)), false, "doorway is a gap in the bottom edge set");
const firstPathTile = layout.groundTiles[WORLD_COLUMNS * WORLD_ROWS];
const pathCenterX = (firstPathTile.x + 1.5) * TILE_SIZE;
assert.equal(pathCenterX - layout.doorway.centerX, 0, "doorway and path centerlines are identical");

const expectedBlockedCells = [
  [7 + 1, 6 + 3],
  [52 + 1, 7 + 3],
  [8 + 1, 33 + 3],
  [51 + 1, 34 + 3],
];
for (const [x, y] of expectedBlockedCells) {
  assert.equal(layout.blocked.has(cellKey(x * 2, y * 2)), true, `diagnostic blocked set contains tile ${x},${y}`);
  assert.equal(layout.isBlockedCell(x * 2, y * 2), true, `environment query blocks tile ${x},${y}`);
}

const resourceCells = new Set();
for (const resource of RESOURCE_OBJECTS) {
  const footprint = getResourceProfile(resource.profileId).footprint;
  const placementOrigin = {
    x: resource.cell.x * PLACEMENT_CELL_SIZE,
    y: resource.cell.y * PLACEMENT_CELL_SIZE,
  };
  assert.equal(placementOrigin.x % PLACEMENT_CELL_SIZE, 0, `${resource.id} x is on the placement grid`);
  assert.equal(placementOrigin.y % PLACEMENT_CELL_SIZE, 0, `${resource.id} y is on the placement grid`);
  assert.equal(resource.position.x, placementOrigin.x + footprint.width * PLACEMENT_CELL_SIZE / 2, `${resource.id} interaction x centers its footprint`);
  assert.equal(resource.position.y, placementOrigin.y + footprint.height * PLACEMENT_CELL_SIZE / 2, `${resource.id} interaction y centers its footprint`);
  for (let y = 0; y < footprint.height; y += 1) for (let x = 0; x < footprint.width; x += 1) {
    const key = cellKey(resource.cell.x + x, resource.cell.y + y);
    assert(!resourceCells.has(key), `${resource.id} footprint does not overlap another resource`);
    assert(!layout.blocked.has(key), `${resource.id} footprint does not overlap static terrain`);
    resourceCells.add(key);
  }
}
for (const [label, point] of [["spawn", layout.spawn], ["outdoor target", layout.outdoorTarget], ...NPCS.flatMap((npc) => [[`${npc.id} spawn`, npc.spawn], ...npc.patrol.waypoints.map((waypoint, index) => [`${npc.id} waypoint ${index}`, waypoint])])]) {
  const cell = cellKey(Math.floor(point.x / PLACEMENT_CELL_SIZE), Math.floor(point.y / PLACEMENT_CELL_SIZE));
  assert(!resourceCells.has(cell), `${label} remains outside resource footprints`);
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
const nearLeftWallX = HOUSE.x * TILE_SIZE + TILE_SIZE + TILE_SIZE / 2;
const minimumInteriorCenterX = HOUSE.x * TILE_SIZE + 2 + footWidth / 2;
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
assert.equal(
  collides({ x: layout.doorway.centerX, y: layout.houseFootprint.bottom + footDepth }, layout, footWidth, footDepth),
  false,
  "doorway remains walkable through the thin bottom-edge collision",
);
assert.equal(
  collides({ x: layout.doorway.left - TILE_SIZE / 2, y: layout.houseFootprint.bottom + footDepth }, layout, footWidth, footDepth),
  true,
  "the neighboring bottom wall edge remains blocked",
);

const editableLayout = createWorldLayout();
const removableEdge = editableLayout.wallEdges.find((edge) => edge.side === "left" && edge.index === 5);
const removablePoint = {
  x: editableLayout.houseFootprint.left - footWidth / 2,
  y: removableEdge.y + TILE_SIZE / 2,
};
assert.equal(collides(removablePoint, editableLayout, footWidth, footDepth), true, "wall segment collider is active before demolition");
editableLayout.removeWallEdges([removableEdge.id]);
assert.equal(collides(removablePoint, editableLayout, footWidth, footDepth), false, "demolishing a wall segment removes its matching collider");
editableLayout.restoreWallEdges([removableEdge.id]);
assert.equal(collides(removablePoint, editableLayout, footWidth, footDepth), true, "undo restores the demolished wall collider");

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
