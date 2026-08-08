import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { DEFAULT_ASSET_PROFILES } from "../src/build/assetProfiles.js";
import { PLACEABLE_TARGETING_GROUP } from "../src/build/liveAssetGeometry.js";
import { createWorldInteractionCoordinator } from "../src/interaction/worldInteractionCoordinator.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import {
  WORLD_IDS,
  WORLD_LOCATION_DEFINITIONS,
  WORLD_TRANSITION_INTERACTION_KIND,
} from "../src/world/worldLocationConfig.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import {
  WORLD_TRANSITION_ASSETS,
  WORLD_TRANSITION_PROFILE_KEYS,
} from "../src/world/worldConfig.js";

const BURROW_TO_NEST_PATH = "public/assets/project/world/NestledBurrow_NestStairway.png";
const NEST_TO_BURROW_PATH = "public/assets/project/world/NestledBurrow_HighgroundEntranceStairs.png";

assert.equal(existsSync(BURROW_TO_NEST_PATH), true, "Burrow-to-Nest stair sprite must exist");
assert.equal(existsSync(NEST_TO_BURROW_PATH), true, "Nest-to-Burrow stair sprite must exist");
assert.deepEqual(pngSize(BURROW_TO_NEST_PATH), { width: 64, height: 128 }, "Nest stairway keeps its native 64x128 size");
assert.deepEqual(pngSize(NEST_TO_BURROW_PATH), { width: 64, height: 48 }, "highground entrance stairs keep their native 64x48 size");
assertCompletePng(BURROW_TO_NEST_PATH);
assertCompletePng(NEST_TO_BURROW_PATH);
assert.equal(WORLD_TRANSITION_ASSETS.burrowToNest.path, "assets/project/world/NestledBurrow_NestStairway.png");
assert.equal(WORLD_TRANSITION_ASSETS.nestToBurrow.path, "assets/project/world/NestledBurrow_HighgroundEntranceStairs.png");

for (const [profileKey, direction] of [
  [WORLD_TRANSITION_PROFILE_KEYS.burrowToNest, "bottom"],
  [WORLD_TRANSITION_PROFILE_KEYS.nestToBurrow, "top"],
]) {
  const profile = DEFAULT_ASSET_PROFILES[profileKey];
  assert(profile, `${profileKey} is a canonical asset profile`);
  assert.equal(profile.family, "transition");
  assert.deepEqual(profile.interactionOffset, { x: 0, y: 0 });
  assert.deepEqual(profile.interactionDirections, [direction]);
  assert.deepEqual(profile.colliderOffsets, { left: 0, right: 0, top: 0, bottom: 0 });
  assert.deepEqual(profile.visualOffset, { x: 0, y: 0 });
}

const villageDefinition = WORLD_LOCATION_DEFINITIONS[WORLD_IDS.village];
const nestDefinition = WORLD_LOCATION_DEFINITIONS[WORLD_IDS.nest];
assert.equal(villageDefinition.transports.length, 1);
assert.equal(nestDefinition.transports.length, 1);
assert.strictEqual(villageDefinition.transports[0].asset, WORLD_TRANSITION_ASSETS.burrowToNest, "Burrow exit uses the upward Nest stairway asset");
assert.strictEqual(nestDefinition.transports[0].asset, WORLD_TRANSITION_ASSETS.nestToBurrow, "Nest exit uses the downward highground stair asset");
assert.equal(villageDefinition.transports[0].profileKey, WORLD_TRANSITION_PROFILE_KEYS.burrowToNest);
assert.equal(nestDefinition.transports[0].profileKey, WORLD_TRANSITION_PROFILE_KEYS.nestToBurrow);
assert.equal(villageDefinition.transports[0].prompt, "hud:interaction.enterNest");
assert.equal(nestDefinition.transports[0].prompt, "hud:interaction.enterBurrow");

const villageCoordinator = createWorldLocationCoordinator({
  sessionState: { currentWorldId: WORLD_IDS.village },
  createLayout: (worldId) => createWorldLayout(worldId),
  getAssetProfiles: () => DEFAULT_ASSET_PROFILES,
});
const villageLayout = villageCoordinator.createInitialLayout();
assert.equal(villageLayout.transportTiles.length, 1, "Burrow transition renders as one native image object");
assert.equal(villageLayout.transportTiles[0].textureKey, WORLD_TRANSITION_ASSETS.burrowToNest.textureKey);
assert.equal(villageLayout.transportTiles[0].frame, undefined, "native stair PNG is not split into atlas frames");
assert.equal(villageLayout.transportTiles[0].profileKey, WORLD_TRANSITION_PROFILE_KEYS.burrowToNest);
assert.deepEqual(
  [villageLayout.transitions[0].footprintBounds.right - villageLayout.transitions[0].footprintBounds.left,
    villageLayout.transitions[0].footprintBounds.bottom - villageLayout.transitions[0].footprintBounds.top],
  [64, 128],
);
const villageCollider = villageLayout.getWorldObjectColliders().find(({ id }) => id === "village-nest-transport");
assert.equal(villageCollider.groupKey, WORLD_TRANSITION_PROFILE_KEYS.burrowToNest);
assert.deepEqual(villageCollider.rect, { left: 480, right: 544, top: 188, bottom: 192 });
assert.equal(villageCoordinator.update().transitioned, false, "world-location frame update never auto-activates the stair");
const villageInteraction = villageCoordinator.getInteractionDefinitions()[0];
assert.equal(villageInteraction.kind, WORLD_TRANSITION_INTERACTION_KIND);
assert.equal(villageInteraction.requiresFacing, false);
assert.equal(villageInteraction.radius, 32);
assert.equal(villageInteraction.targetingGroup, PLACEABLE_TARGETING_GROUP);
assert.equal(villageInteraction.targetingMode, "facing-first");
assert.deepEqual(villageInteraction.interactionDirections, ["bottom"]);
assert.deepEqual(villageInteraction.position, { x: 512, y: 190 });

const editedProfiles = {
  ...DEFAULT_ASSET_PROFILES,
  [WORLD_TRANSITION_PROFILE_KEYS.burrowToNest]: {
    ...DEFAULT_ASSET_PROFILES[WORLD_TRANSITION_PROFILE_KEYS.burrowToNest],
    interactionOffset: { x: 7, y: -3 },
  },
};
villageCoordinator.getAssetProfiles = () => editedProfiles;
assert.deepEqual(villageCoordinator.getInteractionDefinitions()[0].position, { x: 519, y: 187 }, "edited interaction offset changes the live stair target without rebuilding the location");

let dispatchedCandidate = null;
let suppressed = 0;
const interactionCoordinator = createWorldInteractionCoordinator({
  sessionState: { currentWorldId: WORLD_IDS.village },
  getWorldTransitionDefinitions: () => [villageInteraction],
  activateWorldTransition: (candidate) => {
    dispatchedCandidate = candidate;
    return { status: "transitioned", transitioned: true };
  },
  suppressNextInteract: () => { suppressed += 1; },
});
assert.deepEqual(interactionCoordinator.getStaticInteractionDefinitions(), [villageInteraction], "paired stairs participate in the canonical static interaction set");
assert.equal(interactionCoordinator.handle(villageInteraction).status, "transitioned", "canonical interaction dispatch activates the world transition");
assert.strictEqual(dispatchedCandidate, villageInteraction);
assert.equal(suppressed, 1, "successful stair activation consumes the current interact action");
interactionCoordinator.destroy();

const nestCoordinator = createWorldLocationCoordinator({
  sessionState: { currentWorldId: WORLD_IDS.nest },
  createLayout: (worldId) => createWorldLayout(worldId),
  getAssetProfiles: () => DEFAULT_ASSET_PROFILES,
});
const nestLayout = nestCoordinator.createInitialLayout();
assert.equal(nestLayout.transportTiles.length, 1, "Nest transition renders as one native image object");
assert.equal(nestLayout.transportTiles[0].textureKey, WORLD_TRANSITION_ASSETS.nestToBurrow.textureKey);
assert.equal(nestLayout.transportTiles[0].profileKey, WORLD_TRANSITION_PROFILE_KEYS.nestToBurrow);
assert.deepEqual(
  [nestLayout.transitions[0].footprintBounds.right - nestLayout.transitions[0].footprintBounds.left,
    nestLayout.transitions[0].footprintBounds.bottom - nestLayout.transitions[0].footprintBounds.top],
  [64, 48],
);
const nestCollider = nestLayout.getWorldObjectColliders().find(({ id }) => id === "nest-village-transport");
assert.equal(nestCollider.groupKey, WORLD_TRANSITION_PROFILE_KEYS.nestToBurrow);
assert.deepEqual(nestCollider.rect, { left: 144, right: 208, top: 208, bottom: 212 });
const nestInteraction = nestCoordinator.getInteractionDefinitions()[0];
assert.deepEqual(nestInteraction.position, { x: 176, y: 210 });
assert.deepEqual(nestInteraction.interactionDirections, ["top"]);
assert.equal(nestInteraction.targetingGroup, PLACEABLE_TARGETING_GROUP);

const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes("WORLD_TRANSITION_ASSETS"), "WorldScene must preload the two native transition images");
assert(mainSource.includes("getWorldTransitionDefinitions"), "WorldScene must wire location transition definitions into interaction dispatch");
assert(mainSource.includes("activateWorldTransition"), "WorldScene must wire interaction activation back to the location coordinator");
const presentationSource = readFileSync("src/world/worldPresentationRuntime.js", "utf8");
assert(presentationSource.includes("tile.frame == null"), "standalone transition PNGs bypass atlas-frame rendering");
assert(presentationSource.includes("getTransitionAuthoringInstances"), "transition visuals participate in universal asset authoring");
assert(presentationSource.includes("assetDepthFromPivot"), "transition depth follows the editable pivot contract");
const universalAuthoringSource = readFileSync("src/build/universalPlaceableAuthoring.js", "utf8");
for (const required of [
  "transitionInstances(scene)",
  "selectInteractionPointAt",
  "setInteractionOffset",
  "Редактировать точку взаимодействия",
  "Сохранить точку взаимодействия",
]) {
  assert(universalAuthoringSource.includes(required), `universal authoring retains ${required}`);
}
const bootstrapSource = readFileSync("src/build/assetRuntimeConsistencyBootstrap.js", "utf8");
assert(bootstrapSource.includes("this.activeDefinition?.transports?.length"), "transition locations mount the same authoring panel even without build mode");
assert(bootstrapSource.includes("installWorldTransitionAuthoringBridge"), "transition authoring gets live scene/profile wiring");
const editorSource = readFileSync("src/build/editorAuthoringRuntime.js", "utf8");
assert(editorSource.includes("hasBuildCoordinator"), "profile authoring remains available without a build coordinator");
assert(!editorSource.includes("throw new Error(\"World build coordinator is unavailable\")"));

const ruHud = JSON.parse(readFileSync("public/locales/ru/hud.json", "utf8"));
const enHud = JSON.parse(readFileSync("public/locales/en/hud.json", "utf8"));
assert.equal(ruHud.interaction.enterNest, "Подняться в гнездо");
assert.equal(ruHud.interaction.enterBurrow, "Спуститься в нору");
assert.equal(enHud.interaction.enterNest, "Go up to the Nest");
assert.equal(enHud.interaction.enterBurrow, "Go down to the Burrow");

console.log("Task #074 checks passed: decodable stair PNGs, editable object profiles, live collider/pivot/interaction geometry and active Space transitions");

function pngSize(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${path} must be a PNG file`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function assertCompletePng(path) {
  const bytes = readFileSync(path);
  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${path} must have a valid PNG signature`,
  );
  let offset = 8;
  let sawIend = false;
  while (offset < bytes.length) {
    assert(offset + 12 <= bytes.length, `${path} has a truncated PNG chunk header`);
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const end = offset + 12 + length;
    assert(end <= bytes.length, `${path} has a truncated ${type} chunk`);
    offset = end;
    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }
  assert.equal(sawIend, true, `${path} must contain a complete IEND chunk`);
  assert.equal(offset, bytes.length, `${path} must not contain bytes after IEND`);
}
