import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  advanceHouseholdEconomy,
  householdAvailableCoins,
  householdDailyProfile,
  householdIdForPerson,
  normalizeHouseholdEconomy,
  reconcileHouseholdEconomy,
  reserveHouseholdPurchase,
  settleHouseholdPurchase,
  HOUSEHOLD_DAILY_INCOME_PER_WORKER,
  HOUSEHOLD_REFERENCE_SAVINGS,
} from "../src/character/householdEconomyDomain.js";
import {
  PERSON_GAME_DAY_SECONDS,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  SPENDING_CAPACITY_VALUES,
  SPENDING_CAPACITY_WEIGHTS,
} from "../src/character/populationDomain.js";
import {
  WEALTH_BALANCE_MAX_HOUSEHOLDS_PER_DAY,
  WEALTH_MOBILITY_CHANCE_PER_DAY,
  rebalancePopulationWealth,
  spendingCapacityIndex,
  wealthDistributionForPopulation,
} from "../src/character/populationWealthBalance.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";
import { createNeutralTavernFeedbackState } from "../src/tavern/tavernFeedbackDomain.js";
import { decideFoodVisit } from "../src/tavern/visitDemandDomain.js";
import {
  CHILD_PARENT_VISIT_CHANCE,
  TEEN_PARENT_VISIT_CHANCE,
  TEEN_PEER_VISIT_CHANCE,
  TINY_CHILD_PARENT_VISIT_CHANCE,
  buildVisitCandidateWeights,
  selectRelatedVisitCandidates,
  visitLeadFactorForPerson,
} from "../src/tavern/visitPartyDomain.js";

const alive = (id, lifeStage, spendingCapacity, relationships = [], preferredVisitPeriods = ["morning"]) => ({
  id, displayName: id, lifeStatus: PERSON_LIFE_STATUSES.alive, lifeStage, spendingCapacity,
  relationships, relatedPersonIds: relationships.map(({ personId }) => personId), preferredVisitPeriods,
  needs: { satiety: 0 },
  foodPreferences: { cuisine: { local: 1 }, dishClass: { hot: 1, drink: 1 }, ingredient: { potato: 1, lemon: 1 } },
});
const householdState = (economy, personId) => economy.households[householdIdForPerson(economy, personId)];

assert.deepEqual(HOUSEHOLD_REFERENCE_SAVINGS, [5_000, 15_000, 45_000, 120_000, 300_000]);
assert.deepEqual(HOUSEHOLD_DAILY_INCOME_PER_WORKER, [500, 1_500, 4_000, 10_000, 25_000]);
assert.deepEqual(SPENDING_CAPACITY_WEIGHTS, [22, 31, 24, 16, 7]);
assert.equal(SPENDING_CAPACITY_WEIGHTS.reduce((sum, value) => sum + value, 0), 100);
assert.equal(WEALTH_MOBILITY_CHANCE_PER_DAY, 0.035);
assert.equal(WEALTH_BALANCE_MAX_HOUSEHOLDS_PER_DAY, 4);

const a = alive("person-wallet-a", PERSON_LIFE_STAGES.adult, 4, [
  { personId: "person-wallet-b", kind: "partner" }, { personId: "person-wallet-child", kind: "parent" },
]);
const b = alive("person-wallet-b", PERSON_LIFE_STAGES.adult, 4, [
  { personId: a.id, kind: "partner" }, { personId: "person-wallet-child", kind: "parent" },
]);
const child = alive("person-wallet-child", PERSON_LIFE_STAGES.child, 4, [
  { personId: a.id, kind: "child" }, { personId: b.id, kind: "child" },
]);
const family = [a, b, child];
const economy = normalizeHouseholdEconomy(null, family, { worldTimeSeconds: 0 });
const familyId = householdIdForPerson(economy, a.id);
assert(familyId && family.every((person) => householdIdForPerson(economy, person.id) === familyId));
householdState(economy, a.id).coins = 60;
assert(reserveHouseholdPurchase(economy, family, { personId: a.id, reservationId: "first", amount: 40 }).reserved);
assert.equal(householdAvailableCoins(economy, b.id), 20);
assert.equal(reserveHouseholdPurchase(economy, family, { personId: b.id, reservationId: "second", amount: 40 }).reserved, false);
assert(settleHouseholdPurchase(economy, "first").settled);
assert.equal(householdState(economy, a.id).coins, 20);

const splitFamily = family.map((person) => ({ ...person, relationships: person.relationships.map((r) => ({ ...r })) }));
const splitEconomy = normalizeHouseholdEconomy(null, splitFamily, { worldTimeSeconds: 0 });
const beforeSplit = Object.values(splitEconomy.households).reduce((sum, state) => sum + state.coins, 0);
splitFamily.find(({ id }) => id === child.id).lifeStage = PERSON_LIFE_STAGES.youngAdult;
reconcileHouseholdEconomy(splitEconomy, splitFamily, 0);
assert.equal(Object.values(splitEconomy.households).reduce((sum, state) => sum + state.coins, 0), beforeSplit);

const shocked = alive("person-cash-shock", PERSON_LIFE_STAGES.adult, 5);
const shockedEconomy = normalizeHouseholdEconomy(null, [shocked], { worldTimeSeconds: 0 });
householdState(shockedEconomy, shocked.id).coins = 1;
advanceHouseholdEconomy(shockedEconomy, [shocked], 60 * PERSON_GAME_DAY_SECONDS);
assert.equal(shocked.spendingCapacity, 5, "cash alone never changes income class");
assert(householdAvailableCoins(shockedEconomy, shocked.id) > 1);

const diner = alive("person-wallet-diner", PERSON_LIFE_STAGES.adult, 2);
assert.equal(decideFoodVisit({ person: diner, venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] }, householdAvailableCoins: 1, randomSource: () => 0 }).reason, "no-household-funds");
const cashDecision = decideFoodVisit({ person: diner, venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] }, householdAvailableCoins: 100, randomSource: () => 0 });
assert.deepEqual(cashDecision.affordableItemIds.sort(), ["fried-potato-dish", "lemonade"].sort());

const parent = alive("person-visit-parent", PERSON_LIFE_STAGES.adult, 3, [
  { personId: "person-visit-toddler", kind: "parent" }, { personId: "person-visit-teen", kind: "parent" },
]);
const toddler = alive("person-visit-toddler", PERSON_LIFE_STAGES.toddler, 3, [{ personId: parent.id, kind: "child" }]);
const teen = alive("person-visit-teen", PERSON_LIFE_STAGES.teen, 3, [{ personId: parent.id, kind: "child" }]);
const peer = alive("person-visit-peer", PERSON_LIFE_STAGES.teen, 3);
const visitFamily = [parent, toddler, teen, peer];
const feedback = createNeutralTavernFeedbackState(visitFamily, 0);
assert.equal(visitLeadFactorForPerson(toddler), 0);
assert.equal(visitLeadFactorForPerson(teen), 0.2);
assert.equal(TINY_CHILD_PARENT_VISIT_CHANCE, 0.03);
assert.equal(CHILD_PARENT_VISIT_CHANCE, 0.3);
assert.equal(TEEN_PARENT_VISIT_CHANCE, 0.7);
assert.equal(TEEN_PEER_VISIT_CHANCE, 0.2);
assert.equal(buildVisitCandidateWeights(visitFamily, feedback, [], 8 * 60 * 60)
  .find(({ personId }) => personId === toddler.id).candidateWeight, 0);
assert(selectRelatedVisitCandidates(visitFamily, parent, [], 8 * 60 * 60, () => 0).some(({ id }) => id === toddler.id));
assert(!selectRelatedVisitCandidates(visitFamily, parent, [], 8 * 60 * 60, () => 0.5).some(({ id }) => id === toddler.id));
assert(selectRelatedVisitCandidates(visitFamily, teen, [], 8 * 60 * 60, () => 0).some(({ id }) => id === parent.id));
assert(selectRelatedVisitCandidates(visitFamily, teen, [], 8 * 60 * 60, () => 0.75).some(({ id }) => id === peer.id));

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
const fresh = createFreshGameSessionState();
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(roundTrip.status, "loaded");
assert.deepEqual(roundTrip.state.gameplay.householdEconomy, fresh.gameplay.householdEconomy);
const legacy = JSON.parse(serializeSessionEnvelope(fresh));
delete legacy.state.gameplay.householdEconomy;
assert(deserializeSessionEnvelope(JSON.stringify(legacy)).state.gameplay.householdEconomy);

const characterDoc = readFileSync("systems/character-and-needs.md", "utf8");
const tavernDoc = readFileSync("systems/tavern-service.md", "utf8");
const persistenceDoc = readFileSync("systems/persistence.md", "utf8");
for (const phrase of ["5 000", "300 000", "3.5%", "не меняет"]) assert(characterDoc.includes(phrase));
for (const phrase of ["крайне редко", "подростк", "семейного кошелька", "резервируется"]) assert(tavernDoc.toLowerCase().includes(phrase.toLowerCase()));
assert(tavernDoc.includes("10 / 30 / 80 / 200 / 500"));
assert(persistenceDoc.includes("householdEconomy"));
assert(!characterDoc.includes("после `6` игровых дней"));

const PRICES = [10, 30, 80, 200, 500];
const COUNTS = [22, 31, 24, 16, 7];
function simFamily(id, capacity) {
  const first = `person-${id}-a`, second = `person-${id}-b`, kid = `person-${id}-child`;
  return [
    alive(first, PERSON_LIFE_STAGES.adult, capacity, [{ personId: second, kind: "partner" }, { personId: kid, kind: "parent" }], ["day"]),
    alive(second, PERSON_LIFE_STAGES.adult, capacity, [{ personId: first, kind: "partner" }, { personId: kid, kind: "parent" }], ["day"]),
    alive(kid, PERSON_LIFE_STAGES.child, capacity, [{ personId: first, kind: "child" }, { personId: second, kind: "child" }], ["day"]),
  ];
}
function simPopulation() {
  const result = []; let serial = 0;
  for (let index = 0; index < COUNTS.length; index += 1) {
    for (let count = 0; count < COUNTS[index]; count += 1) result.push(...simFamily(serial++, SPENDING_CAPACITY_VALUES[index]));
  }
  return result;
}
function members(economyState, population, id) {
  const ids = new Set(Object.entries(economyState.personHouseholdIds)
    .filter(([, householdId]) => householdId === id).map(([personId]) => personId));
  return population.filter((person) => ids.has(person.id));
}
function ratios(economyState, population) {
  return Object.entries(economyState.households).map(([id, state]) => (
    state.coins / householdDailyProfile(members(economyState, population, id)).reserveTarget
  ));
}
function percentile(values, fraction) {
  const sorted = [...values].sort((x, y) => x - y);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
function stableUnit(key) {
  let hash = 2166136261;
  for (const character of String(key)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0) / 0xffffffff;
}
for (let index = 0; index < 5; index += 1) {
  const profile = householdDailyProfile(simFamily(`scale-${index}`, SPENDING_CAPACITY_VALUES[index]));
  assert.equal(profile.income, HOUSEHOLD_DAILY_INCOME_PER_WORKER[index] * 2);
  assert.equal(profile.reserveTarget, HOUSEHOLD_REFERENCE_SAVINGS[index]);
  assert.equal(PRICES[index] / profile.income, 0.01);
}

const backgroundPopulation = simPopulation();
const backgroundEconomy = normalizeHouseholdEconomy(null, backgroundPopulation, { worldTimeSeconds: 0 });
advanceHouseholdEconomy(backgroundEconomy, backgroundPopulation, 10_000 * PERSON_GAME_DAY_SECONDS);
const backgroundRatios = ratios(backgroundEconomy, backgroundPopulation);
assert(percentile(backgroundRatios, 0.05) > 0.65);
assert(percentile(backgroundRatios, 0.5) > 0.85 && percentile(backgroundRatios, 0.5) < 1.45);
assert(percentile(backgroundRatios, 0.95) < 1.7);

const careerPopulation = [];
let careerSerial = 0;
for (let index = 0; index < COUNTS.length; index += 1) {
  for (let count = 0; count < COUNTS[index]; count += 1) {
    careerPopulation.push(alive(`person-career-long-${careerSerial++}`, PERSON_LIFE_STAGES.adult, SPENDING_CAPACITY_VALUES[index], [], ["day"]));
  }
}
for (let day = 1; day <= 5_000; day += 1) rebalancePopulationWealth(careerPopulation, day);
const careerDistribution = wealthDistributionForPopulation(careerPopulation);
for (let index = 0; index < 5; index += 1) {
  assert(Math.abs(careerDistribution.shares[index] - careerDistribution.targetShares[index]) <= 0.06);
}

const diningPopulation = simPopulation();
const diningEconomy = normalizeHouseholdEconomy(null, diningPopulation, { worldTimeSeconds: 0 });
let purchases = 0;
let revenue = 0;
for (let blockStart = 1; blockStart <= 10_000; blockStart += 30) {
  const blockEnd = Math.min(10_000, blockStart + 29);
  advanceHouseholdEconomy(diningEconomy, diningPopulation, blockEnd * PERSON_GAME_DAY_SECONDS);
  for (const [id, state] of Object.entries(diningEconomy.households)) {
    const payer = members(diningEconomy, diningPopulation, id).find((person) => person.lifeStage === PERSON_LIFE_STAGES.adult);
    if (!payer) continue;
    const classIndex = spendingCapacityIndex(payer.spendingCapacity);
    let spend = 0;
    for (let day = blockStart; day <= blockEnd; day += 1) {
      if (stableUnit(`${id}:dining:${day}`) >= 0.08) continue;
      let priceIndex = classIndex;
      const splurge = stableUnit(`${id}:splurge:${day}`);
      if (splurge < 0.02) priceIndex = Math.min(4, classIndex + 1);
      else if (splurge > 0.9) priceIndex = Math.max(0, classIndex - 1);
      const price = PRICES[priceIndex];
      if (state.coins - spend < price) continue;
      spend += price; purchases += 1; revenue += price;
    }
    state.coins = Math.max(0, state.coins - spend);
  }
}
const diningRatios = ratios(diningEconomy, diningPopulation);
assert(purchases > 50_000);
assert(percentile(diningRatios, 0.05) > 0.6);
assert(percentile(diningRatios, 0.5) > 0.8 && percentile(diningRatios, 0.5) < 1.45);
assert(percentile(diningRatios, 0.95) < 1.7);

const poor = simFamily("recovery-poor", 2), rich = simFamily("recovery-rich", 6);
const poorEconomy = normalizeHouseholdEconomy(null, poor, { worldTimeSeconds: 0 });
const richEconomy = normalizeHouseholdEconomy(null, rich, { worldTimeSeconds: 0 });
const poorTarget = householdDailyProfile(poor).reserveTarget, richTarget = householdDailyProfile(rich).reserveTarget;
householdState(poorEconomy, poor[0].id).coins = poorTarget - 1_000;
householdState(richEconomy, rich[0].id).coins = richTarget - 1_000;
advanceHouseholdEconomy(poorEconomy, poor, PERSON_GAME_DAY_SECONDS);
advanceHouseholdEconomy(richEconomy, rich, PERSON_GAME_DAY_SECONDS);
const poorGain = householdAvailableCoins(poorEconomy, poor[0].id) - (poorTarget - 1_000);
const richGain = householdAvailableCoins(richEconomy, rich[0].id) - (richTarget - 1_000);
assert(richGain > poorGain * 5);

console.log(JSON.stringify({
  task: 103,
  referenceDishPrices: PRICES,
  referenceSavings: HOUSEHOLD_REFERENCE_SAVINGS,
  twoWorkerDailyIncome: HOUSEHOLD_DAILY_INCOME_PER_WORKER.map((value) => value * 2),
  background: [0.05, 0.5, 0.95].map((p) => Number(percentile(backgroundRatios, p).toFixed(3))),
  dining: [0.05, 0.5, 0.95].map((p) => Number(percentile(diningRatios, p).toFixed(3))),
  purchases,
  revenue,
  careerShares: careerDistribution.shares.map((value) => Number(value.toFixed(3))),
}, null, 2));
console.log("Task #103 household economy and age-aware visit contracts OK");