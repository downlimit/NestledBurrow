import assert from "node:assert/strict";
import {
  advanceLifeAgeYears,
  createStage1Population,
  evaluatePersonOffscreen,
  lifeStageForAgeYears,
  normalizePopulation,
  PERSON_LIFE_STAGE_DURATIONS_DAYS,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_TOTAL_DAYS,
} from "../src/character/populationDomain.js";
import { advanceLiveGuestNeeds } from "../src/tavern/guestIntentDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

const DAY_SECONDS = 24 * 60 * 60;
const clone = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(PERSON_LIFE_STAGE_DURATIONS_DAYS, {
  newborn: 1,
  infant: 4,
  toddler: 5,
  child: 11,
  teen: 16,
  youngAdult: 21,
  adult: 32,
  elder: 10,
});
assert.equal(PERSON_LIFE_TOTAL_DAYS, 100);
assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19, "Task #099 reuses existing persisted age/time fields");

const expectedStages = [
  [0, PERSON_LIFE_STAGES.newborn],
  [1, PERSON_LIFE_STAGES.infant],
  [5, PERSON_LIFE_STAGES.toddler],
  [10, PERSON_LIFE_STAGES.child],
  [21, PERSON_LIFE_STAGES.teen],
  [37, PERSON_LIFE_STAGES.youngAdult],
  [58, PERSON_LIFE_STAGES.adult],
  [90, PERSON_LIFE_STAGES.elder],
];
for (const [elapsedDays, expectedStage] of expectedStages) {
  const ageYears = advanceLifeAgeYears(0, elapsedDays * DAY_SECONDS);
  assert.equal(lifeStageForAgeYears(ageYears), expectedStage, `${elapsedDays} days => ${expectedStage}`);
}
assert.equal(advanceLifeAgeYears(0, 100 * DAY_SECONDS), 85);
assert.equal(advanceLifeAgeYears(0, 150 * DAY_SECONDS), 85, "elder remains alive at lifecycle cap until death is implemented");

const population = createStage1Population(0);
const lida = population.find((person) => person.id === "person-lida");
assert.equal(lida.ageYears, 11);
assert.equal(lida.lifeStage, PERSON_LIFE_STAGES.child);
const evaluated = evaluatePersonOffscreen(lida, 3 * DAY_SECONDS);
assert(evaluated.ageYears > 13);
assert.equal(evaluated.lifeStage, PERSON_LIFE_STAGES.teen);
assert.equal(evaluated.lastEvaluatedWorldTimeSeconds, 3 * DAY_SECONDS);

const live = clone(lida);
const liveResult = advanceLiveGuestNeeds(live, 1_000, { worldTimeSeconds: 3 * DAY_SECONDS });
assert.equal(liveResult.mutated, true);
assert(live.ageYears > 13);
assert.equal(live.lifeStage, PERSON_LIFE_STAGES.teen, "live guests age before their evaluation timestamp rebases");
assert.equal(live.lastEvaluatedWorldTimeSeconds, 3 * DAY_SECONDS);

const persisted = clone(population);
persisted[0].ageYears = 44.25;
persisted[0].lifeStage = PERSON_LIFE_STAGES.newborn;
const normalized = normalizePopulation(persisted, { worldTimeSeconds: 0 });
assert.equal(normalized[0].ageYears, 44.25);
assert.equal(normalized[0].lifeStage, PERSON_LIFE_STAGES.adult, "life stage derives from persisted age progress");

const fresh = createFreshGameSessionState();
fresh.gameplay.population[0].ageYears = 44.25;
fresh.gameplay.population[0].lifeStage = PERSON_LIFE_STAGES.adult;
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(roundTrip.status, "loaded");
assert.equal(roundTrip.state.gameplay.population[0].ageYears, 44.25);
assert.equal(roundTrip.state.gameplay.population[0].lifeStage, PERSON_LIFE_STAGES.adult);

const corrupt = clone(fresh);
corrupt.gameplay.population[0].ageYears = 999;
const recovered = normalizePopulation(corrupt.gameplay.population, { worldTimeSeconds: corrupt.gameplay.worldTimeSeconds });
assert.equal(recovered[0].ageYears, 36, "corrupt age falls back to Mira baseline");
assert.equal(recovered[0].lifeStage, PERSON_LIFE_STAGES.adult);

console.log("Task #099 dynamic 100-day lifecycle contracts OK");
