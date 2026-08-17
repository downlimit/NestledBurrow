import assert from "node:assert/strict";
import {
  createPersonLifeProfile,
  createPersonSocialProfile,
  createStage1Population,
  evaluatePersonOffscreen,
  lifeStageForAgeYears,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  PERSON_RELATIONSHIP_KINDS,
  normalizePopulation,
} from "../src/character/populationDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const inverseKind = {
  [PERSON_RELATIONSHIP_KINDS.partner]: PERSON_RELATIONSHIP_KINDS.partner,
  [PERSON_RELATIONSHIP_KINDS.parent]: PERSON_RELATIONSHIP_KINDS.child,
  [PERSON_RELATIONSHIP_KINDS.child]: PERSON_RELATIONSHIP_KINDS.parent,
  [PERSON_RELATIONSHIP_KINDS.sibling]: PERSON_RELATIONSHIP_KINDS.sibling,
};

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.equal(lifeStageForAgeYears(0), PERSON_LIFE_STAGES.newborn);
assert.equal(lifeStageForAgeYears(0.25), PERSON_LIFE_STAGES.infant);
assert.equal(lifeStageForAgeYears(1), PERSON_LIFE_STAGES.toddler);
assert.equal(lifeStageForAgeYears(5), PERSON_LIFE_STAGES.child);
assert.equal(lifeStageForAgeYears(13), PERSON_LIFE_STAGES.teen);
assert.equal(lifeStageForAgeYears(18), PERSON_LIFE_STAGES.youngAdult);
assert.equal(lifeStageForAgeYears(35), PERSON_LIFE_STAGES.adult);
assert.equal(lifeStageForAgeYears(65), PERSON_LIFE_STAGES.elder);

const population = createStage1Population(8 * 60 * 60);
const peopleById = new Map(population.map((person) => [person.id, person]));
for (const person of population) {
  const lifeProfile = createPersonLifeProfile(person.id);
  assert.deepEqual(
    {
      ageYears: person.ageYears,
      lifeStage: person.lifeStage,
      lifeStatus: person.lifeStatus,
      relationships: person.relationships,
    },
    lifeProfile,
  );
  assert.equal(person.lifeStatus, PERSON_LIFE_STATUSES.alive);
  assert(Number.isFinite(person.ageYears) && person.ageYears >= 0);
  assert.equal(person.lifeStage, lifeStageForAgeYears(person.ageYears));
  assert.deepEqual(
    person.relatedPersonIds,
    person.relationships.map(({ personId }) => personId),
    "legacy visit grouping remains a projection of typed relationships",
  );
  assert.deepEqual(createPersonSocialProfile(person.id).relatedPersonIds, person.relatedPersonIds);
  assert.equal(new Set(person.relatedPersonIds).size, person.relatedPersonIds.length);
  for (const relationship of person.relationships) {
    assert.notEqual(relationship.personId, person.id);
    assert(Object.values(PERSON_RELATIONSHIP_KINDS).includes(relationship.kind));
    const related = peopleById.get(relationship.personId);
    assert(related, `${person.id} relationship points to a persistent person`);
    const reciprocal = related.relationships.find(({ personId }) => personId === person.id);
    assert(reciprocal, `${person.id} relationship is reciprocal`);
    assert.equal(reciprocal.kind, inverseKind[relationship.kind]);
  }
}

const mira = peopleById.get("person-mira");
const rowan = peopleById.get("person-rowan");
const ilya = peopleById.get("person-ilya");
const lev = peopleById.get("person-lev");
assert(mira.relationships.some(({ personId, kind }) => (
  personId === rowan.id && kind === PERSON_RELATIONSHIP_KINDS.partner
)));
assert(mira.relationships.some(({ personId, kind }) => (
  personId === ilya.id && kind === PERSON_RELATIONSHIP_KINDS.parent
)));
assert(ilya.relationships.some(({ personId, kind }) => (
  personId === mira.id && kind === PERSON_RELATIONSHIP_KINDS.child
)));
assert(lev.relationships.some(({ personId, kind }) => (
  personId === "person-zoya" && kind === PERSON_RELATIONSHIP_KINDS.sibling
)));

const evaluated = evaluatePersonOffscreen(mira, mira.lastEvaluatedWorldTimeSeconds + 6 * 60 * 60);
assert.deepEqual(evaluated.relationships, mira.relationships);
assert(evaluated.ageYears > mira.ageYears);
assert.equal(evaluated.lifeStage, mira.lifeStage);
assert.equal(evaluated.lifeStatus, mira.lifeStatus);

const forged = clone(population);
forged[0].ageYears = 999;
forged[0].lifeStage = PERSON_LIFE_STAGES.elder;
forged[0].lifeStatus = "deceased";
forged[0].relationships = [{ personId: "person-zoya", kind: PERSON_RELATIONSHIP_KINDS.partner }];
forged[0].relatedPersonIds = ["person-zoya"];
const normalized = normalizePopulation(forged, { worldTimeSeconds: 8 * 60 * 60 });
assert.deepEqual(
  {
    ageYears: normalized[0].ageYears,
    lifeStage: normalized[0].lifeStage,
    lifeStatus: normalized[0].lifeStatus,
    relationships: normalized[0].relationships,
    relatedPersonIds: normalized[0].relatedPersonIds,
  },
  {
    ...createPersonLifeProfile("person-mira"),
    relatedPersonIds: createPersonSocialProfile("person-mira").relatedPersonIds,
  },
  "invalid life data recovers while family identity stays canonical",
);

const fresh = createFreshGameSessionState();
const roundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(fresh));
assert.equal(roundTrip.status, "loaded");
assert.deepEqual(roundTrip.state.gameplay.population, fresh.gameplay.population);

console.log("Task #098 age baseline and typed family relationship contracts OK");
