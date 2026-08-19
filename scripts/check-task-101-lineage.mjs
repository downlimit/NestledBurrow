import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLOODLINE_CHILD_CAP_ONE_AT,
  BLOODLINE_CHILD_CAP_TWO_AT,
  bloodlineBirthWeightForPair,
  bloodlineChildCapForPair,
  createBloodlinePressureIndex,
  createPopulationImmigrant,
  extinctSurnameRoots,
  IMMIGRANT_EXTINCT_SURNAME_CHANCE,
  IMMIGRANT_MAX_PER_DAY,
  livingSurnameDiversity,
  plannedImmigrantCount,
  SURNAME_DIVERSITY_HARD_FLOOR,
  SURNAME_DIVERSITY_INTERVENTION_START,
  SURNAME_DIVERSITY_SOFT_TARGET,
} from "../src/character/populationLineageBalance.js";
import {
  applyMarriageFamilyNames,
  personSurname,
  surnameSidesForPair,
  visualSurnamePairPenaltyDays,
} from "../src/character/personFamilyNames.js";
import {
  areOppositePersonSexes,
  assignedPersonSex,
  personSex,
  PERSON_SEXES,
} from "../src/character/personDemographics.js";
import { createDisplayFamilyTree } from "../src/character/personFamilyTree.js";

assert.equal(SURNAME_DIVERSITY_INTERVENTION_START, 105);
assert.equal(SURNAME_DIVERSITY_SOFT_TARGET, 90);
assert.equal(SURNAME_DIVERSITY_HARD_FLOOR, 75);
assert.equal(IMMIGRANT_EXTINCT_SURNAME_CHANCE, 0.95);
assert.equal(IMMIGRANT_MAX_PER_DAY, 2);

const assignedSamples = Array.from({ length: 5000 }, (_value, index) => (
  assignedPersonSex(`person-born-${index}-0-${index}`)
));
const assignedFemaleShare = assignedSamples.filter((sex) => sex === PERSON_SEXES.female).length / assignedSamples.length;
assert(assignedFemaleShare >= 0.48 && assignedFemaleShare <= 0.52,
  `deterministic newborn sex assignment stays near 50/50, got ${assignedFemaleShare}`);

const husband = makePerson("marriage-male", "Alex Smith", "alive", PERSON_SEXES.male);
const wife = makePerson("marriage-female", "Maria Gosling", "alive", PERSON_SEXES.female);
assert.deepEqual(surnameSidesForPair(husband, wife), { husband, wife });
assert(areOppositePersonSexes(husband, wife));

const sameSexA = makePerson("same-sex-a", "Alex Alpha", "alive", PERSON_SEXES.male);
const sameSexB = makePerson("same-sex-b", "Mark Beta", "alive", PERSON_SEXES.male);
addRelationship(sameSexA, sameSexB, "partner", "partner");
assert.equal(visualSurnamePairPenaltyDays(sameSexA, sameSexB), Number.POSITIVE_INFINITY,
  "same-sex candidates are never valid marriage choices");
const rejectedMarriage = applyMarriageFamilyNames(sameSexA, sameSexB);
assert.equal(rejectedMarriage.outcome, "invalid-sex-pair");
assert.equal(sameSexA.relationships.some(({ kind }) => kind === "partner"), false);
assert.equal(sameSexB.relationships.some(({ kind }) => kind === "partner"), false,
  "an invalid same-sex partner edge is removed instead of persisting");

const fictionalFocus = makePerson("fictional-focus", "Alex Root", "alive", PERSON_SEXES.male);
const fictionalTree = createDisplayFamilyTree([fictionalFocus], fictionalFocus.id);
assert(fictionalTree);
assertOppositePair(fictionalTree.parents, "fictional parents");
assertOppositePair(fictionalTree.grandparents.slice(0, 2), "first fictional grandparent pair");
assertOppositePair(fictionalTree.grandparents.slice(2, 4), "second fictional grandparent pair");

const dense = makeDenseFamily(38);
const index = createBloodlinePressureIndex(dense);
const first = dense[0];
const second = dense[1];
assert(index.relativeCount(first.id) >= BLOODLINE_CHILD_CAP_ONE_AT);
assert.equal(bloodlineChildCapForPair(first, second, index), 1,
  "very dense bloodlines should naturally cap future family size");
assert(bloodlineBirthWeightForPair(first, second, index) < 1,
  "dense bloodlines should lose birth priority");

const moderate = makeDenseFamily(BLOODLINE_CHILD_CAP_TWO_AT + 2);
const moderateIndex = createBloodlinePressureIndex(moderate);
assert(bloodlineChildCapForPair(moderate[0], moderate[1], moderateIndex) <= 2);

const sparse = [
  makePerson("sparse-a", "Aster Alpha", "alive", PERSON_SEXES.male),
  makePerson("sparse-b", "Bryn Beta", "alive", PERSON_SEXES.female),
];
const sparseIndex = createBloodlinePressureIndex(sparse);
assert.equal(bloodlineChildCapForPair(sparse[0], sparse[1], sparseIndex), 3);
assert(bloodlineBirthWeightForPair(sparse[0], sparse[1], sparseIndex) > bloodlineBirthWeightForPair(first, second, index));

const renewalPopulation = [
  ...Array.from({ length: 45 }, (_value, i) => makePerson(`living-${i}`, `Living${i} Alpha`)),
  makePerson("dead-old", "Old Rowan", "dead"),
];
assert.deepEqual(extinctSurnameRoots(renewalPopulation), ["Rowan"]);
const diversity = livingSurnameDiversity(renewalPopulation);
assert.equal(diversity.surnameCount, 1);
assert(diversity.largestSurnameShare > 0.9);
let scheduled = 0;
for (let day = 1; day <= 20; day += 1) {
  const count = plannedImmigrantCount(renewalPopulation, 3, day);
  assert(count >= 0 && count <= IMMIGRANT_MAX_PER_DAY);
  scheduled += count;
}
assert(scheduled > 0, "collapsed surname diversity should schedule newcomer replacement slots");

const healthyDiversity = uniqueSurnamePopulation(SURNAME_DIVERSITY_INTERVENTION_START + 1);
assert.equal(plannedImmigrantCount(healthyDiversity, 3, 7), 0,
  "healthy surname diversity should not schedule newcomer slots by itself");
const nearTarget = uniqueSurnamePopulation(SURNAME_DIVERSITY_SOFT_TARGET);
const nearTargetScheduled = scheduledAcrossDays(nearTarget, 40);
assert(nearTargetScheduled > 0,
  "surname renewal should already be active around the 90-surname soft target");
const belowFloor = uniqueSurnamePopulation(SURNAME_DIVERSITY_HARD_FLOOR);
const belowFloorScheduled = scheduledAcrossDays(belowFloor, 40);
assert(belowFloorScheduled > nearTargetScheduled,
  "surname renewal should strengthen further below the diversity floor");

const before = renewalPopulation.length;
const newcomer = createPopulationImmigrant(renewalPopulation, 42 * 24 * 60 * 60, 0);
assert(newcomer);
assert.equal(renewalPopulation.length, before + 1);
assert(newcomer.ageYears >= 18 && newcomer.ageYears <= 50);
assert.deepEqual(newcomer.relationships, [], "newcomers do not invent persistent parents or grandparents");
assert(personSurname(newcomer), "newcomers always arrive with a stable surname");

const populationTestSource = readFileSync(new URL("../src/build/simulationTestPalette.js", import.meta.url), "utf8");
assert(populationTestSource.includes("const arrivalIds = new Set(summary.arrivalIds ?? []);"));
assert(populationTestSource.includes(".filter((person) => !arrivalIds.has(person.id))"),
  "adult arrivals must not be mislabeled as births in the recent-event feed");

console.log("Task #101 long-run bloodline pressure, opposite-sex family pairing and surname renewal contract OK");

function assertOppositePair(pair, label) {
  assert.equal(pair.length, 2, `${label} must contain two people`);
  assert.notEqual(personSex(pair[0]), personSex(pair[1]), `${label} must contain one male and one female`);
}

function scheduledAcrossDays(population, days) {
  let total = 0;
  for (let day = 1; day <= days; day += 1) total += plannedImmigrantCount(population, 3, day);
  return total;
}

function uniqueSurnamePopulation(count) {
  return Array.from({ length: count }, (_value, index) => (
    makePerson(`unique-${count}-${index}`, `Person${index} Surname${index}`)
  ));
}

function makeDenseFamily(count) {
  const people = Array.from({ length: count }, (_value, index) => makePerson(`family-${index}`, `Family${index} Alpha`));
  const root = people[0];
  const partner = people[1];
  for (let index = 2; index < people.length; index += 1) {
    const child = people[index];
    addRelationship(root, child, "parent", "child");
    addRelationship(partner, child, "parent", "child");
  }
  return people;
}

function makePerson(id, displayName, lifeStatus = "alive", sex = null) {
  return { id, displayName, ageYears: 30, lifeStatus, sex, relationships: [], relatedPersonIds: [] };
}

function addRelationship(first, second, firstKind, secondKind) {
  first.relationships.push({ personId: second.id, kind: firstKind });
  second.relationships.push({ personId: first.id, kind: secondKind });
  first.relatedPersonIds.push(second.id);
  second.relatedPersonIds.push(first.id);
}
