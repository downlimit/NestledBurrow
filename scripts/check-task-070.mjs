import assert from "node:assert/strict";
import { createInteractionApproachResolver } from "../src/interaction/interactionApproach.js";
import { createInteractionRuntime } from "../src/interaction/interactionRuntime.js";

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
  kind: "facility",
  position: { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 },
  radius: 96,
  requiresFacing: false,
  prompt: `use:${id}`,
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

function createActivationFixture({ exactDistanceById, selectionDistanceById = {}, blockedIds = [] }) {
  const player = {
    id: "player",
    position: { x: 0, y: 0 },
    facingDirection: { x: 1, y: 0 },
  };
  const candidates = [
    {
      id: "near-object",
      entityId: "near-object",
      kind: "facility",
      position: { x: 4, y: 0 },
      radius: 64,
      requiresFacing: false,
      prompt: "use:near",
      payload: { facilityId: "near-object" },
    },
    {
      id: "far-object",
      entityId: "far-object",
      kind: "facility",
      position: { x: 8, y: 0 },
      radius: 64,
      requiresFacing: false,
      prompt: "use:far",
      payload: { facilityId: "far-object" },
    },
  ];
  let exactResolutionCount = 0;
  const handled = [];
  const runtime = createInteractionRuntime({
    sessionState: {
      playerId: "player",
      dialogue: { targetId: null, dialogueId: null, lineIndex: 0 },
    },
    characterSystem: {
      has: () => false,
      getSnapshot: (id) => {
        assert.equal(id, "player", "activation fixture only reads the player snapshot");
        return player;
      },
    },
    getInteractionDefinitions: () => [],
    worldInteractionCoordinator: {
      getStaticInteractionDefinitions: () => candidates,
      isInteractionAllowed: () => true,
      handle: (candidate) => {
        handled.push(candidate.targetId);
        return { status: "used", mutated: false };
      },
    },
    resolveInteractionTarget: (definition) => {
      if (definition.__interactionProbe) {
        return {
          position: definition.position,
          aimPosition: definition.position,
          availabilityDistance: Math.hypot(definition.position.x, definition.position.y),
          selectionDistance: Math.hypot(definition.position.x, definition.position.y),
          payload: { ...definition.payload },
        };
      }
      exactResolutionCount += 1;
      if (blockedIds.includes(definition.id)) return null;
      const resolved = {
        position: definition.position,
        aimPosition: definition.position,
        availabilityDistance: exactDistanceById[definition.id],
        payload: {
          ...definition.payload,
          approachPoint: definition.position,
          approachPath: [{ ...definition.position }],
        },
      };
      if (selectionDistanceById[definition.id] !== undefined) {
        resolved.selectionDistance = selectionDistanceById[definition.id];
      }
      return resolved;
    },
    presenter: {
      showPrompt: () => {},
      hidePrompt: () => {},
      isMessageVisible: () => false,
    },
  });
  return {
    runtime,
    handled,
    getExactResolutionCount: () => exactResolutionCount,
  };
}

const blockedNearest = createActivationFixture({
  exactDistanceById: { "near-object": 4, "far-object": 8 },
  blockedIds: ["near-object"],
});
blockedNearest.runtime.update({ actions: { interact: false } });
assert.equal(
  blockedNearest.runtime.getCurrentCandidate()?.targetId,
  "near-object",
  "cheap probe may tentatively show the closest rearranged object",
);
assert.equal(
  blockedNearest.getExactResolutionCount(),
  0,
  "showing a prompt for rearranged furniture performs no exact pathfinding",
);
blockedNearest.runtime.update({ actions: { interact: true } });
assert.deepEqual(
  blockedNearest.handled,
  ["far-object"],
  "an unreachable nearest object cannot block an accessible neighbouring interaction",
);
assert.equal(
  blockedNearest.getExactResolutionCount(),
  2,
  "activation validates each nearby candidate exactly once",
);

const visuallyRanked = createActivationFixture({
  exactDistanceById: { "near-object": 20, "far-object": 5 },
  selectionDistanceById: { "near-object": 4, "far-object": 8 },
});
visuallyRanked.runtime.update({ actions: { interact: false } });
assert.equal(
  visuallyRanked.runtime.getCurrentCandidate()?.targetId,
  "near-object",
  "prompt probing selects the visually nearest furniture",
);
visuallyRanked.runtime.update({ actions: { interact: true } });
assert.deepEqual(
  visuallyRanked.handled,
  ["near-object"],
  "exact validation preserves the visually intended object even when another route is shorter",
);

console.log("Task #070 checks passed: crowded-wall scans are pathfinding-free and activation safely validates rearranged furniture.");
