import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createPersonSocialProfile,
  createStage1Population,
  VISIT_TIME_BALANCE,
  visitTimeFactorForPerson,
  visitTimePeriod,
} from "../src/character/populationDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";
import {
  createNeutralTavernFeedbackState,
  recordCompletedVisitFeedback,
} from "../src/tavern/tavernFeedbackDomain.js";
import {
  GUEST_ACTIVE_CAP,
  hasCapacityForVisitGroup,
  normalizeTavernServiceState,
  recordCompletedVisit,
} from "../src/tavern/tavernServiceDomain.js";
import { decideFoodVisit } from "../src/tavern/visitDemandDomain.js";
import {
  buildVisitCandidateWeights,
  describeVisitCandidate,
  selectRelatedVisitCandidates,
  selectVisitLead,
  VISIT_GROUP_MAX_SIZE,
} from "../src/tavern/visitPartyDomain.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const population = createStage1Population(6 * 60 * 60);

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.equal(GUEST_ACTIVE_CAP, 6);
assert.equal(VISIT_GROUP_MAX_SIZE, 3);
assert.equal(VISIT_TIME_BALANCE.offScheduleCandidateWeight > 0, true);

for (const person of population) {
  assert.deepEqual(createPersonSocialProfile(person.id), {
    relatedPersonIds: person.relatedPersonIds,
    preferredVisitPeriods: person.preferredVisitPeriods,
  });
  assert(person.relatedPersonIds.length >= 1 && person.relatedPersonIds.length <= 2);
  assert(person.preferredVisitPeriods.length >= 1);
  for (const relatedPersonId of person.relatedPersonIds) {
    const related = population.find((candidate) => candidate.id === relatedPersonId);
    assert(related, `${person.id} relationship points to a persistent person`);
    assert(related.relatedPersonIds.includes(person.id), `${person.id} relationship is reciprocal`);
  }
}

assert.equal(visitTimePeriod(0), "night");
assert.equal(visitTimePeriod(6 * 60 * 60), "morning");
assert.equal(visitTimePeriod(12 * 60 * 60), "day");
assert.equal(visitTimePeriod(18 * 60 * 60), "evening");
assert.equal(visitTimePeriod(24 * 60 * 60), "night");

const mira = population.find(({ id }) => id === "person-mira");
const neutralFeedback = createNeutralTavernFeedbackState(population, 0);
const morningMira = describeVisitCandidate(mira, neutralFeedback, 8 * 60 * 60);
const eveningMira = describeVisitCandidate(mira, neutralFeedback, 20 * 60 * 60);
assert.equal(morningMira.preferredTime, true);
assert.equal(eveningMira.preferredTime, false);
assert(morningMira.timeFactor > eveningMira.timeFactor);
assert(eveningMira.timeFactor > 0, "off-schedule population keeps a positive candidate weight");
assert.equal(morningMira.reputationFactor, eveningMira.reputationFactor,
  "time does not replace Stage 6 reputation weighting");
assert(morningMira.candidateWeight > eveningMira.candidateWeight);

const morningWeights = buildVisitCandidateWeights(population, neutralFeedback, [], 8 * 60 * 60);
const eveningWeights = buildVisitCandidateWeights(population, neutralFeedback, [], 20 * 60 * 60);
assert.notEqual(
  morningWeights.find(({ personId }) => personId === mira.id).timeFactor,
  eveningWeights.find(({ personId }) => personId === mira.id).timeFactor,
  "same population state receives different schedule weights at another time of day",
);
const morningLead = selectVisitLead(population, neutralFeedback, [], 8 * 60 * 60, () => 0.35);
const repeatedMorningLead = selectVisitLead(population, neutralFeedback, [], 8 * 60 * 60, () => 0.35);
assert.equal(morningLead.person.id, repeatedMorningLead.person.id);
assert.deepEqual(morningLead.candidateWeights, repeatedMorningLead.candidateWeights);

const ilya = population.find(({ id }) => id === "person-ilya");
assert.deepEqual(
  selectRelatedVisitCandidates(population, ilya, [], 8 * 60 * 60).map(({ id }) => id),
  ["person-mira", "person-rowan"],
  "linked people who prefer the current period may join the same group",
);
assert.deepEqual(
  selectRelatedVisitCandidates(population, ilya, [], 14 * 60 * 60),
  [],
  "linked off-schedule people and unrelated on-schedule people are not mixed in",
);
assert.deepEqual(
  selectRelatedVisitCandidates(population, ilya, ["person-mira"], 8 * 60 * 60).map(({ id }) => id),
  ["person-rowan"],
  "a person with an active visit cannot join another group",
);

const lemonadePreferences = {
  cuisine: { local: 1 },
  dishClass: { hot: -1, drink: 1 },
  ingredient: { potato: -1, lemon: 1 },
};
const potatoPreferences = {
  cuisine: { local: 1 },
  dishClass: { hot: 1, drink: -1 },
  ingredient: { potato: 1, lemon: -1 },
};
const lemonadeGuest = {
  ...mira,
  needs: { ...mira.needs, satiety: 0 },
  spendingCapacity: 2,
  foodPreferences: lemonadePreferences,
};
const potatoGuest = {
  ...population.find(({ id }) => id === "person-rowan"),
  needs: { ...population.find(({ id }) => id === "person-rowan").needs, satiety: 0 },
  spendingCapacity: 4,
  foodPreferences: potatoPreferences,
};
const lemonadeDecision = decideFoodVisit({
  person: lemonadeGuest,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
const potatoDecision = decideFoodVisit({
  person: potatoGuest,
  venueOffer: { foodItemIds: ["fried-potato-dish", "lemonade"] },
  randomSource: () => 0,
});
assert.equal(lemonadeDecision.decision, "VISIT");
assert.equal(potatoDecision.decision, "VISIT");
assert.equal(lemonadeDecision.bestOfferItemId, "lemonade");
assert.equal(potatoDecision.bestOfferItemId, "fried-potato-dish");

assert.equal(hasCapacityForVisitGroup(5, 2), false,
  "two agreeing visitors cannot partially consume one remaining live slot");
assert.equal(hasCapacityForVisitGroup(4, 2), true);

const service = normalizeTavernServiceState({}, { population });
recordCompletedVisit(service, mira.id, 100);
recordCompletedVisit(service, potatoGuest.id, 200);
assert.equal(service.visitorHistoryByPersonId[mira.id].completedVisitCount, 1);
assert.equal(service.visitorHistoryByPersonId[potatoGuest.id].completedVisitCount, 1);
const feedback = createNeutralTavernFeedbackState(population, 0);
recordCompletedVisitFeedback(feedback, {
  personId: mira.id,
  satisfactionTier: 5,
  itemId: "lemonade",
  worldTimeSeconds: 100,
});
recordCompletedVisitFeedback(feedback, {
  personId: potatoGuest.id,
  satisfactionTier: 2,
  itemId: "fried-potato-dish",
  worldTimeSeconds: 200,
});
assert(feedback.venueOpinionsByPersonId[mira.id].score > 0);
assert(feedback.venueOpinionsByPersonId[potatoGuest.id].score < 0);
assert.equal(feedback.venueOpinionsByPersonId[mira.id].completedVisitCount, 1);
assert.equal(feedback.venueOpinionsByPersonId[potatoGuest.id].completedVisitCount, 1);

const fresh = createFreshGameSessionState();
assert.equal(fresh.gameplay.social, undefined, "groups add no new global social state");
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(roundTrip.status, "loaded");
assert.deepEqual(roundTrip.state.gameplay.population, fresh.gameplay.population);
const v17 = clone(fresh);
v17.version = 17;
for (const person of v17.gameplay.population) {
  person.relatedPersonIds = ["person-forged"];
  delete person.preferredVisitPeriods;
}
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 17, state: v17 }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 19);
assert.equal(migrated.state.version, 19);
for (const person of migrated.state.gameplay.population) {
  assert.deepEqual(person.relatedPersonIds, createPersonSocialProfile(person.id).relatedPersonIds);
  assert.deepEqual(person.preferredVisitPeriods, createPersonSocialProfile(person.id).preferredVisitPeriods);
}

const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const contract of [
  "selectVisitLead", "selectRelatedVisitCandidates", "hasCapacityForVisitGroup",
  "spawnVisitGroup", "recordOpenUnservedFeedback", "rollsByPersonId",
]) assert(serviceSource.includes(contract), `service runtime delegates ${contract}`);
for (const method of ["getDemandProfilePerson", "forceVisitOpportunity", "getLastVisitGroup"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}

console.log("Task #096 relationships, time profiles, group visits and current schema contracts OK");
