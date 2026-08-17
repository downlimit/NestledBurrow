import { NEED_IDS, normalizeNeedValue } from "../needs/needsDomain.js";
import { secondsOfDay } from "../session/gameClock.js";

export const STAGE1_POPULATION_SIZE = 16;
export const SPENDING_CAPACITY_VALUES = Object.freeze([2, 4, 6]);
export const FOOD_PREFERENCE_TAGS = Object.freeze({
  cuisine: Object.freeze(["local"]),
  dishClass: Object.freeze(["hot", "drink"]),
  ingredient: Object.freeze(["potato", "lemon"]),
});
export const VISIT_TIME_PERIODS = Object.freeze({
  night: "night",
  morning: "morning",
  day: "day",
  evening: "evening",
});
export const VISIT_TIME_BALANCE = Object.freeze({
  preferredCandidateWeight: 1,
  offScheduleCandidateWeight: 0.2,
});

export const PERSON_LIFE_STAGES = Object.freeze({
  newborn: "newborn",
  infant: "infant",
  toddler: "toddler",
  child: "child",
  teen: "teen",
  youngAdult: "youngAdult",
  adult: "adult",
  elder: "elder",
});

export const PERSON_LIFE_STAGE_DURATIONS_DAYS = Object.freeze({
  [PERSON_LIFE_STAGES.newborn]: 1,
  [PERSON_LIFE_STAGES.infant]: 4,
  [PERSON_LIFE_STAGES.toddler]: 5,
  [PERSON_LIFE_STAGES.child]: 11,
  [PERSON_LIFE_STAGES.teen]: 16,
  [PERSON_LIFE_STAGES.youngAdult]: 21,
  [PERSON_LIFE_STAGES.adult]: 32,
  [PERSON_LIFE_STAGES.elder]: 10,
});

export const PERSON_LIFE_TOTAL_DAYS = Object.values(PERSON_LIFE_STAGE_DURATIONS_DAYS)
  .reduce((total, days) => total + days, 0);

export const PERSON_LIFE_STATUSES = Object.freeze({
  alive: "alive",
});

export const PERSON_RELATIONSHIP_KINDS = Object.freeze({
  partner: "partner",
  parent: "parent",
  child: "child",
  sibling: "sibling",
});

const GAME_DAY_SECONDS = 24 * 60 * 60;
const PERSON_LIFE_MAX_AGE_YEARS = 85;

const LIFE_STAGE_DEFINITIONS = Object.freeze([
  Object.freeze({ id: PERSON_LIFE_STAGES.newborn, startAgeYears: 0, endAgeYears: 0.25 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.infant, startAgeYears: 0.25, endAgeYears: 1 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.toddler, startAgeYears: 1, endAgeYears: 5 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.child, startAgeYears: 5, endAgeYears: 13 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.teen, startAgeYears: 13, endAgeYears: 18 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.youngAdult, startAgeYears: 18, endAgeYears: 35 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.adult, startAgeYears: 35, endAgeYears: 65 }),
  Object.freeze({ id: PERSON_LIFE_STAGES.elder, startAgeYears: 65, endAgeYears: PERSON_LIFE_MAX_AGE_YEARS }),
]);

const STAGE1_IDENTITIES = Object.freeze([
  Object.freeze({ id: "person-mira", displayName: "Mira" }),
  Object.freeze({ id: "person-rowan", displayName: "Rowan" }),
  Object.freeze({ id: "person-ilya", displayName: "Ilya" }),
  Object.freeze({ id: "person-anya", displayName: "Anya" }),
  Object.freeze({ id: "person-tomas", displayName: "Tomas" }),
  Object.freeze({ id: "person-lida", displayName: "Lida" }),
  Object.freeze({ id: "person-pavel", displayName: "Pavel" }),
  Object.freeze({ id: "person-vera", displayName: "Vera" }),
  Object.freeze({ id: "person-niko", displayName: "Niko" }),
  Object.freeze({ id: "person-sonya", displayName: "Sonya" }),
  Object.freeze({ id: "person-emil", displayName: "Emil" }),
  Object.freeze({ id: "person-daria", displayName: "Daria" }),
  Object.freeze({ id: "person-mark", displayName: "Mark" }),
  Object.freeze({ id: "person-nina", displayName: "Nina" }),
  Object.freeze({ id: "person-lev", displayName: "Lev" }),
  Object.freeze({ id: "person-zoya", displayName: "Zoya" }),
]);

const STAGE9_AGE_YEARS = Object.freeze({
  "person-mira": 36,
  "person-rowan": 38,
  "person-ilya": 15,
  "person-anya": 31,
  "person-tomas": 33,
  "person-lida": 11,
  "person-pavel": 48,
  "person-vera": 46,
  "person-niko": 21,
  "person-sonya": 29,
  "person-emil": 30,
  "person-daria": 8,
  "person-mark": 70,
  "person-nina": 68,
  "person-lev": 24,
  "person-zoya": 22,
});

const STAGE9_RELATIONSHIP_EDGES = Object.freeze([
  Object.freeze({ first: "person-mira", second: "person-rowan", firstKind: "partner", secondKind: "partner" }),
  Object.freeze({ first: "person-mira", second: "person-ilya", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-rowan", second: "person-ilya", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-anya", second: "person-tomas", firstKind: "partner", secondKind: "partner" }),
  Object.freeze({ first: "person-anya", second: "person-lida", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-tomas", second: "person-lida", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-pavel", second: "person-vera", firstKind: "partner", secondKind: "partner" }),
  Object.freeze({ first: "person-pavel", second: "person-niko", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-vera", second: "person-niko", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-sonya", second: "person-emil", firstKind: "partner", secondKind: "partner" }),
  Object.freeze({ first: "person-sonya", second: "person-daria", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-emil", second: "person-daria", firstKind: "parent", secondKind: "child" }),
  Object.freeze({ first: "person-mark", second: "person-nina", firstKind: "partner", secondKind: "partner" }),
  Object.freeze({ first: "person-lev", second: "person-zoya", firstKind: "sibling", secondKind: "sibling" }),
]);

const STAGE1_PREFERRED_VISIT_PERIODS = Object.freeze({
  "person-mira": Object.freeze([VISIT_TIME_PERIODS.morning]),
  "person-rowan": Object.freeze([VISIT_TIME_PERIODS.morning]),
  "person-ilya": Object.freeze([VISIT_TIME_PERIODS.morning, VISIT_TIME_PERIODS.day]),
  "person-anya": Object.freeze([VISIT_TIME_PERIODS.day]),
  "person-tomas": Object.freeze([VISIT_TIME_PERIODS.day]),
  "person-lida": Object.freeze([VISIT_TIME_PERIODS.day, VISIT_TIME_PERIODS.evening]),
  "person-pavel": Object.freeze([VISIT_TIME_PERIODS.evening]),
  "person-vera": Object.freeze([VISIT_TIME_PERIODS.evening]),
  "person-niko": Object.freeze([VISIT_TIME_PERIODS.evening, VISIT_TIME_PERIODS.night]),
  "person-sonya": Object.freeze([VISIT_TIME_PERIODS.night]),
  "person-emil": Object.freeze([VISIT_TIME_PERIODS.night]),
  "person-daria": Object.freeze([VISIT_TIME_PERIODS.night, VISIT_TIME_PERIODS.morning]),
  "person-mark": Object.freeze([VISIT_TIME_PERIODS.morning, VISIT_TIME_PERIODS.evening]),
  "person-nina": Object.freeze([VISIT_TIME_PERIODS.morning, VISIT_TIME_PERIODS.evening]),
  "person-lev": Object.freeze([VISIT_TIME_PERIODS.day, VISIT_TIME_PERIODS.night]),
  "person-zoya": Object.freeze([VISIT_TIME_PERIODS.day, VISIT_TIME_PERIODS.night]),
});

export function createStage1Population(worldTimeSeconds = 0) {
  const evaluationTime = normalizeWorldTime(worldTimeSeconds, 0);
  return STAGE1_IDENTITIES.map((identity) => createStage1Person(identity, evaluationTime));
}

export function normalizePopulation(value, { worldTimeSeconds = 0 } = {}) {
  const recoveryTime = normalizeWorldTime(worldTimeSeconds, 0);
  const storedPeople = Array.isArray(value) ? value : [];
  const storedById = new Map();
  for (const person of storedPeople) {
    if (!isPlainRecord(person) || typeof person.id !== "string" || storedById.has(person.id)) continue;
    storedById.set(person.id, person);
  }
  return STAGE1_IDENTITIES.map((identity) => normalizeStage1Person(
    storedById.get(identity.id),
    identity,
    recoveryTime,
  ));
}

export function evaluatePersonOffscreen(person, targetWorldTimeSeconds) {
  const baseline = normalizeEvaluationPerson(person);
  const targetTime = normalizeWorldTime(targetWorldTimeSeconds, baseline.lastEvaluatedWorldTimeSeconds);
  const elapsed = Math.max(0, targetTime - baseline.lastEvaluatedWorldTimeSeconds);
  if (elapsed === 0) return baseline;

  const blend = 1 - Math.exp(-elapsed / (4 * 60 * 60));
  const targetHours = targetTime / (60 * 60);
  const needs = Object.fromEntries(NEED_IDS.map((needId) => {
    const anchor = 38 + stableUnit(`${baseline.id}:${needId}:anchor`) * 42;
    const amplitude = 6 + stableUnit(`${baseline.id}:${needId}:amplitude`) * 14;
    const cycleHours = 5 + stableUnit(`${baseline.id}:${needId}:cycle`) * 7;
    const phase = stableUnit(`${baseline.id}:${needId}:phase`) * Math.PI * 2;
    const target = anchor + amplitude * Math.sin(targetHours / cycleHours * Math.PI * 2 + phase);
    const reconstructed = baseline.needs[needId] + (target - baseline.needs[needId]) * blend;
    return [needId, roundNeed(normalizeNeedValue(reconstructed))];
  }));
  const ageYears = advanceLifeAgeYears(baseline.ageYears, elapsed);

  return {
    id: baseline.id,
    displayName: baseline.displayName,
    ageYears,
    lifeStage: lifeStageForAgeYears(ageYears),
    lifeStatus: baseline.lifeStatus,
    relationships: baseline.relationships,
    needs,
    spendingCapacity: baseline.spendingCapacity,
    foodPreferences: baseline.foodPreferences,
    relatedPersonIds: baseline.relatedPersonIds,
    preferredVisitPeriods: baseline.preferredVisitPeriods,
    lastEvaluatedWorldTimeSeconds: targetTime,
  };
}

export function evaluatePopulationPerson(population, personId, targetWorldTimeSeconds) {
  if (!Array.isArray(population)) return { status: "invalid-population", mutated: false, person: null };
  const index = population.findIndex((person) => person?.id === personId);
  if (index < 0) return { status: "unknown-person", mutated: false, person: null };
  const previous = population[index];
  const person = evaluatePersonOffscreen(previous, targetWorldTimeSeconds);
  const mutated = person.lastEvaluatedWorldTimeSeconds !== previous.lastEvaluatedWorldTimeSeconds
    || person.ageYears !== previous.ageYears
    || person.lifeStage !== previous.lifeStage;
  if (mutated) population[index] = person;
  return { status: mutated ? "evaluated" : "unchanged", mutated, person };
}

export function advancePersonLifecycle(person, targetWorldTimeSeconds) {
  if (!isPlainRecord(person)) return { status: "invalid-person", mutated: false, person: null };
  const targetTime = normalizeWorldTime(targetWorldTimeSeconds, person.lastEvaluatedWorldTimeSeconds ?? 0);
  const previousTime = normalizeWorldTime(person.lastEvaluatedWorldTimeSeconds, targetTime);
  const elapsed = Math.max(0, targetTime - previousTime);
  if (elapsed === 0) return { status: "unchanged", mutated: false, person };
  const fallbackProfile = createPersonLifeProfile(person.id);
  const previousAge = normalizeLifeAgeYears(person.ageYears, fallbackProfile.ageYears);
  const nextAge = advanceLifeAgeYears(previousAge, elapsed);
  const nextStage = lifeStageForAgeYears(nextAge);
  const mutated = nextAge !== previousAge || person.lifeStage !== nextStage;
  if (mutated) {
    person.ageYears = nextAge;
    person.lifeStage = nextStage;
  }
  return { status: mutated ? "advanced" : "unchanged", mutated, person };
}

export function setPopulationPersonNeed(population, personId, needId, value, worldTimeSeconds) {
  if (!Array.isArray(population)) return { status: "invalid-population", mutated: false, person: null };
  if (!NEED_IDS.includes(needId)) return { status: "invalid-need", mutated: false, person: null };
  const index = population.findIndex((person) => person?.id === personId);
  if (index < 0) return { status: "unknown-person", mutated: false, person: null };
  const numericValue = Number(value);
  const evaluationTime = Number(worldTimeSeconds);
  if (!Number.isFinite(numericValue)) return { status: "invalid-value", mutated: false, person: null };
  if (!Number.isFinite(evaluationTime) || evaluationTime < 0) {
    return { status: "invalid-world-time", mutated: false, person: null };
  }
  const previous = population[index];
  const evaluated = evaluatePersonOffscreen(previous, evaluationTime);
  const nextValue = roundNeed(normalizeNeedValue(numericValue));
  const mutated = evaluated.needs[needId] !== nextValue
    || evaluated.lastEvaluatedWorldTimeSeconds !== previous.lastEvaluatedWorldTimeSeconds
    || evaluated.ageYears !== previous.ageYears
    || evaluated.lifeStage !== previous.lifeStage;
  if (!mutated) return { status: "unchanged", mutated: false, person: previous };
  const person = {
    ...evaluated,
    needs: { ...evaluated.needs, [needId]: nextValue },
  };
  population[index] = person;
  return { status: "need-set", mutated: true, person };
}

function createStage1Person(identity, evaluationTime) {
  const demandProfile = createPersonDemandProfile(identity.id);
  const socialProfile = createPersonSocialProfile(identity.id);
  const lifeProfile = createPersonLifeProfile(identity.id);
  return {
    id: identity.id,
    displayName: identity.displayName,
    ...lifeProfile,
    needs: initialNeeds(identity.id),
    spendingCapacity: demandProfile.spendingCapacity,
    foodPreferences: demandProfile.foodPreferences,
    relatedPersonIds: socialProfile.relatedPersonIds,
    preferredVisitPeriods: socialProfile.preferredVisitPeriods,
    lastEvaluatedWorldTimeSeconds: evaluationTime,
  };
}

export function createPersonDemandProfile(personId) {
  const id = String(personId ?? "").trim();
  if (!id) throw new Error("Person demand profile requires a stable id");
  const spendingIndex = Math.min(
    SPENDING_CAPACITY_VALUES.length - 1,
    Math.floor(stableUnit(`${id}:spending-capacity`) * SPENDING_CAPACITY_VALUES.length),
  );
  return {
    spendingCapacity: SPENDING_CAPACITY_VALUES[spendingIndex],
    foodPreferences: Object.fromEntries(Object.entries(FOOD_PREFERENCE_TAGS).map(([level, tags]) => [
      level,
      Object.fromEntries(tags.map((tag) => [tag, stablePreference(`${id}:${level}:${tag}`)])),
    ])),
  };
}

export function createPersonLifeProfile(personId) {
  const id = String(personId ?? "").trim();
  if (!id) throw new Error("Person life profile requires a stable id");
  const fallbackAge = 20 + Math.floor(stableUnit(`${id}:baseline-age`) * 40);
  const ageYears = STAGE9_AGE_YEARS[id] ?? fallbackAge;
  return {
    ageYears,
    lifeStage: lifeStageForAgeYears(ageYears),
    lifeStatus: PERSON_LIFE_STATUSES.alive,
    relationships: STAGE9_RELATIONSHIP_EDGES.flatMap((edge) => {
      if (edge.first === id) return [{ personId: edge.second, kind: edge.firstKind }];
      if (edge.second === id) return [{ personId: edge.first, kind: edge.secondKind }];
      return [];
    }),
  };
}

export function lifeStageForAgeYears(ageYears) {
  const age = Number(ageYears);
  if (!Number.isFinite(age) || age < 0) throw new Error("Person age must be a non-negative finite number");
  if (age < 0.25) return PERSON_LIFE_STAGES.newborn;
  if (age < 1) return PERSON_LIFE_STAGES.infant;
  if (age < 5) return PERSON_LIFE_STAGES.toddler;
  if (age < 13) return PERSON_LIFE_STAGES.child;
  if (age < 18) return PERSON_LIFE_STAGES.teen;
  if (age < 35) return PERSON_LIFE_STAGES.youngAdult;
  if (age < 65) return PERSON_LIFE_STAGES.adult;
  return PERSON_LIFE_STAGES.elder;
}

export function advanceLifeAgeYears(ageYears, elapsedWorldTimeSeconds) {
  let age = normalizeLifeAgeYears(ageYears, 0);
  let remainingDays = Math.max(0, Number(elapsedWorldTimeSeconds) || 0) / GAME_DAY_SECONDS;
  let guard = 0;
  while (remainingDays > 0 && guard < LIFE_STAGE_DEFINITIONS.length + 1) {
    guard += 1;
    const definition = lifeStageDefinition(age);
    const durationDays = PERSON_LIFE_STAGE_DURATIONS_DAYS[definition.id];
    const ageSpan = definition.endAgeYears - definition.startAgeYears;
    if (definition.id === PERSON_LIFE_STAGES.elder && age >= definition.endAgeYears) return definition.endAgeYears;
    const progress = ageSpan > 0
      ? clamp((age - definition.startAgeYears) / ageSpan, 0, 1)
      : 1;
    const remainingStageDays = durationDays * (1 - progress);
    if (remainingDays < remainingStageDays) {
      return roundAge(age + ageSpan * (remainingDays / durationDays));
    }
    age = definition.endAgeYears;
    remainingDays -= remainingStageDays;
    if (definition.id === PERSON_LIFE_STAGES.elder) return roundAge(age);
  }
  return roundAge(Math.min(PERSON_LIFE_MAX_AGE_YEARS, age));
}

export function createPersonSocialProfile(personId) {
  const id = String(personId ?? "").trim();
  if (!id) throw new Error("Person social profile requires a stable id");
  const lifeProfile = createPersonLifeProfile(id);
  const fallbackPeriods = Object.values(VISIT_TIME_PERIODS);
  const fallbackPeriod = fallbackPeriods[Math.min(
    fallbackPeriods.length - 1,
    Math.floor(stableUnit(`${id}:preferred-visit-period`) * fallbackPeriods.length),
  )];
  return {
    relatedPersonIds: lifeProfile.relationships.map(({ personId: relatedPersonId }) => relatedPersonId),
    preferredVisitPeriods: [...(STAGE1_PREFERRED_VISIT_PERIODS[id] ?? [fallbackPeriod])],
  };
}

export function visitTimePeriod(worldTimeSeconds) {
  const hour = secondsOfDay(worldTimeSeconds) / (60 * 60);
  if (hour < 6) return VISIT_TIME_PERIODS.night;
  if (hour < 12) return VISIT_TIME_PERIODS.morning;
  if (hour < 18) return VISIT_TIME_PERIODS.day;
  return VISIT_TIME_PERIODS.evening;
}

export function visitTimeFactorForPerson(person, worldTimeSeconds) {
  const period = visitTimePeriod(worldTimeSeconds);
  const preferred = Array.isArray(person?.preferredVisitPeriods)
    && person.preferredVisitPeriods.includes(period);
  return {
    period,
    preferred,
    timeFactor: preferred
      ? VISIT_TIME_BALANCE.preferredCandidateWeight
      : VISIT_TIME_BALANCE.offScheduleCandidateWeight,
  };
}

function normalizeStage1Person(value, identity, recoveryTime) {
  const fallback = createStage1Person(identity, recoveryTime);
  if (!isPlainRecord(value)) return fallback;
  const ageYears = normalizeLifeAgeYears(value.ageYears, fallback.ageYears);
  return {
    id: identity.id,
    displayName: nonEmptyString(value.displayName) ? value.displayName.trim() : identity.displayName,
    ageYears,
    lifeStage: lifeStageForAgeYears(ageYears),
    lifeStatus: fallback.lifeStatus,
    relationships: fallback.relationships,
    needs: normalizePersonNeeds(value.needs, fallback.needs),
    spendingCapacity: normalizeSpendingCapacity(value.spendingCapacity, fallback.spendingCapacity),
    foodPreferences: normalizeFoodPreferences(value.foodPreferences, fallback.foodPreferences),
    relatedPersonIds: fallback.relatedPersonIds,
    preferredVisitPeriods: fallback.preferredVisitPeriods,
    lastEvaluatedWorldTimeSeconds: Math.min(
      recoveryTime,
      normalizeWorldTime(value.lastEvaluatedWorldTimeSeconds, recoveryTime),
    ),
  };
}

function normalizeEvaluationPerson(value) {
  if (!isPlainRecord(value) || !nonEmptyString(value.id)) throw new Error("Population person requires a stable id");
  if (!nonEmptyString(value.displayName)) throw new Error(`Population person ${value.id} requires a display name`);
  const id = value.id.trim();
  const evaluationTime = normalizeWorldTime(value.lastEvaluatedWorldTimeSeconds, 0);
  const demandProfile = createPersonDemandProfile(id);
  const socialProfile = createPersonSocialProfile(id);
  const lifeProfile = createPersonLifeProfile(id);
  const ageYears = normalizeLifeAgeYears(value.ageYears, lifeProfile.ageYears);
  return {
    id,
    displayName: value.displayName.trim(),
    ageYears,
    lifeStage: lifeStageForAgeYears(ageYears),
    lifeStatus: lifeProfile.lifeStatus,
    relationships: lifeProfile.relationships,
    needs: normalizePersonNeeds(value.needs, initialNeeds(id)),
    spendingCapacity: normalizeSpendingCapacity(value.spendingCapacity, demandProfile.spendingCapacity),
    foodPreferences: normalizeFoodPreferences(value.foodPreferences, demandProfile.foodPreferences),
    relatedPersonIds: socialProfile.relatedPersonIds,
    preferredVisitPeriods: socialProfile.preferredVisitPeriods,
    lastEvaluatedWorldTimeSeconds: evaluationTime,
  };
}

export function normalizeFoodPreferences(value, fallback = null) {
  const fallbackPreferences = fallback ?? createPersonDemandProfile("person-recovery").foodPreferences;
  const source = isPlainRecord(value) ? value : {};
  return Object.fromEntries(Object.entries(FOOD_PREFERENCE_TAGS).map(([level, tags]) => {
    const levelSource = isPlainRecord(source[level]) ? source[level] : {};
    return [level, Object.fromEntries(tags.map((tag) => {
      const preference = Number(levelSource[tag]);
      return [tag, [-1, 0, 1].includes(preference) ? preference : fallbackPreferences[level][tag]];
    }))];
  }));
}

function normalizePersonNeeds(value, fallback) {
  const source = isPlainRecord(value) ? value : {};
  return Object.fromEntries(NEED_IDS.map((needId) => [
    needId,
    roundNeed(normalizeNeedValue(source[needId], fallback[needId])),
  ]));
}

function initialNeeds(personId) {
  return Object.fromEntries(NEED_IDS.map((needId) => [
    needId,
    roundNeed((needId === "satiety" ? 18 : 55)
      + stableUnit(`${personId}:${needId}:initial`) * (needId === "satiety" ? 65 : 35)),
  ]));
}

function normalizeSpendingCapacity(value, fallback) {
  const capacity = Number(value);
  return SPENDING_CAPACITY_VALUES.includes(capacity) ? capacity : fallback;
}

function normalizeLifeAgeYears(value, fallback) {
  const age = Number(value);
  if (!Number.isFinite(age) || age < 0 || age > PERSON_LIFE_MAX_AGE_YEARS) return fallback;
  return roundAge(age);
}

function lifeStageDefinition(ageYears) {
  const age = Math.min(PERSON_LIFE_MAX_AGE_YEARS, Math.max(0, Number(ageYears) || 0));
  return LIFE_STAGE_DEFINITIONS.find((definition) => age < definition.endAgeYears)
    ?? LIFE_STAGE_DEFINITIONS[LIFE_STAGE_DEFINITIONS.length - 1];
}

function stablePreference(key) {
  return Math.min(1, Math.floor(stableUnit(key) * 3) - 1);
}

function normalizeWorldTime(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function stableUnit(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function roundAge(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function roundNeed(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
