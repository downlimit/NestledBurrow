import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStage1Population } from "../src/character/populationDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";
import { createGuestController } from "../src/tavern/guestController.js";
import { createGuestRuntime } from "../src/tavern/guestRuntime.js";
import {
  advanceTavernFeedbackTime,
  boostTavernFlowPressure,
  createNeutralTavernFeedbackState,
  evaluateVenueOpinion,
  recordAcceptedOrderFailureFeedback,
  recordCompletedVisitFeedback,
  recordOpenUnservedFeedback,
  reputationCandidateWeight,
  sampleVisitOpportunityDelay,
  setTavernFlowPressure,
  TAVERN_FEEDBACK_BALANCE,
  visitFeedbackFactors,
} from "../src/tavern/tavernFeedbackDomain.js";
import { decideFoodVisit } from "../src/tavern/visitDemandDomain.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const population = createStage1Population(100);
const person = population[0];
person.needs.satiety = 0;
person.spendingCapacity = 4;

assert.equal(SESSION_STATE_VERSION, 17);
assert.equal(SAVE_SCHEMA_VERSION, 17);

const neutral = createNeutralTavernFeedbackState(population, 100);
assert.equal(neutral.flowPressure, 0.5);
assert.equal(neutral.venueOpinionsByPersonId[person.id].score, 0);
assert.equal(neutral.reputationProfile.serviceReliability, 0);
assert(Object.values(neutral.reputationProfile.foodTagWeights).every((value) => value === 0));
assert.equal(JSON.stringify(neutral).includes("satisfaction"), false, "visit-local satisfaction is not persisted");

const neutralDecision = decideFoodVisit({
  person,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  ...visitFeedbackFactors(neutral, person.id, 100),
  randomSource: () => 0,
});
recordCompletedVisitFeedback(neutral, {
  personId: person.id,
  satisfactionTier: 5,
  itemId: "lemonade",
  worldTimeSeconds: 100,
});
const positiveDecision = decideFoodVisit({
  person,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  ...visitFeedbackFactors(neutral, person.id, 100),
  randomSource: () => 0,
});
assert(positiveDecision.visitChance > neutralDecision.visitChance, "good direct experience raises later willingness");

const failedOpinion = createNeutralTavernFeedbackState(population, 100);
recordAcceptedOrderFailureFeedback(failedOpinion, { personId: person.id, worldTimeSeconds: 100 });
assert(failedOpinion.venueOpinionsByPersonId[person.id].score < 0, "committed failure lowers personal opinion");
const failedScore = failedOpinion.venueOpinionsByPersonId[person.id].score;
const drifted = evaluateVenueOpinion(failedOpinion, person.id, 100 + 24 * 60 * 60);
assert(Math.abs(drifted.score) < Math.abs(failedScore), "personal opinion drifts gradually toward neutral with world time");

const neutralTier = createNeutralTavernFeedbackState(population, 100);
recordCompletedVisitFeedback(neutralTier, {
  personId: person.id,
  satisfactionTier: 3,
  itemId: "lemonade",
  worldTimeSeconds: 100,
});
assert.equal(neutralTier.venueOpinionsByPersonId[person.id].score, 0, "satisfaction tier 3 is opinion-neutral");

const reputation = createNeutralTavernFeedbackState(population, 100);
for (let index = 0; index < 8; index += 1) {
  recordCompletedVisitFeedback(reputation, {
    personId: person.id,
    satisfactionTier: 3,
    itemId: "lemonade",
    worldTimeSeconds: 100 + index,
  });
}
assert(reputation.reputationProfile.foodTagWeights["dishClass:drink"]
  > reputation.reputationProfile.foodTagWeights["dishClass:hot"]);
assert(reputation.reputationProfile.foodTagWeights["ingredient:lemon"]
  > reputation.reputationProfile.foodTagWeights["ingredient:potato"]);
const drinkFan = {
  foodPreferences: {
    cuisine: { local: 1 },
    dishClass: { drink: 1, hot: -1 },
    ingredient: { lemon: 1, potato: -1 },
  },
};
const potatoFan = {
  foodPreferences: {
    cuisine: { local: 1 },
    dishClass: { drink: -1, hot: 1 },
    ingredient: { lemon: -1, potato: 1 },
  },
};
assert(reputationCandidateWeight(reputation, drinkFan) > reputationCandidateWeight(reputation, potatoFan));
assert(reputationCandidateWeight(reputation, potatoFan) > 0, "mismatched candidates retain discovery chance");
const drinkBeforeRedirect = reputation.reputationProfile.foodTagWeights["dishClass:drink"];
recordCompletedVisitFeedback(reputation, {
  personId: person.id,
  satisfactionTier: 3,
  itemId: "fried-potato-dish",
  worldTimeSeconds: 200,
});
assert(reputation.reputationProfile.foodTagWeights["dishClass:drink"] > 0
  && reputation.reputationProfile.foodTagWeights["dishClass:drink"] < drinkBeforeRedirect,
"one changed sale redirects established identity progressively");
for (let index = 0; index < 24; index += 1) {
  recordCompletedVisitFeedback(reputation, {
    personId: person.id,
    satisfactionTier: 3,
    itemId: "fried-potato-dish",
    worldTimeSeconds: 201 + index,
  });
}
assert(reputation.reputationProfile.foodTagWeights["dishClass:hot"]
  > reputation.reputationProfile.foodTagWeights["dishClass:drink"]);

const flow = createNeutralTavernFeedbackState(population, 100);
const audienceBeforeFlow = clone({
  reputationProfile: flow.reputationProfile,
  venueOpinionsByPersonId: flow.venueOpinionsByPersonId,
  population,
});
const baselineDelay = sampleVisitOpportunityDelay(() => 0.5, flow.flowPressure);
setTavernFlowPressure(flow, 1);
assert(sampleVisitOpportunityDelay(() => 0.5, flow.flowPressure) < baselineDelay);
assert.deepEqual({
  reputationProfile: flow.reputationProfile,
  venueOpinionsByPersonId: flow.venueOpinionsByPersonId,
  population,
}, audienceBeforeFlow, "flow controls do not mutate audience, tastes or wealth");
assert.equal(boostTavernFlowPressure(flow, 999).flowPressure, 1, "forced spikes remain bounded");

const closure = createNeutralTavernFeedbackState(population, 0);
advanceTavernFeedbackTime(closure, {
  tavernOpen: false,
  worldTimeSeconds: TAVERN_FEEDBACK_BALANCE.closureGraceWorldSeconds + 24 * 60 * 60,
});
const closureLoss = 0.5 - closure.flowPressure;
const steppedClosure = createNeutralTavernFeedbackState(population, 0);
const closureEnd = TAVERN_FEEDBACK_BALANCE.closureGraceWorldSeconds + 24 * 60 * 60;
for (let worldTimeSeconds = 60; worldTimeSeconds <= closureEnd; worldTimeSeconds += 60) {
  advanceTavernFeedbackTime(steppedClosure, { tavernOpen: false, worldTimeSeconds });
}
assert(Math.abs(steppedClosure.flowPressure - closure.flowPressure) < 0.000001,
  "closure erosion is stable across frame-sized elapsed-time steps");
const openUnserved = createNeutralTavernFeedbackState(population, 0);
recordOpenUnservedFeedback(openUnserved, { personId: person.id, worldTimeSeconds: 0 });
const openLoss = 0.5 - openUnserved.flowPressure;
const acceptedFailure = createNeutralTavernFeedbackState(population, 0);
recordAcceptedOrderFailureFeedback(acceptedFailure, { personId: person.id, worldTimeSeconds: 0 });
const acceptedLoss = 0.5 - acceptedFailure.flowPressure;
assert(closureLoss > 0 && closureLoss < openLoss && openLoss < acceptedLoss,
  "negative feedback severity is closure < open-unserved < accepted failure");

const saved = createFreshGameSessionState();
saved.gameplay.coins = 77;
saved.gameplay.needs.satiety = 31;
saved.gameplay.venueOffer.foodItemIds = ["lemonade"];
recordCompletedVisitFeedback(saved.gameplay.tavernFeedback, {
  personId: saved.gameplay.population[0].id,
  satisfactionTier: 4,
  itemId: "lemonade",
  worldTimeSeconds: saved.gameplay.worldTimeSeconds,
});
setTavernFlowPressure(saved.gameplay.tavernFeedback, 0.83);
const reloaded = deserializeSessionEnvelope(serializeSessionEnvelope(saved));
assert.equal(reloaded.status, "loaded");
assert.deepEqual(reloaded.state.gameplay.tavernFeedback, saved.gameplay.tavernFeedback);
assert.equal(reloaded.state.gameplay.coins, 77);
assert.equal(reloaded.state.gameplay.needs.satiety, 31);
assert.deepEqual(reloaded.state.gameplay.venueOffer.foodItemIds, ["lemonade"]);

const v16 = clone(saved);
v16.version = 16;
delete v16.gameplay.tavernFeedback;
v16.gameplay.tavernService.guests = [{
  id: "tavern-guest-1",
  personId: v16.gameplay.population[0].id,
  state: "accepted-order",
  stateElapsedMs: 10,
  position: { x: 20, y: 30 },
  itemId: "lemonade",
  order: { itemId: "lemonade", status: "accepted", statusElapsedMs: 42_000 },
  acceptableItemIds: ["lemonade"],
  servingTableId: "home-serving-table-01",
  reservationActive: false,
  mealCompleted: false,
  paid: false,
}];
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 16, state: v16 }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 17);
assert.equal(migrated.state.version, 17);
assert.equal(migrated.state.gameplay.coins, 77);
assert.equal(migrated.state.gameplay.needs.satiety, 31);
assert.deepEqual(migrated.state.gameplay.venueOffer.foodItemIds, ["lemonade"]);
assert.deepEqual(migrated.state.gameplay.tavernService.guests[0].order, v16.gameplay.tavernService.guests[0].order);
assert.equal(migrated.state.gameplay.tavernFeedback.flowPressure, 0.5);
assert(Object.values(migrated.state.gameplay.tavernFeedback.venueOpinionsByPersonId)
  .every((entry) => entry.score === 0));

let openUnservedOutcome = null;
const controllers = new Map();
const actors = new Map();
const guestRuntime = createGuestRuntime({
  config: {
    signCheckMs: 10,
    signReactionMs: 10,
    orderStationWaitMs: 30,
    blockedReplanMs: 100,
    maxReplans: 2,
    arrivalRadius: 3,
    createController: createGuestController,
    points: { spawn: { x: 8, y: 8 }, sign: { x: 16, y: 8 }, exit: { x: 0, y: 8 } },
  },
  serviceState: { nextGuestId: 0, opportunityRemainingMs: 1_000, visitorHistoryByPersonId: {}, guests: [] },
  worldLayout: {
    bounds: { left: 0, top: 0, right: 80, bottom: 80 },
    cellSize: 8,
    isBlockedCell: () => false,
    isBlockedBox: () => false,
  },
  createGuest(controller, id, position) {
    controllers.set(id, controller);
    const actor = {
      id,
      footWidth: 4,
      footDepth: 2,
      lastBlockedAxes: { x: false, y: false },
      motor: { position: { ...position } },
    };
    actors.set(id, actor);
    return actor;
  },
  removeGuest(id) { controllers.delete(id); actors.delete(id); },
  getTavernOpen: () => true,
  isOrderItemActive: () => true,
  getServicePoint: () => ({ x: 32, y: 8 }),
  claimServicePlace: () => null,
  onOpenUnserved: (outcome) => { openUnservedOutcome = outcome; },
  createFeedback: () => ({ set() {}, setThought() {}, setProgress() {}, update() {}, destroy() {} }),
});
guestRuntime.spawnVisit("person-capacity-test", "lemonade", ["lemonade"]);
for (let index = 0; index < 100 && !openUnservedOutcome; index += 1) {
  guestRuntime.update(10);
  for (const [id, actor] of actors) {
    const direction = controllers.get(id).getCommand().moveDirection;
    actor.motor.position.x += direction.x * 8;
    actor.motor.position.y += direction.y * 8;
  }
}
assert.equal(openUnservedOutcome?.reason, "service-capacity-unavailable");
assert.equal(openUnservedOutcome?.personId, "person-capacity-test");

const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const feedbackSource = readFileSync("src/tavern/tavernFeedbackDomain.js", "utf8");
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
const previewSource = readFileSync("scripts/manage-task-preview.mjs", "utf8");
const architecture = readFileSync("ARCHITECTURE.md", "utf8");
const library = readFileSync("LIBRARY.md", "utf8");
for (const contract of [
  "selectReputationBiasedCandidate", "recordOpenUnservedFeedback", "recordAcceptedOrderFailureFeedback",
  "recordCompletedVisitFeedback", "visitor-turned-away-cap",
]) assert(serviceSource.includes(contract), `service runtime delegates ${contract}`);
for (const method of ["getTavernFeedback", "setTavernFlowPressure", "boostTavernFlowPressure"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}
assert(feedbackSource.includes("TAVERN_FEEDBACK_BALANCE"));
assert(previewSource.includes("RENDER_WIDTH") && previewSource.includes("RENDER_HEIGHT"),
  "managed preview smoke follows the canonical high-density renderer size");
assert(architecture.includes("tavernFeedbackDomain.js"));
assert(library.includes("src/tavern/tavernFeedbackDomain.js"));

console.log("Task #095 tavern feedback, reputation, flow and schema v17 contracts OK");
