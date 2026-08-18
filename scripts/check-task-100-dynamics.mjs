import assert from "node:assert/strict";
import { PERSON_LIFE_STAGES } from "../src/character/populationDomain.js";
import {
  getSimulationPopulationTestSnapshot,
  grantSimulationTestCoins,
  SIMULATION_TEST_GROUPS,
} from "../src/build/simulationTestPalette.js";
import { createFreshGameSessionState } from "../src/session/gameSessionState.js";

const gameplay = createFreshGameSessionState().gameplay;
const populationGroup = SIMULATION_TEST_GROUPS.find(({ id }) => id === "population");
const advanceRow = populationGroup?.items.find(({ labelKey }) => labelKey === "build:test.population.advance");
assert(advanceRow, "population TEST exposes the short advance row");
const dayAction = advanceRow.quantities[0];
const stageIds = Object.values(PERSON_LIFE_STAGES);

let previous = getSimulationPopulationTestSnapshot(gameplay);
assert.equal(previous.elapsedDays, 0);
assert.equal(sumStages(previous), previous.aliveCount, "initial stage counts cover every living person");

const observed = [];
for (let day = 1; day <= 12; day += 1) {
  const result = grantSimulationTestCoins(gameplay, dayAction);
  assert.equal(result.status, "population-test-advanced");
  const snapshot = getSimulationPopulationTestSnapshot(gameplay);
  observed.push({
    day,
    elapsedDays: snapshot.elapsedDays,
    alive: snapshot.aliveCount,
    dead: snapshot.deadCount,
    births: snapshot.lastRun.births,
    deaths: snapshot.lastRun.deaths,
    stages: { ...snapshot.stageCounts },
  });
  assert.equal(snapshot.elapsedDays, day, `+1 day must advance sandbox day ${day}`);
  assert.equal(sumStages(snapshot), snapshot.aliveCount,
    `every living person must belong to one visible life stage on day ${day}: ${JSON.stringify(observed.at(-1))}`);
  assert.equal(snapshot.aliveCount, previous.aliveCount + snapshot.lastRun.births - snapshot.lastRun.deaths,
    `alive count must reconcile births/deaths on day ${day}: ${JSON.stringify(observed.at(-1))}`);
  previous = snapshot;
}

assert(new Set(observed.map(({ alive }) => alive)).size > 1
  || new Set(observed.map(({ stages }) => JSON.stringify(stages))).size > 1,
"twelve consecutive +1 day runs must expose some visible demographic movement");

console.log("Task #100 daily TEST dynamics OK", JSON.stringify(observed));

function sumStages(snapshot) {
  return stageIds.reduce((total, stage) => total + Number(snapshot.stageCounts?.[stage] ?? 0), 0);
}
