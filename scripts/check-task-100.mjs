import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ageYearsForLifeDays,
  createGeneratedPopulationPerson,
  createStage1Population,
  FOOD_PREFERENCE_TAGS,
  lifeDaysForAgeYears,
  lifeStageForPersonAge,
  PERSON_GAME_DAY_SECONDS,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  PERSON_RELATIONSHIP_KINDS,
  SPENDING_CAPACITY_VALUES,
} from "../src/character/populationDomain.js";
import {
  ACCIDENT_RISK_PER_DAY,
  advancePopulationLifecycle,
  assignGeneratedPopulationNames,
  BIRTH_RATE_ANCHORS,
  birthTargetRateForPopulation,
  ensureMaturePopulation,
  ensurePopulationPartners,
  MATURE_POPULATION_TARGET,
  MIN_BIRTH_SPACING_DAYS,
  NATURAL_LIFE_MAX_DAYS,
  NATURAL_LIFE_MIN_DAYS,
  naturalLifeDaysForPerson,
} from "../src/character/populationLifecycleDomain.js";
import { createDisplayFamilyTree } from "../src/character/personFamilyTree.js";
import { COMMON_PERSON_NAMES, generatedPopulationName } from "../src/character/personNames.js";
import {
  getSimulationPopulationTestSnapshot,
  grantSimulationTestCoins,
  resetSimulationPopulationTest,
  SIMULATION_TEST_GROUPS,
} from "../src/build/simulationTestPalette.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const inverseKind = {
  [PERSON_RELATIONSHIP_KINDS.partner]: PERSON_RELATIONSHIP_KINDS.partner,
  [PERSON_RELATIONSHIP_KINDS.parent]: PERSON_RELATIONSHIP_KINDS.child,
  [PERSON_RELATIONSHIP_KINDS.child]: PERSON_RELATIONSHIP_KINDS.parent,
  [PERSON_RELATIONSHIP_KINDS.sibling]: PERSON_RELATIONSHIP_KINDS.sibling,
};

assert.equal(MATURE_POPULATION_TARGET, 300);
assert.equal(MIN_BIRTH_SPACING_DAYS, 6);
assert.equal(NATURAL_LIFE_MIN_DAYS, 98);
assert.equal(NATURAL_LIFE_MAX_DAYS, 102);
assert(Object.values(ACCIDENT_RISK_PER_DAY).every((risk) => risk > 0 && risk < 0.001));
assert.equal(COMMON_PERSON_NAMES.length, 1000);
assert.equal(new Set(COMMON_PERSON_NAMES.map((name) => name.toLowerCase())).size, 1000);
assert.deepEqual(BIRTH_RATE_ANCHORS, [
  { population: 240, birthsPerDay: 6 },
  { population: 260, birthsPerDay: 5 },
  { population: 280, birthsPerDay: 4 },
  { population: 300, birthsPerDay: 3 },
  { population: 320, birthsPerDay: 2 },
  { population: 340, birthsPerDay: 1 },
  { population: 360, birthsPerDay: 0 },
]);
assert.equal(birthTargetRateForPopulation(250), 5.5);
assert.equal(birthTargetRateForPopulation(300), 3);
assert.equal(birthTargetRateForPopulation(400), 0);
assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19, "Task #100 reuses the existing person record fields in v19");

const transitionAge = ageYearsForLifeDays(37);
const transitionStages = new Set(Array.from({ length: 80 }, (_value, index) => (
  lifeStageForPersonAge(`person-seed-${String(index + 1).padStart(3, "0")}`, transitionAge)
)));
assert(transitionStages.has(PERSON_LIFE_STAGES.teen));
assert(transitionStages.has(PERSON_LIFE_STAGES.youngAdult),
  "individual stage boundaries vary around the nominal transition by up to about one day");

const population = ensureMaturePopulation(createStage1Population(0), 0);
assert.equal(population.length, MATURE_POPULATION_TARGET);
assert.equal(population.filter((person) => person.lifeStatus === PERSON_LIFE_STATUSES.alive).length, 300);
assert.equal(new Set(population.map((person) => person.id)).size, population.length);
for (const id of ["person-mira", "person-rowan", "person-ilya", "person-zoya"]) {
  assert(population.some((person) => person.id === id), `named baseline resident survives mature seeding: ${id}`);
}
const seededPeople = population.filter((person) => person.id.startsWith("person-seed-"));
assert.equal(seededPeople.length, 284);
assert(seededPeople.every((person) => !/^Resident(?:\s|$)/i.test(person.displayName)), "generated residents receive real names");
assert.equal(new Set(seededPeople.map((person) => person.displayName.toLowerCase())).size, seededPeople.length,
  "the initial mature population receives distinct names from the 1000-name pool");
assert.equal(seededPeople[0].displayName, generatedPopulationName(seededPeople[0].id));
const legacyNamed = clone(population.slice(0, 20));
const legacyGenerated = legacyNamed.filter((person) => person.id.startsWith("person-seed-")).slice(0, 3);
for (const person of legacyGenerated) person.displayName = `Resident ${person.id.slice(-3)}`;
assert.equal(assignGeneratedPopulationNames(legacyNamed), legacyGenerated.length);
assert(legacyGenerated.every((person) => !/^Resident(?:\s|$)/i.test(person.displayName)),
  "old preview/save placeholders are deterministically renamed during normalization");

const byId = new Map(population.map((person) => [person.id, person]));
for (const person of population) {
  assert(Number.isFinite(person.ageYears));
  assert(SPENDING_CAPACITY_VALUES.includes(person.spendingCapacity));
  for (const relationship of person.relationships) {
    const related = byId.get(relationship.personId);
    assert(related, `${person.id} relationship target remains persistent`);
    const reciprocal = related.relationships.find((candidate) => candidate.personId === person.id);
    assert(reciprocal, `${person.id} relationship remains reciprocal`);
    assert.equal(reciprocal.kind, inverseKind[relationship.kind]);
  }
  for (const partner of person.relationships.filter(({ kind }) => kind === PERSON_RELATIONSHIP_KINDS.partner)) {
    assert(!person.relationships.some(({ personId, kind }) => personId === partner.personId
      && [PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child, PERSON_RELATIONSHIP_KINDS.sibling].includes(kind)));
  }
}
assert(population.some((person) => person.id.startsWith("person-seed-")
  && person.relationships.some(({ kind }) => kind === PERSON_RELATIONSHIP_KINDS.child)),
"mature seed contains generated families, not 284 unrelated tavern profiles");

const ilyaTree = createDisplayFamilyTree(population, "person-ilya");
assert.deepEqual(ilyaTree.parents.map(({ displayName, fictional }) => ({ displayName, fictional })), [
  { displayName: "Mira", fictional: false },
  { displayName: "Rowan", fictional: false },
]);
assert.equal(ilyaTree.grandparents.length, 4);
assert(ilyaTree.grandparents.some(({ fictional }) => fictional, "missing history is visibly filled for the prototype"));
assert.deepEqual(createDisplayFamilyTree(population, "person-ilya"), ilyaTree, "fictional ancestors stay deterministic");
const ilyaVisibleNodes = [...ilyaTree.grandparents, ...ilyaTree.parents, ilyaTree.focus];
assert.equal(new Set(ilyaVisibleNodes.map(({ id }) => id)).size, ilyaVisibleNodes.length,
  "each displayed family-tree box is a different person node");
assert.equal(new Set(ilyaVisibleNodes.map(({ displayName }) => displayName.toLowerCase())).size, ilyaVisibleNodes.length,
  "fictional ancestry never makes one apparent person fill multiple parent roles");
assert.notEqual(ilyaTree.grandparents[0].id, ilyaTree.grandparents[1].id);
assert.notEqual(ilyaTree.grandparents[2].id, ilyaTree.grandparents[3].id);
for (const ancestor of ilyaTree.grandparents.filter(({ fictional }) => fictional)) {
  assert(!byId.has(ancestor.id), "fictional ancestors never become population entities");
}

const oldId = "person-born-1-0-900";
const oldLimit = naturalLifeDaysForPerson(oldId);
assert(oldLimit >= NATURAL_LIFE_MIN_DAYS && oldLimit <= NATURAL_LIFE_MAX_DAYS);
const old = createGeneratedPopulationPerson({
  id: oldId,
  displayName: "Old",
  ageYears: ageYearsForLifeDays(oldLimit - 0.5),
  worldTimeSeconds: 0,
});
const oldPopulation = [old];
const oldSummary = advancePopulationLifecycle(oldPopulation, PERSON_GAME_DAY_SECONDS);
assert.equal(oldPopulation[0].lifeStatus, PERSON_LIFE_STATUSES.dead, "natural death follows the person's 98..102 day lifespan");
assert.equal(oldSummary.naturalDeaths, 1);

const protectedId = "person-born-1-0-901";
const protectedOld = createGeneratedPopulationPerson({
  id: protectedId,
  displayName: "Guest",
  ageYears: ageYearsForLifeDays(naturalLifeDaysForPerson(protectedId)),
  worldTimeSeconds: 0,
});
const protectedPopulation = [protectedOld];
advancePopulationLifecycle(protectedPopulation, PERSON_GAME_DAY_SECONDS, { protectedPersonIds: [protectedOld.id] });
assert.equal(protectedPopulation[0].lifeStatus, PERSON_LIFE_STATUSES.alive, "a physical guest is never deleted mid-visit");
advancePopulationLifecycle(protectedPopulation, 2 * PERSON_GAME_DAY_SECONDS);
assert.equal(protectedPopulation[0].lifeStatus, PERSON_LIFE_STATUSES.dead);

const activeRun = clone(population);
const hundredDays = 100 * PERSON_GAME_DAY_SECONDS;
const activeSummary = advancePopulationLifecycle(activeRun, hundredDays);
assert(activeSummary.births > 0);
assert(activeSummary.deaths > 0);
assert.equal(activeSummary.deaths, activeSummary.naturalDeaths + activeSummary.accidentalDeaths);
assert(activeSummary.aliveCount >= 275 && activeSummary.aliveCount <= 325,
  `steady population remains near 300, got ${activeSummary.aliveCount}`);
const newborns = activeRun.filter((person) => person.id.startsWith("person-born-"));
assert(newborns.length > 0);
for (const child of newborns.slice(0, 25)) {
  assert(!/^Resident(?:\s|$)/i.test(child.displayName), "new generations also use the common-name pool");
  assert(!("skills" in child) && !("talents" in child) && !("aptitudes" in child), "Task #100 does not implement skills or talents");
  assert(SPENDING_CAPACITY_VALUES.includes(child.spendingCapacity));
  for (const [level, tags] of Object.entries(FOOD_PREFERENCE_TAGS)) {
    for (const tag of tags) assert([-1, 0, 1].includes(child.foodPreferences[level][tag]));
  }
  assert.equal(child.relationships.filter(({ kind }) => kind === PERSON_RELATIONSHIP_KINDS.child).length, 2);
}
const bornTree = createDisplayFamilyTree(activeRun, newborns[0].id);
assert.equal(bornTree.parents.length, 2);
assert(bornTree.parents.every(({ fictional }) => !fictional), "real generated parents always replace presentation placeholders");

const bornDaysByPair = new Map();
const activeById = new Map(activeRun.map((person) => [person.id, person]));
for (const child of newborns) {
  const match = /^person-born-(\d+)-/.exec(child.id);
  const parents = child.relationships
    .filter(({ kind }) => kind === PERSON_RELATIONSHIP_KINDS.child)
    .map(({ personId }) => personId)
    .sort();
  if (!match || parents.length !== 2 || !parents.every((id) => activeById.has(id))) continue;
  const key = parents.join("|");
  const days = bornDaysByPair.get(key) ?? [];
  days.push(Number(match[1]));
  bornDaysByPair.set(key, days);
}
for (const days of bornDaysByPair.values()) {
  days.sort((a, b) => a - b);
  for (let index = 1; index < days.length; index += 1) {
    assert(days[index] - days[index - 1] >= MIN_BIRTH_SPACING_DAYS, "birth spacing is at least six game days per pair");
  }
}

const lowRun = clone(population);
for (const person of lowRun.slice(-60)) {
  person.ageYears = 85;
  person.lifeStage = PERSON_LIFE_STAGES.elder;
  person.lifeStatus = PERSON_LIFE_STATUSES.dead;
}
ensurePopulationPartners(lowRun);
const lowSummary = advancePopulationLifecycle(lowRun, 120 * PERSON_GAME_DAY_SECONDS);
assert(lowSummary.births > lowSummary.deaths, "aggressive births repair a population deficit");
assert(lowSummary.aliveCount >= 275 && lowSummary.aliveCount <= 330,
  `240-person deficit returns to working range, got ${lowSummary.aliveCount}`);

const fresh = createFreshGameSessionState();
assert.equal(fresh.gameplay.population.filter((person) => person.lifeStatus === PERSON_LIFE_STATUSES.alive).length, 300);
assert(fresh.gameplay.population.filter((person) => person.id.startsWith("person-seed-")).every((person) => !/^Resident/.test(person.displayName)));
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(roundTrip.status, "loaded");
assert.deepEqual(roundTrip.state.gameplay.population, fresh.gameplay.population);

const earlyDeathState = createFreshGameSessionState();
const earlyDead = earlyDeathState.gameplay.population.find((person) => person.id.startsWith("person-seed-"));
earlyDead.ageYears = 20;
earlyDead.lifeStatus = PERSON_LIFE_STATUSES.dead;
const earlyDeathRoundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(earlyDeathState));
assert.equal(earlyDeathRoundTrip.status, "loaded");
assert.equal(earlyDeathRoundTrip.state.gameplay.population.find(({ id }) => id === earlyDead.id).lifeStatus,
  PERSON_LIFE_STATUSES.dead, "an accidental early death stays dead after save/load");

const populationTestGroup = SIMULATION_TEST_GROUPS.find(({ id }) => id === "population");
assert(populationTestGroup, "TEST exposes population proof controls");
const shortRunRow = populationTestGroup.items.find(({ labelKey }) => labelKey === "build:test.population.advance");
const longRunRow = populationTestGroup.items.find(({ labelKey }) => labelKey === "build:test.population.longRun");
const dropRow = populationTestGroup.items.find(({ labelKey }) => labelKey === "build:test.population.drop");
const resetRow = populationTestGroup.items.find(({ labelKey }) => labelKey === "build:test.population.reset");
assert(shortRunRow && longRunRow && dropRow && resetRow);
const sourceBeforeSandbox = JSON.stringify({
  worldTimeSeconds: fresh.gameplay.worldTimeSeconds,
  population: fresh.gameplay.population,
  coins: fresh.gameplay.coins,
});
assert.equal(getSimulationPopulationTestSnapshot(fresh.gameplay).aliveCount, 300);
const hundredDayAction = longRunRow.quantities[0];
const sandboxRun = grantSimulationTestCoins(fresh.gameplay, hundredDayAction);
assert.equal(sandboxRun.status, "population-test-advanced");
assert.equal(sandboxRun.mutated, false);
assert(Array.isArray(sandboxRun.feedbackDeltas), "population proof exposes presentation-only count deltas");
let sandbox = getSimulationPopulationTestSnapshot(fresh.gameplay);
assert.equal(sandbox.elapsedDays, 100);
assert(sandbox.lastRun.births > 0 && sandbox.lastRun.deaths > 0);
assert.equal(sumStages(sandbox), sandbox.aliveCount, "every living sandbox resident belongs to one visible age stage");
assert.equal(JSON.stringify({
  worldTimeSeconds: fresh.gameplay.worldTimeSeconds,
  population: fresh.gameplay.population,
  coins: fresh.gameplay.coins,
}), sourceBeforeSandbox, "population proof sandbox never mutates gameplay/save state");

const dailyStates = [];
for (let index = 0; index < 12; index += 1) {
  grantSimulationTestCoins(fresh.gameplay, shortRunRow.quantities[0]);
  sandbox = getSimulationPopulationTestSnapshot(fresh.gameplay);
  dailyStates.push(`${sandbox.aliveCount}:${JSON.stringify(sandbox.stageCounts)}`);
  assert.equal(sandbox.elapsedDays, 101 + index);
  assert.equal(sumStages(sandbox), sandbox.aliveCount, `visible stage counts reconcile on sandbox day ${sandbox.elapsedDays}`);
}
assert(new Set(dailyStates).size > 1, "consecutive +1 day runs must show visible demographic movement");

grantSimulationTestCoins(fresh.gameplay, dropRow.quantities[0]);
sandbox = getSimulationPopulationTestSnapshot(fresh.gameplay);
assert.equal(sandbox.aliveCount, 240, "stress control creates the agreed 240-person proof state");
grantSimulationTestCoins(fresh.gameplay, hundredDayAction);
grantSimulationTestCoins(fresh.gameplay, shortRunRow.quantities[1]);
grantSimulationTestCoins(fresh.gameplay, shortRunRow.quantities[1]);
sandbox = getSimulationPopulationTestSnapshot(fresh.gameplay);
assert(sandbox.aliveCount >= 275 && sandbox.aliveCount <= 330,
  `TEST sandbox shows deficit recovery without waiting real hours, got ${sandbox.aliveCount}`);
assert(sandbox.events.length > 0);
grantSimulationTestCoins(fresh.gameplay, resetRow.quantities[0]);
sandbox = getSimulationPopulationTestSnapshot(fresh.gameplay);
assert.equal(sandbox.elapsedDays, 0);
assert.equal(sandbox.aliveCount, 300);
assert.equal(resetSimulationPopulationTest(fresh.gameplay).aliveCount, 300);

const inspectionSource = readFileSync(new URL("../src/character/personInspectionRuntime.js", import.meta.url), "utf8");
for (const contract of [
  "NPC_HOVER_FAMILY_MS = NPC_HOVER_EXPAND_MS * 2",
  "NPC_FAMILY_EXPAND_MS = 280",
  "familyWidth: 196",
  "createDisplayFamilyTree",
  "familyProgress",
  "common:familyTree",
]) assert(inspectionSource.includes(contract), `family inspection exposes ${contract}`);

const testFeedbackSource = readFileSync(new URL("../src/build/simulationTestFeedback.js", import.meta.url), "utf8");
for (const contract of [
  "inventory-change",
  "signedDelta",
  "FEEDBACK_MOVE_X",
  "FEEDBACK_HOLD_MS",
  "FEEDBACK_FADE_MS",
]) assert(testFeedbackSource.includes(contract), `TEST action feedback exposes ${contract}`);

console.log("Task #100 generational population, varied life, common names, proof sandbox, family tree and TEST feedback contracts OK");

function sumStages(snapshot) {
  return Object.values(snapshot.stageCounts).reduce((total, count) => total + Number(count || 0), 0);
}
