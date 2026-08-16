import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createStage1Population,
  evaluatePersonOffscreen,
  evaluatePopulationPerson,
  normalizePopulation,
  STAGE1_POPULATION_SIZE,
} from "../src/character/populationDomain.js";
import { NEED_IDS } from "../src/needs/needsDomain.js";
import {
  createFreshGameSessionState,
  normalizeGameSessionState,
  SESSION_STATE_VERSION,
} from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertPopulation(population) {
  assert.equal(population.length, STAGE1_POPULATION_SIZE);
  assert.equal(new Set(population.map(({ id }) => id)).size, STAGE1_POPULATION_SIZE);
  for (const person of population) {
    assert.equal(typeof person.id, "string");
    assert(person.id.length > 0);
    assert.equal(typeof person.displayName, "string");
    assert(person.displayName.trim().length > 0);
    assert.deepEqual(Object.keys(person.needs), [...NEED_IDS]);
    for (const needId of NEED_IDS) {
      assert(Number.isFinite(person.needs[needId]));
      assert(person.needs[needId] >= 0 && person.needs[needId] <= 100);
    }
    assert([2, 4, 6].includes(person.spendingCapacity));
    assert.equal(typeof person.foodPreferences, "object");
    assert(Number.isFinite(person.lastEvaluatedWorldTimeSeconds));
    assert(person.lastEvaluatedWorldTimeSeconds >= 0);
  }
}

assert.equal(SESSION_STATE_VERSION, 17);
assert.equal(SAVE_SCHEMA_VERSION, 17);
assert.deepEqual(NEED_IDS, ["novelty", "energy", "satiety", "toilet", "lustre", "dialogue"]);

const fresh = createFreshGameSessionState();
assertPopulation(fresh.gameplay.population);
assert.equal(
  new Set(fresh.gameplay.population.map(({ displayName }) => displayName)).size,
  STAGE1_POPULATION_SIZE,
  "the test baseline remains recognizable during Stage 1",
);

const first = fresh.gameplay.population[0];
assert.deepEqual(
  evaluatePersonOffscreen(first, first.lastEvaluatedWorldTimeSeconds),
  first,
  "elapsed=0 preserves the exact persisted baseline",
);
const targetTime = first.lastEvaluatedWorldTimeSeconds + 6 * 60 * 60;
const evaluated = evaluatePersonOffscreen(first, targetTime);
assert.equal(evaluated.lastEvaluatedWorldTimeSeconds, targetTime);
assert(
  NEED_IDS.some((needId) => evaluated.needs[needId] !== first.needs[needId]),
  "elapsed world time changes coarse reconstructed needs",
);
assert.deepEqual(
  evaluatePersonOffscreen(evaluated, targetTime),
  evaluated,
  "re-evaluation at the persisted target cannot reroll",
);

fresh.gameplay.worldTimeSeconds = targetTime;
const gameplayBeforeEvaluation = jsonClone(fresh.gameplay);
const evaluationResult = evaluatePopulationPerson(fresh.gameplay.population, first.id, targetTime);
assert.equal(evaluationResult.status, "evaluated");
assert.deepEqual(fresh.gameplay.population[0], evaluated);
const { population: _beforePopulation, ...unrelatedBefore } = gameplayBeforeEvaluation;
const { population: _afterPopulation, ...unrelatedAfter } = jsonClone(fresh.gameplay);
assert.deepEqual(unrelatedAfter, unrelatedBefore, "population evaluation cannot mutate player, tavern or economy state");

const serialized = serializeSessionEnvelope(fresh);
const loaded = deserializeSessionEnvelope(serialized);
assert.equal(loaded.status, "loaded");
assert.deepEqual(loaded.state.gameplay.population, fresh.gameplay.population);

const v12State = jsonClone(createFreshGameSessionState());
v12State.version = 12;
delete v12State.gameplay.population;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 12, state: v12State }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 17);
assert.equal(migrated.state.version, 17);
assertPopulation(migrated.state.gameplay.population);
assert(migrated.state.gameplay.population.every((person) => (
  person.lastEvaluatedWorldTimeSeconds === migrated.state.gameplay.worldTimeSeconds
)));

const corrupted = jsonClone(createFreshGameSessionState());
const originalFirstId = corrupted.gameplay.population[0].id;
corrupted.gameplay.population = [
  {
    id: originalFirstId,
    displayName: " ",
    needs: { novelty: -25, energy: 200, satiety: "bad" },
    lastEvaluatedWorldTimeSeconds: corrupted.gameplay.worldTimeSeconds + 10_000,
  },
  { id: originalFirstId, displayName: "Duplicate", needs: {}, lastEvaluatedWorldTimeSeconds: 10 },
  { id: "unknown-person", displayName: "Unknown", needs: {}, lastEvaluatedWorldTimeSeconds: 10 },
];
const recovered = normalizeGameSessionState(corrupted);
assertPopulation(recovered.gameplay.population);
assert.equal(recovered.gameplay.population[0].displayName, "Mira");
assert.equal(recovered.gameplay.population[0].needs.novelty, 0);
assert.equal(recovered.gameplay.population[0].needs.energy, 100);
assert.equal(
  recovered.gameplay.population[0].lastEvaluatedWorldTimeSeconds,
  recovered.gameplay.worldTimeSeconds,
);

const longAbsencePopulation = createStage1Population(0);
for (const person of [...longAbsencePopulation]) {
  const result = evaluatePopulationPerson(longAbsencePopulation, person.id, 365 * 24 * 60 * 60);
  assert.equal(result.status, "evaluated");
}
assertPopulation(normalizePopulation(longAbsencePopulation));
assert(
  longAbsencePopulation.every((person) => NEED_IDS.some((needId) => person.needs[needId] > 0)),
  "a long absence never applies waking player drains until every need is zero",
);
assert(
  new Set(longAbsencePopulation.map((person) => JSON.stringify(person.needs))).size > 1,
  "deterministic person profiles preserve population variation after a long absence",
);

const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const method of ["getPopulation", "getPopulationPerson", "evaluatePopulationPerson"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}
console.log("Task #086 contracts OK");
