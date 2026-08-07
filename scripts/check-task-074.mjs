import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createWorldInteractionCoordinator } from "../src/interaction/worldInteractionCoordinator.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import {
  WORLD_IDS,
  WORLD_LOCATION_DEFINITIONS,
  WORLD_TRANSITION_INTERACTION_KIND,
} from "../src/world/worldLocationConfig.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import { WORLD_TRANSITION_ASSETS } from "../src/world/worldConfig.js";

const BURROW_TO_NEST_PATH = "public/assets/project/world/NestledBurrow_NestStairway.png";
const NEST_TO_BURROW_PATH = "public/assets/project/world/NestledBurrow_HighgroundEntranceStairs.png";

assert.equal(existsSync(BURROW_TO_NEST_PATH), true, "Burrow-to-Nest stair sprite must already exist in the base repository");
assert.equal(existsSync(NEST_TO_BURROW_PATH), true, "Nest-to-Burrow stair sprite must already exist in the base repository");
assert.deepEqual(pngSize(BURROW_TO_NEST_PATH), { width: 64, height: 128 }, "Nest stairway keeps its native 64x128 size");
assert.deepEqual(pngSize(NEST_TO_BURROW_PATH), { width: 64, height: 48 }, "highground entrance stairs keep their native 64x48 size");
assert.equal(WORLD_TRANSITION_ASSETS.burrowToNest.path, "assets/project/world/NestledBurrow_NestStairway.png");
assert.equal(WORLD_TRANSITION_ASSETS.nestToBurrow.path, "assets/project/world/NestledBurrow_HighgroundEntranceStairs.png");

const villageDefinition = WORLD_LOCATION_DEFINITIONS[WORLD_IDS.village];
const nestDefinition = WORLD_LOCATION_DEFINITIONS[WORLD_IDS.nest];
assert.equal(villageDefinition.transports.length, 1);
assert.equal(nestDefinition.transports.length, 1);
assert.strictEqual(villageDefinition.transports[0].asset, WORLD_TRANSITION_ASSETS.burrowToNest, "Burrow exit uses the upward Nest stairway asset");
assert.strictEqual(nestDefinition.transports[0].asset, WORLD_TRANSITION_ASSETS.nestToBurrow, "Nest exit uses the downward highground stair asset");
assert.equal(villageDefinition.transports[0].prompt, "hud:interaction.enterNest");
assert.equal(nestDefinition.transports[0].prompt, "hud:interaction.enterBurrow");

const villageCoordinator = createWorldLocationCoordinator({
  sessionState: { currentWorldId: WORLD_IDS.village },
  createLayout: (worldId) => createWorldLayout(worldId),
});
const villageLayout = villageCoordinator.createInitialLayout();
assert.equal(villageLayout.transportTiles.length, 1, "Burrow transition renders as one native image object");
assert.equal(villageLayout.transportTiles[0].textureKey, WORLD_TRANSITION_ASSETS.burrowToNest.textureKey);
assert.equal(villageLayout.transportTiles[0].frame, undefined, "native stair PNG is not split into atlas frames");
assert.deepEqual(
  [villageLayout.transitions[0].footprintBounds.right - villageLayout.transitions[0].footprintBounds.left,
    villageLayout.transitions[0].footprintBounds.bottom - villageLayout.transitions[0].footprintBounds.top],
  [64, 128],
);
assert.equal(villageCoordinator.update().transitioned, false, "world-location frame update never auto-activates the stair");
const villageInteraction = villageCoordinator.getInteractionDefinitions()[0];
assert.equal(villageInteraction.kind, WORLD_TRANSITION_INTERACTION_KIND);
assert.equal(villageInteraction.requiresFacing, false);
assert.equal(villageInteraction.radius, 32);

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
});
const nestLayout = nestCoordinator.createInitialLayout();
assert.equal(nestLayout.transportTiles.length, 1, "Nest transition renders as one native image object");
assert.equal(nestLayout.transportTiles[0].textureKey, WORLD_TRANSITION_ASSETS.nestToBurrow.textureKey);
assert.deepEqual(
  [nestLayout.transitions[0].footprintBounds.right - nestLayout.transitions[0].footprintBounds.left,
    nestLayout.transitions[0].footprintBounds.bottom - nestLayout.transitions[0].footprintBounds.top],
  [64, 48],
);

const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes("WORLD_TRANSITION_ASSETS"), "WorldScene must preload the two native transition images");
assert(mainSource.includes("getWorldTransitionDefinitions"), "WorldScene must wire location transition definitions into interaction dispatch");
assert(mainSource.includes("activateWorldTransition"), "WorldScene must wire interaction activation back to the location coordinator");
const ruHud = JSON.parse(readFileSync("public/locales/ru/hud.json", "utf8"));
const enHud = JSON.parse(readFileSync("public/locales/en/hud.json", "utf8"));
assert.equal(ruHud.interaction.enterNest, "Подняться в гнездо");
assert.equal(ruHud.interaction.enterBurrow, "Спуститься в нору");
assert.equal(enHud.interaction.enterNest, "Go up to the Nest");
assert.equal(enHud.interaction.enterBurrow, "Go down to the Burrow");

console.log("Task #074 checks passed: native stair sprites, active Space transition contract, dispatcher wiring and localization");

function pngSize(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString("ascii"), "PNG", `${path} must be a PNG file`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}
