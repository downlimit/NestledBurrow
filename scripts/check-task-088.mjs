import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPersonDemandProfile,
  createStage1Population,
  evaluatePersonOffscreen,
  normalizePopulation,
  SPENDING_CAPACITY_VALUES,
} from "../src/character/populationDomain.js";
import { createFreshGameSessionState, normalizeGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";
import { getSaleProfile, getSalePrice, SALE_PROFILES } from "../src/tavern/saleProfileDomain.js";
import {
  normalizeTavernServiceState,
  recordCompletedVisit,
  sampleVisitOpportunityDelay,
} from "../src/tavern/tavernServiceDomain.js";
import {
  decideFoodVisit,
  foodMotiveFromSatiety,
  recentVisitFactor,
  scoreFoodPreference,
  selectVisitCandidate,
} from "../src/tavern/visitDemandDomain.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const perfectLemonadePreferences = {
  cuisine: { local: 1 },
  dishClass: { hot: -1, drink: 1 },
  ingredient: { potato: -1, lemon: 1 },
};
const rejectedFoodPreferences = {
  cuisine: { local: -1 },
  dishClass: { hot: -1, drink: -1 },
  ingredient: { potato: -1, lemon: -1 },
};

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.deepEqual(SPENDING_CAPACITY_VALUES, [2, 3, 4, 5, 6]);
assert.deepEqual(SALE_PROFILES["fried-potato-dish"], {
  itemId: "fried-potato-dish", price: 4, cuisine: "local", dishClass: "hot", ingredients: ["potato"],
  serviceFormats: ["assisted", "self-service"],
});
assert.deepEqual(SALE_PROFILES.lemonade, {
  itemId: "lemonade", price: 2, cuisine: "local", dishClass: "drink", ingredients: ["lemon"],
  serviceFormats: ["assisted", "takeaway", "self-service"],
});
assert.equal(getSalePrice("fried-potato-dish"), 4);
assert.equal(getSalePrice("lemonade"), 2);

const population = createStage1Population(100);
assert.equal(population.length, 16);
for (const person of population) {
  assert.deepEqual(createPersonDemandProfile(person.id), {
    spendingCapacity: person.spendingCapacity,
    foodPreferences: person.foodPreferences,
  });
  assert(SPENDING_CAPACITY_VALUES.includes(person.spendingCapacity));
  assert.deepEqual(Object.keys(person.foodPreferences), ["cuisine", "dishClass", "ingredient"]);
}
assert(new Set(population.map(({ spendingCapacity }) => spendingCapacity)).size > 1);
assert(new Set(population.map(({ foodPreferences }) => JSON.stringify(foodPreferences))).size > 1);
const evaluated = evaluatePersonOffscreen(population[0], 7_300);
assert.equal(evaluated.spendingCapacity, population[0].spendingCapacity);
assert.deepEqual(evaluated.foodPreferences, population[0].foodPreferences);
const recoveredPopulation = normalizePopulation([{ ...population[0], spendingCapacity: 999, foodPreferences: {} }], { worldTimeSeconds: 100 });
assert.deepEqual(recoveredPopulation[0], population[0]);

assert.equal(foodMotiveFromSatiety(60), 0);
assert.equal(foodMotiveFromSatiety(20), 1);
assert.equal(foodMotiveFromSatiety(40), 0.5);
assert.equal(scoreFoodPreference(perfectLemonadePreferences, getSaleProfile("lemonade")), 1);
assert.equal(scoreFoodPreference(perfectLemonadePreferences, getSaleProfile("fried-potato-dish")), 0);
assert.deepEqual(recentVisitFactor(null, 1_000), { hoursSinceLastVisit: null, recentVisitFactor: 1 });
assert.equal(recentVisitFactor({ lastCompletedVisitWorldTimeSeconds: 1_000 }, 1_000).recentVisitFactor, 0.15);
assert.equal(recentVisitFactor({ lastCompletedVisitWorldTimeSeconds: 1_000 }, 1_000 + 12 * 60 * 60).recentVisitFactor, 1);

const hungryPerson = {
  ...population[0],
  needs: { ...population[0].needs, satiety: 20 },
  spendingCapacity: 2,
  foodPreferences: perfectLemonadePreferences,
};
const noMotive = decideFoodVisit({ person: { ...hungryPerson, needs: { ...hungryPerson.needs, satiety: 60 } }, venueOffer: { foodItemIds: ["lemonade"] }, randomSource: () => 0 });
assert.equal(noMotive.reason, "no-food-motive");
assert.equal(noMotive.roll, null);
const noBudget = decideFoodVisit({
  person: hungryPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish"] },
  householdAvailableCoins: 2,
  randomSource: () => 0,
});
assert.equal(noBudget.reason, "no-household-funds");
assert.deepEqual(noBudget.affordableItemIds, []);
const visit = decideFoodVisit({
  person: hungryPerson,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  householdAvailableCoins: 2,
  worldTimeSeconds: 1_000,
  randomSource: () => 0,
});
assert.equal(visit.decision, "VISIT");
assert.deepEqual(visit.activeMenuItemIds, ["fried-potato-dish", "lemonade"]);
assert.deepEqual(visit.affordableItemIds, ["lemonade"]);
assert.deepEqual(visit.acceptableItemIds, ["lemonade"]);
assert.equal(visit.bestOfferItemId, "lemonade");
assert(visit.bestOfferFit > 0 && visit.bestOfferFit <= 1,
  "Task #102 price taste may soften a perfect food match but never hard-reject an affordable liked offer");
assert.equal(visit.visitChance, visit.bestOfferFit);
for (const key of [
  "personId", "displayName", "satiety", "foodMotive", "spendingCapacity", "activeMenuItemIds", "affordableItemIds",
  "acceptableItemIds", "bestOfferItemId", "bestOfferFit", "hoursSinceLastVisit", "recentVisitFactor",
  "visitChance", "roll", "decision", "reason",
]) assert(Object.hasOwn(visit, key), `decision exposes ${key}`);
const rejectedOffer = decideFoodVisit({
  person: { ...hungryPerson, foodPreferences: rejectedFoodPreferences },
  venueOffer: { foodItemIds: ["lemonade"] },
  randomSource: () => 0,
});
assert.deepEqual(rejectedOffer.affordableItemIds, ["lemonade"]);
assert.deepEqual(rejectedOffer.acceptableItemIds, []);
assert.equal(rejectedOffer.bestOfferFit, 0);
assert.equal(rejectedOffer.decision, "NO_VISIT");
const suppressed = decideFoodVisit({
  person: hungryPerson,
  venueOffer: { foodItemIds: ["lemonade"] },
  visitorHistory: { completedVisitCount: 1, lastCompletedVisitWorldTimeSeconds: 1_000 },
  worldTimeSeconds: 1_000,
  randomSource: () => 0.2,
});
const expectedSuppressedChance = Math.round(visit.bestOfferFit * 0.15 * 1_000_000) / 1_000_000;
assert.equal(suppressed.visitChance, expectedSuppressedChance);
assert.equal(suppressed.decision, "NO_VISIT");
assert.equal(selectVisitCandidate(population, [population[0].id], () => 0).id, population[1].id);

assert.equal(sampleVisitOpportunityDelay(() => 0), 3_000);
assert(sampleVisitOpportunityDelay(() => 0.999999) < 8_001);
const historyState = normalizeTavernServiceState({}, { population });
assert.deepEqual(historyState.visitorHistoryByPersonId, {});
assert.equal(recordCompletedVisit(historyState, hungryPerson.id, 5_000).history.completedVisitCount, 1);
assert.deepEqual(recordCompletedVisit(historyState, hungryPerson.id, 6_000).history, {
  completedVisitCount: 2,
  lastCompletedVisitWorldTimeSeconds: 6_000,
  failedAcceptedOrderCount: 0,
  lastFailedAcceptedOrderWorldTimeSeconds: null,
});

const fresh = createFreshGameSessionState();
const serialized = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(serialized.status, "loaded");
assert.deepEqual(serialized.state.gameplay.population, fresh.gameplay.population);
assert.deepEqual(serialized.state.gameplay.tavernService, fresh.gameplay.tavernService);

const v14 = clone(fresh);
v14.version = 14;
for (const person of v14.gameplay.population) {
  delete person.spendingCapacity;
  delete person.foodPreferences;
}
v14.gameplay.tavernService = {
  nextGuestId: 2,
  spawnRemainingMs: 4_500,
  guests: [
    { id: "tavern-guest-1", state: "approaching-sign", stateElapsedMs: 120, position: { x: 10, y: 20 }, itemId: "lemonade", servingTableId: null, diningTableId: null, reservationActive: false, mealCompleted: false, paid: false },
    { id: "tavern-guest-2", state: "leaving", stateElapsedMs: 80, position: { x: 30, y: 40 }, itemId: null, servingTableId: null, diningTableId: null, reservationActive: false, mealCompleted: false, paid: false },
  ],
};
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 14, state: v14 }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 19);
assert.equal(migrated.state.version, 19);
assert.equal(migrated.state.gameplay.tavernService.opportunityRemainingMs, 4_500);
assert.deepEqual(migrated.state.gameplay.tavernService.visitorHistoryByPersonId, {});
assert.equal(new Set(migrated.state.gameplay.tavernService.guests.map(({ personId }) => personId)).size, 2);
assert.deepEqual(migrated.state.gameplay.tavernService.guests.map(({ id, state }) => ({ id, state })), [
  { id: "tavern-guest-1", state: "approaching-sign" },
  { id: "tavern-guest-2", state: "leaving" },
]);
assert(migrated.state.gameplay.population.every((person) => SPENDING_CAPACITY_VALUES.includes(person.spendingCapacity)));

const corrupted = clone(fresh);
corrupted.gameplay.tavernService.visitorHistoryByPersonId = {
  [fresh.gameplay.population[0].id]: { completedVisitCount: 3, lastCompletedVisitWorldTimeSeconds: 500 },
  "unknown-person": { completedVisitCount: 99, lastCompletedVisitWorldTimeSeconds: 500 },
};
const normalized = normalizeGameSessionState(corrupted);
assert.deepEqual(Object.keys(normalized.gameplay.tavernService.visitorHistoryByPersonId), [fresh.gameplay.population[0].id]);

const guestSource = readFileSync("src/tavern/guestRuntime.js", "utf8");
assert(!guestSource.includes("updateScheduler") && !guestSource.includes("sampleGuestWave"));
assert(guestSource.includes("spawnVisit") && guestSource.includes("acceptableItemIds"));
assert(guestSource.includes("if (visit.paid) return"), "successful purchase is recorded once per live visit");
const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
for (const contract of [
  "runVisitOpportunity", "evaluatePopulationPerson", "selectVisitLead", "decideFoodVisit",
  "guestRuntime.spawnVisitGroup", "recordCompletedVisit", "decision.bestOfferItemId",
]) assert(serviceSource.includes(contract), `service runtime owns ${contract}`);
assert(!serviceSource.includes("getAvailableServingPortions"), "physical stock does not create visit opportunities");
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const method of [
  "getDemandProfilePerson", "forceVisitOpportunity", "setVisitCandidatePersonId", "setVisitDecisionRoll",
  "getLastVisitDecision", "getGuestPersonMapping", "getVisitorHistory",
]) assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);

console.log("Task #088 contracts OK");
