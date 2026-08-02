import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BED_INTERACTION_KIND } from "../src/resources/debrisConfig.js";
import { FACILITY_INTERACTION_KIND } from "../src/facilities/facilityConfig.js";
import { createFreshGameSessionState } from "../src/session/gameSessionState.js";
import { TAVERN_SIGN_KIND } from "../src/tavern/guestConfig.js";
import { DEFAULT_GAMEPLAY_TUNING, RESOURCE_INTERACTION_KIND, RESOURCE_OBJECTS } from "../src/resources/resourceConfig.js";
import { createWorldInteractionCoordinator } from "../src/interaction/worldInteractionCoordinator.js";

const read = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const main = read("src/main.js");
const coordinatorSource = read("src/interaction/worldInteractionCoordinator.js");
const interactionRuntime = read("src/interaction/interactionRuntime.js");
const locationRuntime = read("src/world/worldLocationRuntime.js");
const architectureCheck = read("scripts/check-architecture-boundaries.mjs");

assert(!main.includes("runWorldObjectInteraction"), "WorldScene must not execute world interactions");
assert(!main.includes("lastSuccessfulHitAtMs") && !main.includes("activeResourceProfileId"), "WorldScene must not own transient resource-action state");
for (const kind of ["TAVERN_SIGN_KIND", "FACILITY_INTERACTION_KIND", "BED_INTERACTION_KIND"]) {
  assert(!main.includes(kind), `WorldScene must not branch on ${kind}`);
}
assert(!/candidate\.kind\s*[!=]==?\s*RESOURCE_INTERACTION_KIND/u.test(main), "WorldScene must not execute resource candidates");
assert(main.includes("createWorldInteractionCoordinator") && main.includes("worldInteractionCoordinator: this.worldInteractionCoordinator"));
assert(!coordinatorSource.includes("scene."), "WorldInteractionCoordinator must not inspect arbitrary Phaser Scene fields");
assert(interactionRuntime.includes("worldInteractionCoordinator?.getStaticInteractionDefinitions"));
assert(interactionRuntime.includes("worldInteractionCoordinator?.isInteractionAllowed"));
assert(interactionRuntime.includes("worldInteractionCoordinator?.handle"));
assert(interactionRuntime.includes("startDialogue") && interactionRuntime.includes("advanceActiveDialogue"), "InteractionRuntime must retain dialogue lifecycle");
assert(!interactionRuntime.includes("runWorldObjectInteraction"));
assert(locationRuntime.includes("worldInteractionCoordinator?.rebindLocationOwners"));
assert(locationRuntime.indexOf("worldInteractionCoordinator?.unbindLocationOwners") < locationRuntime.indexOf("merchantRuntime?.destroy"));
assert(Number(architectureCheck.match(/MAX_WORLD_SCENE_LINES = (\d+)/u)?.[1]) <= 1520);
assert(read("src/main.js").split("\n").length <= 1520);

const dispatchNames = [
  "handleMerchant(candidate)",
  "handleFarming(candidate)",
  "handleTavernSign(candidate)",
  "handleFacility(candidate)",
  "handleBed(candidate)",
  "handleBusyGate()",
  "handleExhaustedWake(candidate)",
  "handleResource(candidate)",
];
const dispatchPositions = dispatchNames.map((name) => coordinatorSource.indexOf(name, coordinatorSource.indexOf("function handle(candidate)")));
assert(dispatchPositions.every((position) => position >= 0));
assert.deepEqual([...dispatchPositions].sort((a, b) => a - b), dispatchPositions, "dispatch order must be fixed");

function createHarness(overrides = {}) {
  const sessionState = overrides.sessionState ?? createFreshGameSessionState();
  let clockMs = overrides.clockMs ?? 1000;
  let selectedItem = overrides.selectedItem ?? { id: "axe" };
  const events = [];
  const needsRuntime = {
    canPerformPhysicalAction: () => ({ allowed: true, cost: 0.2 }),
    recordPhysicalAction: (...args) => { events.push(["physical", ...args]); },
    canStartLongAction: () => true,
  };
  const coordinator = createWorldInteractionCoordinator({
    sessionState,
    getGameplayTuning: () => DEFAULT_GAMEPLAY_TUNING,
    getSelectedItem: () => selectedItem,
    getNeedsRuntime: () => needsRuntime,
    suppressNextInteract: () => events.push(["suppress"]),
    showTransientMessage: (key) => events.push(["message", key]),
    refreshInteractions: () => events.push(["refresh"]),
    triggerCooldownFeedback: () => events.push(["cooldown-feedback"]),
    renderHud: () => events.push(["render"]),
    notifyInventoryGain: (result) => events.push(["inventory", result]),
    syncPlayerEnergyTarget: () => events.push(["sync-energy"]),
    triggerEnergyShake: () => events.push(["energy-shake"]),
    playEffect: (type) => events.push(["audio", type]),
    saveSession: () => events.push(["save"]),
    now: () => clockMs,
  });
  return {
    coordinator,
    sessionState,
    events,
    setClock: (value) => { clockMs = value; },
    setSelectedItem: (value) => { selectedItem = value; },
  };
}

const firstHandled = createHarness();
const calls = [];
firstHandled.coordinator.rebindLocationOwners({
  merchantRuntime: { handleInteraction: () => { calls.push("merchant"); return { status: "ignored" }; } },
  farmingRuntime: { handleInteraction: () => { calls.push("farming"); return { status: "harvested", mutated: true }; } },
  tavernSignRuntime: { sync: () => calls.push("tavern") },
});
assert.equal(firstHandled.coordinator.handle({ kind: TAVERN_SIGN_KIND, payload: {} }).status, "harvested");
assert.deepEqual(calls, ["merchant", "farming"], "first handled owner must complete dispatch");
assert.equal(firstHandled.sessionState.gameplay.tavernOpen, false, "later handlers must not mutate");

const rebound = createHarness();
rebound.coordinator.rebindLocationOwners({
  debrisRuntime: { getInteractionDefinitions: () => [{ id: "old" }] },
  facilityRuntime: { getInteractionDefinitions: () => [{ id: "facility" }] },
  tavernSignRuntime: { getInteractionDefinitions: () => [{ id: "sign" }] },
  farmingRuntime: { getInteractionDefinitions: () => [{ id: "farm" }] },
});
assert.deepEqual(rebound.coordinator.getStaticInteractionDefinitions().map(({ id }) => id), ["old", "facility", "sign", "farm"]);
rebound.coordinator.rebindLocationOwners({ debrisRuntime: { getInteractionDefinitions: () => [{ id: "new" }] } });
assert.deepEqual(rebound.coordinator.getStaticInteractionDefinitions().map(({ id }) => id), ["new"], "rebind must drop previous location owners");
rebound.coordinator.unbindLocationOwners();
assert.deepEqual(rebound.coordinator.getStaticInteractionDefinitions(), []);

const resource = createHarness();
const definition = RESOURCE_OBJECTS[0];
let feedbackCount = 0;
resource.coordinator.rebindLocationOwners({
  debrisRuntime: {
    getResourceDefinition: (id) => id === definition.id ? definition : null,
    hitWithFeedback: () => { feedbackCount += 1; },
  },
});
const resourceCandidate = { kind: RESOURCE_INTERACTION_KIND, payload: { resourceId: definition.id } };
resource.setSelectedItem({ id: "pickaxe" });
assert.equal(resource.coordinator.handle(resourceCandidate).status, "wrong-tool");
assert.equal(resource.sessionState.gameplay.resourceNodes[definition.id].progress, 0);
resource.setSelectedItem({ id: "axe" });
const energyBefore = resource.sessionState.gameplay.currentEnergy;
assert.equal(resource.coordinator.handle(resourceCandidate).status, "hit");
assert.equal(resource.sessionState.gameplay.currentEnergy, energyBefore - 0.2);
assert.equal(feedbackCount, 1);
assert.equal(resource.events.filter(([name]) => name === "save").length, 1);
assert.deepEqual(resource.coordinator.getResourceActivitySnapshot(), { active: true, profileId: definition.profileId, kind: "log" });
assert.equal(resource.coordinator.getResourceCooldownProgress(), 1);
assert.equal(resource.coordinator.handle(resourceCandidate).status, "cooldown");
assert.equal(resource.sessionState.gameplay.currentEnergy, energyBefore - 0.2, "cooldown must not spend energy twice");
resource.setClock(2000);
assert.deepEqual(resource.coordinator.getResourceActivitySnapshot(), { active: false, profileId: null, kind: null });
assert.equal(resource.coordinator.getResourceCooldownProgress(), 0);

const facility = createHarness();
let facilityCalls = 0;
facility.coordinator.rebindLocationOwners({
  merchantRuntime: { handleInteraction: () => ({ status: "ignored" }) },
  farmingRuntime: { handleInteraction: () => ({ status: "ignored" }) },
  facilityRuntime: { getDefinition: () => ({ facilityType: "shower" }), isUsing: () => false },
  kitchenInteractionRuntime: { handleFacility: () => ({ status: "ignored" }) },
  needsInteractionCoordinator: { useFacility: () => { facilityCalls += 1; return { status: "approaching", mutated: false }; } },
});
assert.equal(facility.coordinator.handle({ kind: FACILITY_INTERACTION_KIND, payload: { facilityId: "shower" } }).status, "approaching");
assert.equal(facilityCalls, 1);
assert.equal(facility.coordinator.handle({ kind: BED_INTERACTION_KIND, payload: { bedId: "bed" } }).status, "ignored");

console.log("Task #064 world interaction ownership and dispatch contract passed");
