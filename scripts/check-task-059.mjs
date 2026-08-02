import assert from "node:assert/strict";
import { createWorldLayout, cellKey } from "../src/world/worldLayout.js";
import { collides } from "../src/character/movement.js";
import {
  ATOLL_WORLD_MODEL,
  NEST_ISLAND_MODEL,
  TRANSPORT_PROFILE,
  WORLD_IDS,
  WORLD_LOCATION_DEFINITIONS,
  WORLD_LOCATION_IDS,
} from "../src/world/worldLocationConfig.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import { getResourceObjectsForWorld, RESOURCE_OBJECTS } from "../src/resources/resourceConfig.js";
import { OUTDOOR_FRAMES, TILE_SIZE } from "../src/world/worldConfig.js";
import { createPlantedTreeDefinition } from "../src/build/editorAuthoringRuntime.js";
import { getResourceProfile } from "../src/resources/resourceDomain.js";
import STARTING_LAYOUT_DEFAULT from "../src/build/startingLayoutDefault.js";
import { STOVE_REPAIR_COST } from "../src/tavern/cookingDomain.js";

const NEST_RETURN_SPAWN_FIXTURE = Object.freeze({ x: 11 * TILE_SIZE, y: 9 * TILE_SIZE, facing: { x: 0, y: -1 } });

assert.deepEqual([...WORLD_LOCATION_IDS].sort(), [WORLD_IDS.atoll, WORLD_IDS.nest, WORLD_IDS.village], "village, Nest and isolated Atoll are registered");
assert.equal(WORLD_LOCATION_DEFINITIONS.village.id, "village", "the existing village ID remains canonical");
assert.equal(WORLD_LOCATION_DEFINITIONS.village.capabilities.meleeWeapons, true, "village retains the shared weapon runtime");
assert.equal(WORLD_LOCATION_DEFINITIONS.village.capabilities.trainingDummy, true, "the training dummy remains village-owned");
assert.equal(WORLD_LOCATION_DEFINITIONS.nest.capabilities.meleeWeapons, true, "Nest retains the shared weapon runtime");
assert.equal(WORLD_LOCATION_DEFINITIONS.nest.capabilities.trainingDummy, false, "Nest excludes the village training dummy");
assert.equal(WORLD_LOCATION_DEFINITIONS.atoll.capabilities.meleeWeapons, false, "Atoll arena resources use their own tool-gated interactions");
assert.deepEqual(
  [WORLD_LOCATION_DEFINITIONS.nest.columns, WORLD_LOCATION_DEFINITIONS.nest.rows],
  [22, 16],
  "Nest bounds are 22x16 tiles",
);
assert.deepEqual(
  [WORLD_LOCATION_DEFINITIONS.atoll.columns, WORLD_LOCATION_DEFINITIONS.atoll.rows],
  [ATOLL_WORLD_MODEL.columns, ATOLL_WORLD_MODEL.rows],
  "Atoll owns a separate arena-sized collision space",
);
assert.deepEqual(
  [TRANSPORT_PROFILE.footprint.widthTiles, TRANSPORT_PROFILE.footprint.heightTiles],
  [2, 2],
  "the shared transport profile has an exact 2x2 footprint",
);
assert.deepEqual(
  TRANSPORT_PROFILE.visuals.map(({ x, y, crop }) => [x, y, crop ?? null]),
  [[0, 0, null], [1, 0, null], [0, 1, null], [1, 1, null]],
  "the transport visual occupies a clean uncropped 2x2 grid",
);
assert.deepEqual(
  OUTDOOR_FRAMES.islandCliff,
  { topLeft: 36, top: 37, topRight: 38, left: 48, right: 50, bottomLeft: 60, bottom: 61, bottomRight: 62 },
  "the island edge uses the contiguous Basic Village cliff nine-slice",
);
assert.deepEqual(
  OUTDOOR_FRAMES.islandInnerCorner,
  { topLeft: 78, topRight: 77, bottomLeft: 42, bottomRight: 41 },
  "the island steps use the four Basic Village inner cliff corners",
);

const transitionPairs = Object.values(WORLD_LOCATION_DEFINITIONS).flatMap(({ id, transports }) => (
  transports.map(({ destinationWorldId }) => `${id}->${destinationWorldId}`)
));
assert.deepEqual(transitionPairs.sort(), ["nest->village", "village->nest"], "automatic transports remain the village and Nest pair");
assert.equal(WORLD_LOCATION_DEFINITIONS.nest.futureExit.destinationWorldId, WORLD_IDS.atoll, "the northern Nest dead end is assigned to the explicit Atoll entrance");
assert.equal(WORLD_LOCATION_DEFINITIONS.atoll.transports.length, 0, "Atoll arenas contain no persistent transport assets");

const villageResources = getResourceObjectsForWorld(WORLD_IDS.village);
const nestResources = getResourceObjectsForWorld(WORLD_IDS.nest);
assert(RESOURCE_OBJECTS.every(({ worldId }) => WORLD_LOCATION_IDS.includes(worldId)), "every canonical resource belongs to a registered world");
assert.equal(villageResources.length, RESOURCE_OBJECTS.length - 7, "all existing resources remain village-owned");
assert.equal(nestResources.filter(({ profileId }) => profileId === "tree-planted").length, 4, "Nest contains four gatherable trees");
assert.equal(nestResources.filter(({ profileId }) => profileId === "stone-large").length, 1, "Nest contains one large stone");
assert.equal(nestResources.filter(({ profileId }) => profileId === "stone-small").length, 2, "Nest contains two small stones");
assert.equal(new Set(RESOURCE_OBJECTS.map(({ id }) => id)).size, RESOURCE_OBJECTS.length, "resource IDs are globally unique");
const villageTrees = STARTING_LAYOUT_DEFAULT.buildObjects.filter(({ item }) => item.resourceProfileId === "tree-planted");
const villageMaterialCounts = Object.fromEntries(["log-small", "log-large", "stone-small", "stone-large"].map((profileId) => [
  profileId,
  villageResources.filter((definition) => definition.profileId === profileId).length,
]));
assert.deepEqual(villageMaterialCounts, {
  "log-small": 2,
  "log-large": 1,
  "stone-small": 3,
  "stone-large": 3,
}, "the Burrow yard has the requested mix of sticks, logs, stones and rocks");
assert.equal(villageTrees.length, 2, "the Burrow yard has exactly two planted trees");
const villageMaterialYield = [...villageResources, ...villageTrees.map(({ id, item }) => ({ id, profileId: item.resourceProfileId }))]
  .reduce((total, definition) => {
    const { reward } = getResourceProfile(definition.profileId);
    if (reward.resource === "wood" || reward.resource === "stone") total[reward.resource] += reward.amount;
    return total;
  }, { wood: 0, stone: 0 });
assert.deepEqual(villageMaterialYield, {
  wood: STOVE_REPAIR_COST.wood * 1.5,
  stone: STOVE_REPAIR_COST.stone * 1.5,
}, "the Burrow yard yields exactly one and a half stove material costs");
assert.equal(createPlantedTreeDefinition({
  id: "task-059-village-tree",
  item: { resourceProfileId: "tree-planted" },
  colliderBounds: { left: 16, top: 16, right: 32, bottom: 32 },
}).worldId, WORLD_IDS.village, "authoring resource definitions remain explicitly village-owned");

for (const worldId of WORLD_LOCATION_IDS) {
  const definition = WORLD_LOCATION_DEFINITIONS[worldId];
  const layout = createPreparedLayout(worldId);
  assert.deepEqual(layout.bounds, {
    left: 0,
    top: 0,
    right: definition.columns * TILE_SIZE,
    bottom: definition.rows * TILE_SIZE,
  }, `${worldId} exposes its own bounds`);
  for (const transition of layout.transitions) {
    assert.equal(transition.footprintBounds.right - transition.footprintBounds.left, 2 * TILE_SIZE, `${transition.id} width is 2 tiles`);
    assert.equal(transition.footprintBounds.bottom - transition.footprintBounds.top, 2 * TILE_SIZE, `${transition.id} height is 2 tiles`);
    const destination = createPreparedLayout(transition.destinationWorldId);
    const destinationTransport = destination.transitions.find(({ id }) => id === transition.destinationTransportId);
    assert(destinationTransport, `${transition.id} resolves its destination transport`);
    assert.equal(contains(destinationTransport.triggerBounds, destinationTransport.safeSpawn), false, `${destinationTransport.id} spawn is outside its trigger`);
    assert.equal(collides(destinationTransport.safeSpawn, destination, 8, 5), false, `${destinationTransport.id} spawn is collision-safe`);
    const triggerCenter = center(destinationTransport.triggerBounds);
    const direction = Math.sign(triggerCenter.y - destinationTransport.safeSpawn.y);
    for (let y = destinationTransport.safeSpawn.y; y !== triggerCenter.y; y += direction) {
      assert.equal(collides({ x: triggerCenter.x, y }, destination, 8, 5), false, `${destinationTransport.id} is reachable from its safe spawn`);
    }
    assert.equal(collides(triggerCenter, destination, 8, 5), false, `${destinationTransport.id} trigger is physically enterable`);
  }
}

const nestLayout = createPreparedLayout(WORLD_IDS.nest);
assert(nestLayout.groundTiles.length < NEST_ISLAND_MODEL.columns * NEST_ISLAND_MODEL.rows, "Nest renders as an island rather than a filled rectangle");
for (const [x, y] of [[0, 0], [21, 0], [0, 15], [21, 15]]) {
  assert(nestLayout.blocked.has(cellKey(x * 2, y * 2)), `Nest corner ${x},${y} is blocked`);
}
assert.equal(collides({ x: 2, y: 2 }, nestLayout, 8, 5), true, "diagonal escape through a Nest corner is blocked");
assert.equal(nestLayout.groundTiles.filter(({ terrain }) => terrain === "dead-end").length, NEST_ISLAND_MODEL.deadEndTiles.length, "the northern stone dead end is deterministic");
assert.deepEqual(
  [...new Set(nestLayout.groundTiles.filter(({ terrain }) => terrain === "cliff-inner").map(({ frame }) => frame))].sort((a, b) => a - b),
  Object.values(OUTDOOR_FRAMES.islandInnerCorner).sort((a, b) => a - b),
  "all four stepped island corners are rendered from the semantic mask",
);
const mainPassage = { left: 9 * TILE_SIZE, top: 6 * TILE_SIZE, right: 13 * TILE_SIZE, bottom: 13 * TILE_SIZE };
const nestResourceBounds = [];
for (const definition of nestResources) {
  const profile = getResourceProfile(definition.profileId);
  const collision = profile.collisionRect ?? {
    left: 0,
    top: 0,
    right: profile.footprint.width * 8,
    bottom: profile.footprint.height * 8,
  };
  const bounds = {
    left: definition.cell.x * 8 + collision.left,
    top: definition.cell.y * 8 + collision.top,
    right: definition.cell.x * 8 + collision.right,
    bottom: definition.cell.y * 8 + collision.bottom,
  };
  assert.equal(overlaps(bounds, mainPassage), false, `${definition.id} leaves the main passage clear`);
  assert.equal(nestLayout.isBlockedCell(Math.floor((bounds.left + bounds.right) / 16), Math.floor((bounds.top + bounds.bottom) / 16)), false, `${definition.id} collider stays on walkable island terrain`);
  assert(nestResourceBounds.every(({ bounds: other }) => !overlaps(bounds, other)), `${definition.id} does not overlap another Nest resource`);
  nestResourceBounds.push({ id: definition.id, bounds });
}

const atollLayout = createPreparedLayout(WORLD_IDS.atoll);
assert.equal(atollLayout.transitions.length, 0, "Atoll layout has no hidden or persistent lifts");
assert.equal(atollLayout.groundTiles.length, ATOLL_WORLD_MODEL.columns * ATOLL_WORLD_MODEL.rows, "Atoll arena space is a clean rectangular field");
assert.equal(collides(ATOLL_WORLD_MODEL.spawn, atollLayout, 8, 5), false, "Atoll entry spawn is collision-safe");
assert.equal(collides({ x: 2, y: 2 }, atollLayout, 8, 5), true, "Atoll boundary prevents leaving the arena field");

const sessionState = { currentWorldId: WORLD_IDS.village };
const player = { motor: { position: { x: 0, y: 0 }, movement: null }, visual: { setPresentationPose() {} } };
let activeLayout = null;
let saveCount = 0;
const coordinator = createWorldLocationCoordinator({
  sessionState,
  createLayout: (worldId) => createWorldLayout(worldId),
  getPlayerCharacter: () => player,
  applyLocationLayout: ({ layout }) => { activeLayout = layout; },
  saveSession: () => { saveCount += 1; },
});
activeLayout = coordinator.createInitialLayout();
const villageTransport = activeLayout.transitions[0];
player.motor.position = center(villageTransport.triggerBounds);
assert.equal(coordinator.update().worldId, WORLD_IDS.nest, "crossing the village trigger enters Nest");
assert.equal(sessionState.currentWorldId, WORLD_IDS.nest, "transition synchronizes currentWorldId");
assert.equal(saveCount, 1, "transition initiates persistence once");
assert.equal(coordinator.update().status, "armed", "destination spawn releases the lock only after it is outside the trigger");
player.motor.position = center(activeLayout.transitions[0].triggerBounds);
assert.equal(coordinator.update().worldId, WORLD_IDS.village, "the southern Nest transport returns to village");
assert.equal(saveCount, 2, "return transition persists once without duplicate work");
const explicitAtoll = coordinator.transitionTo(WORLD_IDS.atoll, ATOLL_WORLD_MODEL.spawn);
assert.equal(explicitAtoll.worldId, WORLD_IDS.atoll, "the Nest entrance may explicitly enter the transport-free Atoll world");
assert.equal(activeLayout.transitions.length, 0);
assert.equal(coordinator.getState().transitionLocked, false, "explicit arena transitions do not create a hidden transport lock");
assert.equal(saveCount, 3);
const explicitNest = coordinator.transitionTo(WORLD_IDS.nest, NEST_RETURN_SPAWN_FIXTURE);
assert.equal(explicitNest.worldId, WORLD_IDS.nest, "the edge arena may explicitly return to Nest");
assert.deepEqual(player.motor.position, { x: NEST_RETURN_SPAWN_FIXTURE.x, y: NEST_RETURN_SPAWN_FIXTURE.y });
assert.equal(saveCount, 4);

console.log("Task #059 checks passed: registry, isolated Atoll, paired reachable transports, explicit arena transitions, safe spawns and collision");

function createPreparedLayout(worldId) {
  const state = { currentWorldId: worldId };
  const coordinator = createWorldLocationCoordinator({ sessionState: state, createLayout: (id) => createWorldLayout(id) });
  return coordinator.createInitialLayout();
}

function center(bounds) {
  return { x: (bounds.left + bounds.right) / 2, y: (bounds.top + bounds.bottom) / 2 };
}

function contains(bounds, point) {
  return point.x >= bounds.left && point.x < bounds.right
    && point.y >= bounds.top && point.y < bounds.bottom;
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
