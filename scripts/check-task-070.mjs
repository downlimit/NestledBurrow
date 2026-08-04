import assert from "node:assert/strict";
import { createInteractionApproachResolver } from "../src/interaction/interactionApproach.js";

const colliders = new Map([
  ["home-dining-table-01", { left: 32, right: 80, top: 48, bottom: 80 }],
  ["home-gas-stove-01", { left: 96, right: 128, top: 48, bottom: 80 }],
  ["home-bath-01", { left: 160, right: 208, top: 48, bottom: 96 }],
]);
const worldObjects = [...colliders].map(([id, rect]) => ({ id, rect }));
let collisionQueries = 0;
let worldColliderReads = 0;
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const worldLayout = {
  bounds: { left: 0, top: 0, right: 256, bottom: 160 },
  cellSize: 8,
  isBlockedCell: () => false,
  isBlockedBox: (box) => {
    collisionQueries += 1;
    return worldObjects.some(({ rect }) => overlaps(box, rect));
  },
  getResourceCollider: (id) => colliders.get(id) ?? null,
  getWorldObjectColliders: () => {
    worldColliderReads += 1;
    return worldObjects;
  },
};
const resolver = createInteractionApproachResolver({
  worldLayout,
  getPlayer: () => ({ footWidth: 4, footDepth: 4 }),
});
const definitions = [...colliders].map(([id, rect]) => ({
  id,
  entityId: id,
  position: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
  radius: 96,
  payload: { facilityId: id },
}));

const farProbe = resolver.resolve(
  { ...definitions[1], __interactionProbe: true },
  { position: { x: 248, y: 152 } },
);
assert.equal(farProbe, null, "far furniture is rejected by the cheap prompt probe");
assert.equal(collisionQueries, 0, "prompt probing never invokes A* collision queries");

const stripPositions = [
  { x: 24, y: 32 },
  { x: 40, y: 32 },
  { x: 56, y: 32 },
  { x: 72, y: 32 },
  { x: 88, y: 32 },
  { x: 104, y: 32 },
  { x: 120, y: 32 },
  { x: 136, y: 32 },
  { x: 152, y: 32 },
];
const readsBeforeStrip = worldColliderReads;
for (const position of stripPositions) {
  const snapshot = { position };
  for (const definition of definitions) {
    resolver.resolve({ ...definition, __interactionProbe: true }, snapshot);
  }
}
assert.equal(collisionQueries, 0, "walking along the crowded upper wall performs zero A* work");
assert.equal(
  worldColliderReads - readsBeforeStrip,
  stripPositions.length,
  "all nearby furniture shares one wall snapshot per frame instead of rescanning world colliders per target",
);

const committed = resolver.resolve(definitions[1], { position: { x: 104, y: 32 } });
assert(committed?.payload.approachPath.length > 0, "pressing interact still computes a reachable stove route");
assert(collisionQueries > 0, "A* runs only for the committed interaction");

console.log("Task #070 checks passed: crowded-wall prompt scans are pathfinding-free and activation keeps canonical routing.");
