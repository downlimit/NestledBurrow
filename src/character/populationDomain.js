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

const STAGE1_SOCIAL_GROUPS = Object.freeze([
  Object.freeze(["person-mira", "person-rowan", "person-ilya"]),
  Object.freeze(["person-anya", "person-tomas", "person-lida"]),
  Object.freeze(["person-pavel", "person-vera", "person-niko"]),
  Object.freeze(["person-sonya", "person-emil", "person-daria"]),
  Object.freeze(["person-mark", "person-nina"]),
  Object.freeze(["person-lev", "person-zoya"]),
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

  return {
    id: baseline.id,
    displayName: baseline.displayName,
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
  const mutated = person.lastEvaluatedWorldTimeSeconds !== previous.lastEvaluatedWorldTimeSeconds;
  if (mutated) population[index] = person;
  return { status: mutated ? "evaluated" : "unchanged", mutated, person };
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
  const nextValue = roundNeed(normalizeNeedValue(numericValue));
  const nextEvaluationTime = evaluationTime;
  const mutated = previous?.needs?.[needId] !== nextValue
    || previous?.lastEvaluatedWorldTimeSeconds !== nextEvaluationTime;
  if (!mutated) return { status: "unchanged", mutated: false, person: previous };
  const person = {
    ...previous,
    needs: { ...previous.needs, [needId]: nextValue },
    lastEvaluatedWorldTimeSeconds: nextEvaluationTime,
  };
  population[index] = person;
  return { status: "need-set", mutated: true, person };
}

function createStage1Person(identity, evaluationTime) {
  const demandProfile = createPersonDemandProfile(identity.id);
  const socialProfile = createPersonSocialProfile(identity.id);
  return {
    id: identity.id,
    displayName: identity.displayName,
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

export function createPersonSocialProfile(personId) {
  const id = String(personId ?? "").trim();
  if (!id) throw new Error("Person social profile requires a stable id");
  const group = STAGE1_SOCIAL_GROUPS.find((candidate) => candidate.includes(id));
  const fallbackPeriods = Object.values(VISIT_TIME_PERIODS);
  const fallbackPeriod = fallbackPeriods[Math.min(
    fallbackPeriods.length - 1,
    Math.floor(stableUnit(`${id}:preferred-visit-period`) * fallbackPeriods.length),
  )];
  return {
    relatedPersonIds: group ? group.filter((relatedPersonId) => relatedPersonId !== id) : [],
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
  return {
    id: identity.id,
    displayName: nonEmptyString(value.displayName) ? value.displayName.trim() : identity.displayName,
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
  const evaluationTime = normalizeWorldTime(value.lastEvaluatedWorldTimeSeconds, 0);
  const demandProfile = createPersonDemandProfile(value.id.trim());
  const socialProfile = createPersonSocialProfile(value.id.trim());
  return {
    id: value.id.trim(),
    displayName: value.displayName.trim(),
    needs: normalizePersonNeeds(value.needs, initialNeeds(value.id.trim())),
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

function roundNeed(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
