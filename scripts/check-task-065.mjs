import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createFreshGameSessionState } from "../src/session/gameSessionState.js";
import { createWorldLocationRuntime, validateLocationCapabilities } from "../src/world/worldLocationRuntime.js";
import { createWorldPresentationRuntime } from "../src/world/worldPresentationRuntime.js";
import { WORLD_LOCATION_DEFINITIONS } from "../src/world/worldLocationConfig.js";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const main = read("src/main.js");
const runtimeSource = read("src/world/worldLocationRuntime.js");
const presentationSource = read("src/world/worldPresentationRuntime.js");
const e2eBridge = read("src/devtools/e2eBridge.js");
const architectureCheck = read("scripts/check-architecture-boundaries.mjs");

assert.equal(existsSync("src/worldLocationLifecycle.js"), false, "scene-wide lifecycle module must be removed");
for (const method of [
  "mountLocationLifecycle",
  "destroyLocationLifecycle",
  "canTransitionLocation",
  "renderWorld",
  "createMerchantRuntime",
  "createDebrisRuntime",
  "createFacilityRuntime",
  "createTavernRuntime",
  "createFarmingRuntime",
  "createCookingRuntime",
  "createMeleeRuntime",
  "createBuildCoordinator",
]) {
  assert(!new RegExp(`^  ${method}\\(`, "m").test(main), `WorldScene must not retain ${method}`);
}

for (const owner of [
  "merchantRuntime",
  "debrisRuntime",
  "meleeRuntime",
  "facilityRuntime",
  "needsInteractionCoordinator",
  "tavernSignRuntime",
  "tavernServiceRuntime",
  "guestRuntime",
  "coinRuntime",
  "farmingRuntime",
  "cookingRuntime",
  "kitchenInteractionRuntime",
  "movementDebugPanel",
  "worldBuildCoordinator",
  "buildMode",
]) {
  assert(!new RegExp(`this\\.${owner}\\s*=`, "u").test(main), `WorldScene must not assign location owner ${owner}`);
}

for (const method of [
  "mount({ definition, layout } = {})",
  "unmount()",
  "handleFrameActions(actions)",
  "updateRealTime(deltaMs)",
  "runWorldStep(deltaMs, updateCharacters)",
  "updateCandidate(candidate)",
  "canTransition()",
  "getOwners()",
  "destroy()",
]) assert(runtimeSource.includes(method), `WorldLocationRuntime public API must include ${method}`);

for (const method of ["mount(layout)", "unmount()", "getBuildSurfaceRegistries()", "destroy()"]) {
  assert(presentationSource.includes(method), `WorldPresentationRuntime public API must include ${method}`);
}
assert(!runtimeSource.includes("scene."), "WorldLocationRuntime must not inspect arbitrary WorldScene fields");
assert(presentationSource.includes("this.groundSprites = new Map()"));
assert(presentationSource.includes("this.floorSprites = new Map()"));
assert(presentationSource.includes("this.wallSprites = new Map()"));
assert(e2eBridge.includes("worldLocationRuntime?.getOwners?.()"));
assert(!/scene\.(merchantRuntime|debrisRuntime|facilityRuntime|farmingRuntime|cookingRuntime|meleeRuntime|worldBuildCoordinator)/u.test(e2eBridge));
assert.equal(Number(architectureCheck.match(/MAX_WORLD_SCENE_LINES = (\d+)/u)?.[1]), 1300);
assert(main.split("\n").length <= 1300);
assert(
  main.indexOf("this.interactionRuntime?.destroy()") < main.indexOf("this.worldLocationRuntime?.destroy?.()"),
  "scene shutdown must detach the interaction presenter before location candidate reset touches Phaser input",
);

assert.equal(WORLD_LOCATION_DEFINITIONS.village.capabilities.tavernService, true);
assert.equal(WORLD_LOCATION_DEFINITIONS.village.capabilities.cooking, true);
assert.equal(WORLD_LOCATION_DEFINITIONS.nest.capabilities.tavernService, false);
assert.equal(WORLD_LOCATION_DEFINITIONS.nest.capabilities.cooking, false);
assert.throws(
  () => validateLocationCapabilities({ tavernService: true, facilities: false }),
  /tavernService requires facilities/u,
);
assert.throws(
  () => validateLocationCapabilities({ cooking: true, facilities: false }),
  /cooking requires facilities/u,
);

const lifecycle = createLifecycleHarness();
const village = definition("village-fixture", {
  homeSystems: true,
  npcs: true,
  meleeWeapons: true,
  trainingDummy: true,
  facilities: true,
  tavernService: true,
  farming: true,
  cooking: true,
  buildMode: true,
});
const firstVillageOwners = lifecycle.runtime.mount({ definition: village, layout: layout("village-fixture") });
assert.deepEqual(
  creationEvents(lifecycle.events),
  ["presentation", "npc", "merchant", "debris", "melee", "facility", "needs", "tavern-sign", "tavern-service", "farming", "cooking", "kitchen", "movement-debug", "build", "interaction-bind", "candidate-reset", "hud-sync"],
  "capabilities must mount in canonical order",
);
assert(firstVillageOwners.merchantRuntime && firstVillageOwners.worldBuildCoordinator && firstVillageOwners.buildModeRuntime);

lifecycle.events.length = 0;
lifecycle.runtime.handleFrameActions({ primary: true });
lifecycle.runtime.updateRealTime(16);
lifecycle.runtime.runWorldStep(20, () => lifecycle.events.push("characters-update"));
lifecycle.runtime.updateCandidate({ id: "candidate" });
assert.deepEqual(lifecycle.events, [
  "melee-actions",
  "needs-update",
  "gameplay-time",
  "cooking-update",
  "tavern-update",
  "melee-before",
  "characters-update",
  "melee-after",
  "merchant-candidate",
  "debris-candidate",
  "farming-candidate",
  "debug-update",
]);

assert.equal(lifecycle.runtime.canTransition(), true);
for (const guard of ["sleeping", "options", "confirmation", "build", "facility", "cooking", "dialogue", "merchant"]) {
  lifecycle.guards[guard] = true;
  assert.equal(lifecycle.runtime.canTransition(), false, `${guard} must block transition`);
  lifecycle.guards[guard] = false;
}

lifecycle.events.length = 0;
lifecycle.runtime.unmount();
const firstDestroyEvents = [...lifecycle.events];
assert(firstDestroyEvents.indexOf("candidate-reset") < firstDestroyEvents.indexOf("interaction-unbind"));
assert(firstDestroyEvents.indexOf("interaction-unbind") < firstDestroyEvents.indexOf("destroy:build"));
assert.deepEqual(destroyEvents(firstDestroyEvents), [
  "destroy:build",
  "destroy:movement-debug",
  "destroy:cooking",
  "destroy:farming",
  "destroy:tavern-service",
  "destroy:tavern-sign",
  "destroy:facility",
  "destroy:melee",
  "destroy:debris",
  "destroy:merchant",
  "destroy:npc",
  "destroy:presentation",
], "destroy must reverse the dependency order and leave presentation last");
assert(Object.values(lifecycle.runtime.getOwners()).every((owner) => owner === null));
lifecycle.runtime.unmount();
assert.deepEqual(lifecycle.events, firstDestroyEvents, "repeated unmount must be idempotent");

const nestOwners = lifecycle.runtime.mount({
  definition: definition("nest-fixture", { meleeWeapons: true }),
  layout: layout("nest-fixture"),
});
assert(nestOwners.debrisRuntime && nestOwners.meleeRuntime);
assert.equal(nestOwners.merchantRuntime, null);
assert.equal(nestOwners.facilityRuntime, null);
assert.equal(nestOwners.farmingRuntime, null);
assert.equal(nestOwners.worldBuildCoordinator, null);
lifecycle.runtime.unmount();
const secondVillageOwners = lifecycle.runtime.mount({ definition: village, layout: layout("village-fixture") });
assert.notEqual(secondVillageOwners.merchantRuntime, firstVillageOwners.merchantRuntime, "remount must not reuse stale owners");
lifecycle.runtime.destroy();
const afterDestroyCount = lifecycle.events.length;
lifecycle.runtime.destroy();
assert.equal(lifecycle.events.length, afterDestroyCount, "repeated destroy must be idempotent");

const farmingOnly = createLifecycleHarness();
const farmingOwners = farmingOnly.runtime.mount({
  definition: definition("farming-only", { farming: true, facilities: false }),
  layout: layout("farming-only"),
});
assert(farmingOwners.farmingRuntime, "farming capability must mount independently");
assert.equal(farmingOwners.facilityRuntime, null);
farmingOnly.runtime.destroy();

checkPresentationLifecycle();

console.log("Task #065 location runtime, capability, presentation and lifecycle contracts passed");

function createLifecycleHarness() {
  const events = [];
  const guards = {
    sleeping: false,
    options: false,
    confirmation: false,
    build: false,
    facility: false,
    cooking: false,
    dialogue: false,
    merchant: false,
  };
  const characters = new Map([["player", { id: "player", motor: { position: { x: 0, y: 0 }, footWidth: 8, footDepth: 4 } }]]);
  const owner = (name, methods = {}) => ({
    name,
    destroy: () => events.push(`destroy:${name}`),
    ...methods,
  });
  const presentationRuntime = {
    mount: () => events.push("presentation"),
    unmount: () => events.push("destroy:presentation"),
    getBuildSurfaceRegistries: () => ({ groundSprites: new Map(), floorSprites: new Map(), wallSprites: new Map() }),
    addCanonicalTile() {},
    createCanonicalWallEntry() {},
  };
  const factories = {
    character: (_host, options) => ({ id: options.id }),
    merchant: () => {
      events.push("merchant");
      return owner("merchant", {
        isActive: () => guards.merchant,
        updateCandidate: () => events.push("merchant-candidate"),
      });
    },
    debris: () => {
      events.push("debris");
      return owner("debris", { updateCandidate: () => events.push("debris-candidate") });
    },
    melee: () => {
      events.push("melee");
      return owner("melee", {
        handleActions: () => events.push("melee-actions"),
        beforeCharacterUpdate: () => events.push("melee-before"),
        afterCharacterUpdate: () => events.push("melee-after"),
      });
    },
    facility: () => {
      events.push("facility");
      return owner("facility", { isUsing: () => guards.facility });
    },
    needsInteraction: () => {
      events.push("needs");
      return { update: () => events.push("needs-update"), isLocked: () => false };
    },
    tavernSign: () => {
      events.push("tavern-sign");
      return owner("tavern-sign");
    },
    tavernService: () => {
      events.push("tavern-service");
      return owner("tavern-service", {
        guestRuntime: {},
        coinRuntime: {},
        update: () => events.push("tavern-update"),
      });
    },
    farming: () => {
      events.push("farming");
      return owner("farming", { updateCandidate: () => events.push("farming-candidate") });
    },
    cooking: () => {
      events.push("cooking");
      return owner("cooking", {
        isActive: () => guards.cooking,
        update: () => events.push("cooking-update"),
      });
    },
    kitchenInteraction: () => {
      events.push("kitchen");
      return {};
    },
    movementDebugPanel: () => {
      events.push("movement-debug");
      return owner("movement-debug", { updateStatus: () => events.push("debug-update") });
    },
    worldBuildCoordinator: () => {
      events.push("build");
      return owner("build", { getBuildModeRuntime: () => ({ isActive: () => guards.build }) });
    },
  };
  const runtime = createWorldLocationRuntime({
    renderingHost: {},
    sessionState: createFreshGameSessionState(),
    localization: { getLanguage: () => "en" },
    presentationRuntime,
    characterSystem: {
      has: (id) => characters.has(id),
      add: (character) => { characters.set(character.id, character); events.push("npc"); },
      remove: (id) => { if (characters.delete(id)) events.push("destroy:npc"); },
      require: (id) => characters.get(id),
    },
    movementConfig: {},
    gameplayTuning: { needs: { toiletAccident: {} } },
    globalOwners: {
      worldInteractionCoordinator: {
        rebindLocationOwners: () => events.push("interaction-bind"),
        unbindLocationOwners: () => events.push("interaction-unbind"),
      },
      interactionRuntime: {
        resetCandidate: () => events.push("candidate-reset"),
        isDialogueActive: () => guards.dialogue,
      },
      uiVisibilityCoordinator: { register: () => () => events.push("merchant-unregister") },
      gameHud: {},
      audioRuntime: {},
      needsRuntime: {},
      needsFlowRuntime: {},
      cameraRuntime: {},
    },
    callbacks: {
      getPlayerCharacter: () => characters.get("player"),
      getFrameMeleeItem: () => null,
      getControllerMoveDirection: () => ({ x: 0, y: 0 }),
      isSleeping: () => guards.sleeping,
      isOptionsOpen: () => guards.options,
      isConfirmationActive: () => guards.confirmation,
      updateGameplayTime: () => events.push("gameplay-time"),
      syncGameplayHudVisibility: () => events.push("hud-sync"),
    },
    factories,
  });
  return { runtime, events, guards };
}

function checkPresentationLifecycle() {
  let destroyCount = 0;
  const image = () => ({
    setOrigin() { return this; },
    setDepth() { return this; },
    setCrop() { return this; },
    destroy() { destroyCount += 1; },
  });
  const runtime = createWorldPresentationRuntime({ renderingHost: { add: { image } } });
  const fixture = {
    groundTiles: [{ x: 0, y: 0, frame: 0 }],
    houseFloorTiles: [{ x: 1, y: 0, frame: 0 }],
    houseWallTiles: [{ id: "wall", x: 2, y: 0, frame: 0, supplements: [] }],
    decorationTiles: [{ x: 3, y: 0, frame: 0, depth: 1 }],
    transportTiles: [{ worldX: 0, worldY: 16, textureKey: "transport", frame: 0, depth: 2 }],
  };
  const registries = runtime.mount(fixture);
  assert.equal(registries.groundSprites.size, 1);
  assert.equal(registries.floorSprites.size, 1);
  assert.equal(registries.wallSprites.size, 1);
  runtime.unmount();
  assert.equal(destroyCount, 5);
  assert.equal(registries.groundSprites.size, 0);
  assert.equal(registries.floorSprites.size, 0);
  assert.equal(registries.wallSprites.size, 0);
  runtime.unmount();
  assert.equal(destroyCount, 5, "presentation unmount must not destroy duplicates");
  runtime.destroy();
  runtime.destroy();
  assert.equal(destroyCount, 5, "presentation destroy must be idempotent");
}

function definition(id, capabilities) {
  return { id, capabilities };
}

function layout(id) {
  return { locationId: id, resourceDefinitions: [] };
}

function creationEvents(events) {
  return events.filter((event) => !event.startsWith("destroy:") && event !== "merchant-unregister");
}

function destroyEvents(events) {
  return events.filter((event) => event.startsWith("destroy:"));
}
