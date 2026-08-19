import {
  createGeneratedPopulationPerson,
  isLivingPopulationPerson,
} from "./populationDomain.js";
import {
  COMMON_PERSON_SURNAMES,
  personSurnameComponents,
  withPersonSurname,
} from "./personFamilyNames.js";
import { generatedPopulationName } from "./personNames.js";

export const BLOODLINE_ANCESTOR_DEPTH = 3;
export const BLOODLINE_DESCENDANT_DEPTH = 3;
export const BLOODLINE_CHILD_CAP_TWO_AT = 18;
export const BLOODLINE_CHILD_CAP_ONE_AT = 30;
export const SURNAME_DIVERSITY_SOFT_TARGET = 90;
export const SURNAME_DIVERSITY_HARD_FLOOR = 50;
export const IMMIGRANT_EXTINCT_SURNAME_CHANCE = 0.8;
export const IMMIGRANT_MAX_PER_DAY = 2;
export const DOMINANT_SURNAME_SHARE_START = 0.07;
export const DOMINANT_SURNAME_SHARE_FULL = 0.18;

export function createBloodlinePressureIndex(population) {
  const people = Array.isArray(population) ? population : [];
  const byId = new Map(people.filter((person) => person?.id).map((person) => [person.id, person]));
  const livingIds = new Set(people.filter(isLivingPopulationPerson).map((person) => person.id));
  const cache = new Map();
  return Object.freeze({
    relativeCount(personId) {
      if (cache.has(personId)) return cache.get(personId);
      const count = livingBloodRelativeCount(personId, byId, livingIds);
      cache.set(personId, count);
      return count;
    },
  });
}

export function bloodlineBirthWeightForPair(first, second, index) {
  if (!first?.id || !second?.id || !index?.relativeCount) return 1;
  const density = (index.relativeCount(first.id) + index.relativeCount(second.id)) / 2;
  const weight = 1.15 - Math.max(0, density - 8) * 0.025;
  return clamp(weight, 0.4, 1.15);
}

export function bloodlineChildCapForPair(first, second, index) {
  if (!first?.id || !second?.id || !index?.relativeCount) return 3;
  const density = (index.relativeCount(first.id) + index.relativeCount(second.id)) / 2;
  if (density >= BLOODLINE_CHILD_CAP_ONE_AT) return 1;
  if (density >= BLOODLINE_CHILD_CAP_TWO_AT) return 2;
  return 3;
}

export function livingSurnameDiversity(population) {
  const living = (Array.isArray(population) ? population : []).filter(isLivingPopulationPerson);
  const rootCounts = new Map();
  const surnameCounts = new Map();
  for (const person of living) {
    const surname = personSurnameComponents(person).join("-");
    if (surname) surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
    for (const root of new Set(personSurnameComponents(person).map(normalizedKey))) {
      if (root) rootCounts.set(root, (rootCounts.get(root) ?? 0) + 1);
    }
  }
  const largestSurnameCount = Math.max(0, ...surnameCounts.values());
  return {
    living: living.length,
    surnameCount: surnameCounts.size,
    rootCount: rootCounts.size,
    largestSurnameCount,
    largestSurnameShare: living.length > 0 ? largestSurnameCount / living.length : 0,
  };
}

export function plannedImmigrantCount(population, requestedAdditions, dayIndex) {
  const slots = Math.max(0, Math.floor(Number(requestedAdditions) || 0));
  if (slots <= 0) return 0;
  const stats = livingSurnameDiversity(population);
  const diversityPressure = clamp(
    (SURNAME_DIVERSITY_SOFT_TARGET - stats.rootCount)
      / (SURNAME_DIVERSITY_SOFT_TARGET - SURNAME_DIVERSITY_HARD_FLOOR),
    0,
    1,
  );
  const dominancePressure = clamp(
    (stats.largestSurnameShare - DOMINANT_SURNAME_SHARE_START)
      / (DOMINANT_SURNAME_SHARE_FULL - DOMINANT_SURNAME_SHARE_START),
    0,
    1,
  );
  const pressure = Math.max(diversityPressure, dominancePressure);
  if (pressure <= 0) return 0;
  const expected = 0.15 + pressure * 1.2;
  let count = Math.floor(expected);
  if (stableUnit(`immigration-count:${dayIndex}`) < expected - count) count += 1;
  return Math.min(slots, IMMIGRANT_MAX_PER_DAY, count);
}

export function createPopulationImmigrant(population, boundaryTime, slot = 0) {
  if (!Array.isArray(population)) return null;
  const dayIndex = Math.floor(Math.max(0, Number(boundaryTime) || 0) / (24 * 60 * 60));
  const id = `person-born-${dayIndex}-${1000 + Math.max(0, Math.floor(slot))}-${population.length}`;
  const surname = immigrantSurname(population, id);
  const ageYears = 18 + stableUnit(`${id}:arrival-age`) * 32;
  const person = createGeneratedPopulationPerson({
    id,
    displayName: withPersonSurname(generatedPopulationName(id), surname),
    ageYears,
    worldTimeSeconds: boundaryTime,
  });
  population.push(person);
  return person;
}

export function extinctSurnameRoots(population) {
  const people = Array.isArray(population) ? population : [];
  const historical = new Map();
  const living = new Set();
  for (const person of people) {
    for (const root of personSurnameComponents(person)) {
      const key = normalizedKey(root);
      if (!key) continue;
      if (!historical.has(key)) historical.set(key, root);
      if (isLivingPopulationPerson(person)) living.add(key);
    }
  }
  return [...historical.entries()]
    .filter(([key]) => !living.has(key))
    .map(([, surname]) => surname)
    .sort((a, b) => a.localeCompare(b));
}

function immigrantSurname(population, id) {
  const extinct = extinctSurnameRoots(population);
  if (extinct.length > 0 && stableUnit(`${id}:extinct-surname`) < IMMIGRANT_EXTINCT_SURNAME_CHANCE) {
    return extinct[indexFor(`${id}:extinct-index`, extinct.length)];
  }
  const historical = new Set((Array.isArray(population) ? population : [])
    .flatMap((person) => personSurnameComponents(person))
    .map(normalizedKey));
  const unseen = COMMON_PERSON_SURNAMES.filter((surname) => !historical.has(normalizedKey(surname)));
  if (unseen.length > 0) return unseen[indexFor(`${id}:new-surname-index`, unseen.length)];
  if (extinct.length > 0) return extinct[indexFor(`${id}:fallback-extinct-index`, extinct.length)];
  return COMMON_PERSON_SURNAMES[indexFor(`${id}:fallback-surname-index`, COMMON_PERSON_SURNAMES.length)];
}

function livingBloodRelativeCount(personId, byId, livingIds) {
  if (!byId.has(personId)) return 0;
  const ancestors = ancestorIds(personId, byId, BLOODLINE_ANCESTOR_DEPTH);
  const relatives = new Set(ancestors);
  for (const anchorId of [personId, ...ancestors]) {
    collectDescendants(anchorId, byId, BLOODLINE_DESCENDANT_DEPTH, relatives);
  }
  relatives.delete(personId);
  let count = 0;
  for (const id of relatives) if (livingIds.has(id)) count += 1;
  return count;
}

function ancestorIds(personId, byId, depth) {
  const result = new Set();
  let frontier = [personId];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const id of frontier) {
      const person = byId.get(id);
      for (const parentId of relationshipIds(person, "child")) {
        if (result.has(parentId)) continue;
        result.add(parentId);
        next.push(parentId);
      }
    }
    frontier = next;
  }
  return result;
}

function collectDescendants(personId, byId, depth, result) {
  let frontier = [personId];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const id of frontier) {
      const person = byId.get(id);
      for (const childId of relationshipIds(person, "parent")) {
        if (!result.has(childId)) result.add(childId);
        next.push(childId);
      }
    }
    frontier = next;
  }
}

function relationshipIds(person, kind) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship?.kind === kind)
    .map((relationship) => relationship.personId)
    .filter(Boolean);
}

function normalizedKey(value) { return String(value ?? "").trim().toLowerCase(); }
function indexFor(key, length) { return Math.min(Math.max(0, length - 1), Math.floor(stableUnit(key) * length)); }
function stableUnit(key) { return stableHash(key) / 0xffffffff; }
function stableHash(key) {
  let hash = 2166136261;
  for (const character of String(key ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
