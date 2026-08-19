import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  arePopulationPairCloseRelatives,
  ensureMaturePopulation,
  populationPairSoftPenaltyDays,
} from "../src/character/populationLifecycleDomain.js";
import {
  applyMarriageFamilyNames,
  canonicalFullPersonName,
  CHILD_PATERNAL_SURNAME_CHANCE,
  childFamilySurname,
  COMMON_PERSON_SURNAMES,
  explicitPersonSurname,
  familyLineBirthWeight,
  FAMILY_LINE_BIRTH_WEIGHT_MAX,
  FAMILY_LINE_BIRTH_WEIGHT_MIN,
  MARRIAGE_SURNAME_CHANCES,
  marriageSurnameOutcomeForPair,
  personGivenName,
  personSurname,
  surnameSidesForPair,
} from "../src/character/personFamilyNames.js";
import { createStage1Population } from "../src/character/populationDomain.js";
import {
  createFreshGameSessionState,
  normalizeGameSessionState,
  SESSION_STATE_VERSION,
} from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";

assert.deepEqual(MARRIAGE_SURNAME_CHANCES, {
  wifeTakesHusband: 0.85,
  keepBoth: 0.05,
  husbandTakesWife: 0.05,
  combineBoth: 0.05,
});
assert.equal(CHILD_PATERNAL_SURNAME_CHANCE, 0.9);
assert.equal(FAMILY_LINE_BIRTH_WEIGHT_MIN, 0.8);
assert.equal(FAMILY_LINE_BIRTH_WEIGHT_MAX, 1.2);
assert.equal(COMMON_PERSON_SURNAMES.length, 512);
assert.equal(new Set(COMMON_PERSON_SURNAMES.map((surname) => surname.toLowerCase())).size, 512);
assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19, "Task #101 repairs family names within the existing v19 person record");

const population = ensureMaturePopulation(createStage1Population(0), 0);
assert.equal(population.length, 300);
assert(population.every((person) => explicitPersonSurname(person)), "every mature resident persists an explicit surname");
assert(population.every((person) => canonicalFullPersonName(person).split(/\s+/u).length >= 2));

const componentById = familyComponents(population);
const componentsBySurname = new Map();
for (const person of population) {
  const surname = personSurname(person).toLowerCase();
  const components = componentsBySurname.get(surname) ?? new Set();
  components.add(componentById.get(person.id));
  componentsBySurname.set(surname, components);
}
for (const [surname, components] of componentsBySurname) {
  assert.equal(components.size, 1, `surname ${surname} must not appear in unrelated founder components`);
}

const samples = new Map();
for (let index = 0; index < 20_000 && samples.size < 4; index += 1) {
  const firstId = `pair-a-${index}`;
  const secondId = `pair-b-${index}`;
  const outcome = marriageSurnameOutcomeForPair(firstId, secondId);
  if (!samples.has(outcome)) samples.set(outcome, [firstId, secondId]);
}
assert.deepEqual([...samples.keys()].sort(), ["combine-both", "husband-takes-wife", "keep-both", "wife-takes-husband"].sort());
for (const [outcome, [firstId, secondId]] of samples) {
  const first = makePerson(firstId, "Alex Alpha");
  const second = makePerson(secondId, "Dana Beta");
  const { husband, wife } = surnameSidesForPair(first, second);
  const oldHusband = personSurname(husband);
  const oldWife = personSurname(wife);
  assert.equal(applyMarriageFamilyNames(first, second).outcome, outcome);
  if (outcome === "wife-takes-husband") {
    assert.equal(personSurname(husband), oldHusband);
    assert.equal(personSurname(wife), oldHusband);
  } else if (outcome === "keep-both") {
    assert.equal(personSurname(husband), oldHusband);
    assert.equal(personSurname(wife), oldWife);
  } else if (outcome === "husband-takes-wife") {
    assert.equal(personSurname(husband), oldWife);
    assert.equal(personSurname(wife), oldWife);
  } else {
    assert.equal(personSurname(husband), personSurname(wife));
    assert(personSurname(husband).includes("-"));
  }
}

const parentA = makePerson("parent-a", "Aster Alder");
const parentB = makePerson("parent-b", "Bryn Baker");
const { husband: father, wife: mother } = surnameSidesForPair(parentA, parentB);
let paternal = 0;
const childSamples = 5000;
for (let index = 0; index < childSamples; index += 1) {
  if (childFamilySurname(parentA, parentB, `child-${index}`) === personSurname(father)) paternal += 1;
}
assert(paternal / childSamples >= 0.88 && paternal / childSamples <= 0.92,
  `paternal surname sampling should stay near 90%, got ${paternal / childSamples}`);
assert.notEqual(personSurname(father), personSurname(mother));

const greatGrandparentGraph = lineageGraph("g", 3);
assert(arePopulationPairCloseRelatives("g-left-0", "g-right-0", greatGrandparentGraph),
  "shared great-grandparent must hard-block pairing");
const greatGreatGraph = lineageGraph("gg", 4);
assert.equal(arePopulationPairCloseRelatives("gg-left-0", "gg-right-0", greatGreatGraph), false,
  "shared great-great-grandparent is not a hard block");
assert(populationPairSoftPenaltyDays("gg-left-0", "gg-right-0", greatGreatGraph) > 0,
  "known farther ancestry still softly lowers pairing priority");
const sameSurname = new Map([
  ["same-a", makePerson("same-a", "A Same")],
  ["same-b", makePerson("same-b", "B Same")],
]);
assert(populationPairSoftPenaltyDays("same-a", "same-b", sameSurname) >= 12,
  "same-surname strangers are visually discouraged without becoming a kinship rule");

const dominant = Array.from({ length: 20 }, (_value, index) => makePerson(`alpha-${index}`, `A${index} Alpha`));
const small = Array.from({ length: 2 }, (_value, index) => makePerson(`beta-${index}`, `B${index} Beta`));
const linePopulation = [...dominant, ...small];
const dominantWeight = familyLineBirthWeight(dominant[0], dominant[1], linePopulation);
const smallWeight = familyLineBirthWeight(small[0], small[1], linePopulation);
assert(dominantWeight >= 0.8 && dominantWeight <= 1.2);
assert(smallWeight >= 0.8 && smallWeight <= 1.2);
assert(smallWeight > dominantWeight, "smaller living family lines receive a mild birth-priority advantage");

const fresh = createFreshGameSessionState();
const legacy = JSON.parse(JSON.stringify(fresh));
for (const person of legacy.gameplay.population) person.displayName = personGivenName(person);
const repaired = normalizeGameSessionState(legacy);
assert(repaired.gameplay.population.every((person) => explicitPersonSurname(person)),
  "older v19 people without surnames are repaired deterministically");
const repairedAgain = normalizeGameSessionState(JSON.parse(JSON.stringify(repaired)));
assert.deepEqual(repairedAgain.gameplay.population, repaired.gameplay.population, "surname repair is idempotent");
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(repaired));
assert.equal(roundTrip.status, "loaded");
assert.deepEqual(roundTrip.state.gameplay.population, repaired.gameplay.population, "full names survive save/load");

const inspectionSource = readFileSync(new URL("../src/character/personInspectionRuntime.js", import.meta.url), "utf8");
for (const contract of ["personSurname", "localizedFullPersonName", "fullDisplayName"]) {
  assert(inspectionSource.includes(contract), `inspection exposes surname presentation: ${contract}`);
}

console.log("Task #101 surname inheritance, kinship guard and anti-dynasty contracts OK");

function makePerson(id, displayName) {
  return { id, displayName, ageYears: 30, lifeStatus: "alive", relationships: [], relatedPersonIds: [] };
}

function lineageGraph(prefix, depth) {
  const people = new Map();
  const common = makePerson(`${prefix}-common`, "Common Root");
  people.set(common.id, common);
  for (const side of ["left", "right"]) {
    let parent = common;
    for (let level = depth - 1; level >= 0; level -= 1) {
      const person = makePerson(`${prefix}-${side}-${level}`, `${side}${level} ${side}son`);
      person.relationships.push({ personId: parent.id, kind: "child" });
      parent.relationships.push({ personId: person.id, kind: "parent" });
      person.relatedPersonIds.push(parent.id);
      parent.relatedPersonIds.push(person.id);
      people.set(person.id, person);
      parent = person;
    }
  }
  return people;
}

function familyComponents(people) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const componentById = new Map();
  let component = 0;
  for (const person of people) {
    if (componentById.has(person.id)) continue;
    const queue = [person.id];
    component += 1;
    while (queue.length > 0) {
      const id = queue.shift();
      if (componentById.has(id)) continue;
      componentById.set(id, component);
      const current = byId.get(id);
      for (const relationship of current?.relationships ?? []) {
        if (byId.has(relationship.personId) && !componentById.has(relationship.personId)) queue.push(relationship.personId);
      }
    }
  }
  return componentById;
}
