import {
  ageYearsForLifeDays,
  createGeneratedPopulationPerson,
  evaluatePersonOffscreen,
  FOOD_PREFERENCE_TAGS,
  isGeneratedPersonId,
  isLivingPopulationPerson,
  lifeDaysForAgeYears,
  PERSON_GAME_DAY_SECONDS,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  PERSON_RELATIONSHIP_KINDS,
  STAGE1_POPULATION_SIZE,
  VISIT_TIME_PERIODS,
} from "./populationDomain.js";
import {
  alignPartnerWealth,
  inheritedFamilySpendingCapacity,
  rebalancePopulationWealth,
  spendingCapacityIndex,
  synchronizePartnerWealth,
} from "./populationWealthBalance.js";
import {
  applyMarriageFamilyNames,
  childFamilySurname,
  ensurePopulationFamilyNames,
  familyLineBirthWeight,
  visualSurnamePairPenaltyDays,
  withPersonSurname,
} from "./personFamilyNames.js";
import {
  bloodlineBirthWeightForPair,
  bloodlineChildCapForPair,
  createBloodlinePressureIndex,
  createPopulationImmigrant,
  plannedImmigrantCount,
} from "./populationLineageBalance.js";
import { generatedPopulationName, isLegacyResidentName } from "./personNames.js";

export const MATURE_POPULATION_TARGET = 300;
export const MIN_BIRTH_SPACING_DAYS = 6;
export const NATURAL_LIFE_MIN_DAYS = 98;
export const NATURAL_LIFE_MAX_DAYS = 102;
export const BIRTH_RATE_ANCHORS = Object.freeze([
  Object.freeze({ population: 240, birthsPerDay: 6 }),
  Object.freeze({ population: 260, birthsPerDay: 5 }),
  Object.freeze({ population: 280, birthsPerDay: 4 }),
  Object.freeze({ population: 300, birthsPerDay: 3 }),
  Object.freeze({ population: 320, birthsPerDay: 2 }),
  Object.freeze({ population: 340, birthsPerDay: 1 }),
  Object.freeze({ population: 360, birthsPerDay: 0 }),
]);
export const ACCIDENT_RISK_PER_DAY = Object.freeze({
  [PERSON_LIFE_STAGES.newborn]: 0.00005,
  [PERSON_LIFE_STAGES.infant]: 0.00005,
  [PERSON_LIFE_STAGES.toddler]: 0.00005,
  [PERSON_LIFE_STAGES.child]: 0.00005,
  [PERSON_LIFE_STAGES.teen]: 0.0001,
  [PERSON_LIFE_STAGES.youngAdult]: 0.0002,
  [PERSON_LIFE_STAGES.adult]: 0.0002,
  [PERSON_LIFE_STAGES.elder]: 0.0003,
});

const SEED_COUNT = MATURE_POPULATION_TARGET - STAGE1_POPULATION_SIZE;
const REPRODUCTIVE_STAGES = new Set([PERSON_LIFE_STAGES.youngAdult, PERSON_LIFE_STAGES.adult]);

export function ensureMaturePopulation(population, worldTimeSeconds = 0) {
  if (!Array.isArray(population)) throw new Error("Mature population requires an array");
  assignGeneratedPopulationNames(population);
  if (population.some((person) => isGeneratedPersonId(person?.id)) || population.length > STAGE1_POPULATION_SIZE) {
    ensurePopulationFamilyNames(population);
    synchronizePartnerWealth(population);
    return population;
  }
  const evaluationTime = nonNegativeNumber(worldTimeSeconds, 0);
  for (let index = 1; index <= SEED_COUNT; index += 1) {
    const id = `person-seed-${String(index).padStart(3, "0")}`;
    const lifeDays = ((index - 0.5) / SEED_COUNT) * naturalLifeDaysForPerson(id);
    population.push(createGeneratedPopulationPerson({
      id,
      displayName: generatedPopulationName(id),
      ageYears: ageYearsForLifeDays(lifeDays),
      worldTimeSeconds: evaluationTime,
    }));
  }
  ensurePopulationFamilyNames(population);
  ensurePopulationPartners(population);
  seedExistingFamilies(population);
  synchronizePartnerWealth(population);
  return population;
}

export function assignGeneratedPopulationNames(population) {
  if (!Array.isArray(population)) return 0;
  let renamed = 0;
  for (const person of population) {
    if (!isGeneratedPersonId(person?.id)) continue;
    if (typeof person.displayName === "string" && person.displayName.trim() && !isLegacyResidentName(person.displayName)) continue;
    person.displayName = generatedPopulationName(person.id);
    renamed += 1;
  }
  return renamed;
}

export function naturalLifeDaysForPerson(personId) {
  const id = String(personId ?? "").trim();
  if (!id) return 100;
  return round(NATURAL_LIFE_MIN_DAYS
    + stableUnit(`${id}:natural-life-days`) * (NATURAL_LIFE_MAX_DAYS - NATURAL_LIFE_MIN_DAYS));
}

export function accidentRiskPerDayForStage(stage) {
  return ACCIDENT_RISK_PER_DAY[stage] ?? ACCIDENT_RISK_PER_DAY[PERSON_LIFE_STAGES.adult];
}

export function advancePopulationLifecycle(population, targetWorldTimeSeconds, { protectedPersonIds = [] } = {}) {
  if (!Array.isArray(population)) return emptySummary();
  const targetTime = nonNegativeNumber(targetWorldTimeSeconds, 0);
  const protectedIds = new Set(Array.isArray(protectedPersonIds) ? protectedPersonIds : []);
  const living = population.filter(isLivingPopulationPerson);
  if (living.length === 0) return { ...emptySummary(), aliveCount: 0 };
  const cursor = Math.min(...living.map((person) => nonNegativeNumber(person.lastEvaluatedWorldTimeSeconds, targetTime)));
  if (targetTime <= cursor) return { ...emptySummary(), aliveCount: living.length };

  let boundary = (Math.floor(cursor / PERSON_GAME_DAY_SECONDS) + 1) * PERSON_GAME_DAY_SECONDS;
  let daysProcessed = 0;
  let births = 0;
  let arrivals = 0;
  let deaths = 0;
  let naturalDeaths = 0;
  let accidentalDeaths = 0;
  const arrivalIds = [];
  const naturalDeathIds = [];
  const accidentalDeathIds = [];
  while (boundary <= targetTime) {
    const result = processPopulationDay(population, boundary, protectedIds);
    daysProcessed += 1;
    births += result.births;
    arrivals += result.arrivals;
    deaths += result.deaths;
    naturalDeaths += result.naturalDeaths;
    accidentalDeaths += result.accidentalDeaths;
    arrivalIds.push(...result.arrivalIds);
    naturalDeathIds.push(...result.naturalDeathIds);
    accidentalDeathIds.push(...result.accidentalDeathIds);
    boundary += PERSON_GAME_DAY_SECONDS;
  }
  return {
    daysProcessed,
    births,
    arrivals,
    deaths,
    naturalDeaths,
    accidentalDeaths,
    arrivalIds,
    naturalDeathIds,
    accidentalDeathIds,
    aliveCount: livingCount(population),
  };
}

export function birthTargetRateForPopulation(populationCount) {
  const count = Math.max(0, Number(populationCount) || 0);
  if (count <= BIRTH_RATE_ANCHORS[0].population) return BIRTH_RATE_ANCHORS[0].birthsPerDay;
  const last = BIRTH_RATE_ANCHORS.at(-1);
  if (count >= last.population) return last.birthsPerDay;
  for (let index = 0; index < BIRTH_RATE_ANCHORS.length - 1; index += 1) {
    const lower = BIRTH_RATE_ANCHORS[index];
    const upper = BIRTH_RATE_ANCHORS[index + 1];
    if (count > upper.population) continue;
    const progress = (count - lower.population) / (upper.population - lower.population);
    return round(lower.birthsPerDay + (upper.birthsPerDay - lower.birthsPerDay) * progress);
  }
  return 0;
}

export function ensurePopulationPartners(population) {
  if (!Array.isArray(population)) return 0;
  ensurePopulationFamilyNames(population);
  const byId = new Map(population.map((person) => [person.id, person]));
  const singles = population.filter((person) => (
    isLivingPopulationPerson(person)
    && REPRODUCTIVE_STAGES.has(person.lifeStage)
    && !livingPartnerId(person, byId)
  ));
  singles.sort((a, b) => stableUnit(`pair-order:${a.id}`) - stableUnit(`pair-order:${b.id}`));
  const used = new Set();
  let created = 0;
  for (const first of singles) {
    if (used.has(first.id)) continue;
    const firstWealthIndex = spendingCapacityIndex(first.spendingCapacity);
    const second = singles
      .filter((candidate) => candidate.id !== first.id && !used.has(candidate.id))
      .filter((candidate) => Math.abs(firstWealthIndex - spendingCapacityIndex(candidate.spendingCapacity)) <= 1)
      .filter((candidate) => !arePopulationPairCloseRelatives(first.id, candidate.id, byId))
      .sort((a, b) => {
        const scoreDelta = pairCandidateScore(first, a, byId) - pairCandidateScore(first, b, byId);
        return scoreDelta || stableUnit(`pair:${first.id}:${a.id}`) - stableUnit(`pair:${first.id}:${b.id}`);
      })[0];
    if (!second) continue;
    addReciprocalRelationship(first, second, PERSON_RELATIONSHIP_KINDS.partner, PERSON_RELATIONSHIP_KINDS.partner);
    alignPartnerWealth(first, second);
    applyMarriageFamilyNames(first, second);
    used.add(first.id);
    used.add(second.id);
    created += 1;
  }
  return created;
}

function processPopulationDay(population, boundaryTime, protectedIds) {
  for (let index = 0; index < population.length; index += 1) {
    if (!isLivingPopulationPerson(population[index])) continue;
    population[index] = evaluatePersonOffscreen(population[index], boundaryTime);
  }

  const dayIndex = Math.floor(boundaryTime / PERSON_GAME_DAY_SECONDS);
  let naturalDeaths = 0;
  let accidentalDeaths = 0;
  const naturalDeathIds = [];
  const accidentalDeathIds = [];
  for (const person of population) {
    if (!isLivingPopulationPerson(person) || protectedIds.has(person.id)) continue;
    const lifeDays = lifeDaysForAgeYears(person.ageYears);
    if (lifeDays >= naturalLifeDaysForPerson(person.id)) {
      person.lifeStatus = PERSON_LIFE_STATUSES.dead;
      naturalDeaths += 1;
      naturalDeathIds.push(person.id);
      continue;
    }
    if (stableUnit(`${person.id}:accident:${dayIndex}`) < accidentRiskPerDayForStage(person.lifeStage)) {
      person.lifeStatus = PERSON_LIFE_STATUSES.dead;
      accidentalDeaths += 1;
      accidentalDeathIds.push(person.id);
    }
  }

  ensurePopulationPartners(population);
  const aliveAfterDeaths = livingCount(population);
  const requestedAdditions = wholeBirthTarget(aliveAfterDeaths, dayIndex);
  const plannedArrivals = plannedImmigrantCount(population, requestedAdditions, dayIndex);
  const arrivalIds = [];
  for (let slot = 0; slot < plannedArrivals; slot += 1) {
    const immigrant = createPopulationImmigrant(population, boundaryTime, slot);
    if (immigrant) arrivalIds.push(immigrant.id);
  }
  const requestedBirths = Math.max(0, requestedAdditions - arrivalIds.length);
  const pairs = eligibleBirthPairs(population, boundaryTime);
  let births = 0;
  for (let slot = 0; slot < requestedBirths && slot < pairs.length; slot += 1) {
    createBirth(population, pairs[slot], boundaryTime, slot);
    births += 1;
  }
  rebalancePopulationWealth(population, dayIndex, { excludedPersonIds: protectedIds });
  return {
    births,
    arrivals: arrivalIds.length,
    arrivalIds,
    deaths: naturalDeaths + accidentalDeaths,
    naturalDeaths,
    accidentalDeaths,
    naturalDeathIds,
    accidentalDeathIds,
  };
}

function wholeBirthTarget(aliveCount, dayIndex) {
  const rate = birthTargetRateForPopulation(aliveCount);
  if (rate <= 0) return 0;
  const unit = mixedDayUnit(dayIndex);
  const offset = unit < 0.1 ? -2
    : unit < 0.3 ? -1
      : unit < 0.7 ? 0
        : unit < 0.9 ? 1
          : 2;
  return Math.max(0, Math.round(rate + offset));
}

function mixedDayUnit(dayIndex) {
  let value = (Math.trunc(Number(dayIndex) || 0) ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  return value / 0xffffffff;
}

function eligibleBirthPairs(population, boundaryTime) {
  const byId = new Map(population.map((person) => [person.id, person]));
  const bloodlineIndex = createBloodlinePressureIndex(population);
  const seen = new Set();
  const pairs = [];
  for (const first of population) {
    if (!isLivingPopulationPerson(first) || !REPRODUCTIVE_STAGES.has(first.lifeStage)) continue;
    const secondId = livingPartnerId(first, byId);
    const second = secondId ? byId.get(secondId) : null;
    if (!second || !REPRODUCTIVE_STAGES.has(second.lifeStage)) continue;
    const key = pairKey(first.id, second.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const children = sharedChildren(first, second, byId);
    const childTarget = Math.min(
      familyChildTarget(first.id, second.id),
      bloodlineChildCapForPair(first, second, bloodlineIndex),
    );
    if (children.length >= childTarget) continue;
    if (children.some((child) => lifeDaysForAgeYears(child.ageYears) < MIN_BIRTH_SPACING_DAYS)) continue;
    pairs.push([first, second]);
  }
  const dayIndex = Math.floor(boundaryTime / PERSON_GAME_DAY_SECONDS);
  const weightedPairs = pairs.map((pair) => ({
    pair,
    weight: familyLineBirthWeight(pair[0], pair[1], population)
      * bloodlineBirthWeightForPair(pair[0], pair[1], bloodlineIndex),
  }));
  return weightedPairs.sort((left, right) => {
    const leftKey = pairKey(left.pair[0].id, left.pair[1].id);
    const rightKey = pairKey(right.pair[0].id, right.pair[1].id);
    const leftPriority = stableUnit(`birth-order:${dayIndex}:${leftKey}`) / left.weight;
    const rightPriority = stableUnit(`birth-order:${dayIndex}:${rightKey}`) / right.weight;
    return leftPriority - rightPriority || leftKey.localeCompare(rightKey);
  }).map(({ pair }) => pair);
}

function createBirth(population, [first, second], boundaryTime, slot) {
  const dayIndex = Math.floor(boundaryTime / PERSON_GAME_DAY_SECONDS);
  const id = `person-born-${dayIndex}-${slot}-${population.length}`;
  const child = createGeneratedPopulationPerson({
    id,
    displayName: withPersonSurname(generatedPopulationName(id), childFamilySurname(first, second, id)),
    ageYears: 0,
    worldTimeSeconds: boundaryTime,
    spendingCapacity: inheritedFamilySpendingCapacity(first, second, id, population),
    foodPreferences: inheritedFoodPreferences(first, second, id),
    preferredVisitPeriods: inheritedVisitPeriods(first, second, id),
  });
  population.push(child);
  addReciprocalRelationship(first, child, PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child);
  addReciprocalRelationship(second, child, PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child);
  const byId = new Map(population.map((person) => [person.id, person]));
  const siblings = new Set([
    ...childIdsForParent(first),
    ...childIdsForParent(second),
  ]);
  siblings.delete(child.id);
  for (const siblingId of siblings) {
    const sibling = byId.get(siblingId);
    if (sibling) addReciprocalRelationship(child, sibling, PERSON_RELATIONSHIP_KINDS.sibling, PERSON_RELATIONSHIP_KINDS.sibling);
  }
  return child;
}

function seedExistingFamilies(population) {
  const byId = new Map(population.map((person) => [person.id, person]));
  const seedPairs = population.flatMap((first) => {
    if (!first.id.startsWith("person-seed-") || !isLivingPopulationPerson(first)) return [];
    const secondId = livingPartnerId(first, byId);
    if (!secondId?.startsWith("person-seed-") || first.id >= secondId) return [];
    return [[first, byId.get(secondId)]];
  });
  const minors = population
    .filter((person) => person.id.startsWith("person-seed-") && lifeDaysForAgeYears(person.ageYears) < 37)
    .filter((person) => parentIdsForChild(person).length === 0)
    .sort((a, b) => lifeDaysForAgeYears(b.ageYears) - lifeDaysForAgeYears(a.ageYears));

  for (const child of minors) {
    const parents = seedPairs
      .filter(([first, second]) => first.ageYears >= child.ageYears + 18 && second.ageYears >= child.ageYears + 18)
      .filter(([first, second]) => sharedChildIds(first, second).length < 3)
      .sort((left, right) => {
        const childDelta = sharedChildIds(left[0], left[1]).length - sharedChildIds(right[0], right[1]).length;
        return childDelta || stableUnit(`seed-family:${child.id}:${pairKey(left[0].id, left[1].id)}`)
          - stableUnit(`seed-family:${child.id}:${pairKey(right[0].id, right[1].id)}`);
      })[0];
    if (!parents) continue;
    const [first, second] = parents;
    const existingSiblingIds = new Set([...childIdsForParent(first), ...childIdsForParent(second)]);
    addReciprocalRelationship(first, child, PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child);
    addReciprocalRelationship(second, child, PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child);
    child.displayName = withPersonSurname(child.displayName, childFamilySurname(first, second, child.id));
    for (const siblingId of existingSiblingIds) {
      const sibling = byId.get(siblingId);
      if (sibling && sibling.id !== child.id) {
        addReciprocalRelationship(child, sibling, PERSON_RELATIONSHIP_KINDS.sibling, PERSON_RELATIONSHIP_KINDS.sibling);
      }
    }
  }
}

function familyChildTarget(firstId, secondId) {
  const unit = stableUnit(`family-size:${pairKey(firstId, secondId)}`);
  if (unit < 0.2) return 1;
  if (unit < 0.7) return 2;
  return 3;
}

function inheritedFoodPreferences(first, second, childId) {
  return Object.fromEntries(Object.entries(FOOD_PREFERENCE_TAGS).map(([level, tags]) => [
    level,
    Object.fromEntries(tags.map((tag) => {
      const parentUnit = stableUnit(`${childId}:${level}:${tag}:parent`);
      let value = parentUnit < 0.5 ? first.foodPreferences[level][tag] : second.foodPreferences[level][tag];
      if (stableUnit(`${childId}:${level}:${tag}:variation`) < 0.15) {
        value = [-1, 0, 1][Math.min(2, Math.floor(stableUnit(`${childId}:${level}:${tag}:mutation`) * 3))];
      }
      return [tag, value];
    })),
  ]));
}

function inheritedVisitPeriods(first, second, childId) {
  const periods = [];
  const firstPeriods = Array.isArray(first.preferredVisitPeriods) ? first.preferredVisitPeriods : [];
  const secondPeriods = Array.isArray(second.preferredVisitPeriods) ? second.preferredVisitPeriods : [];
  const selected = stableUnit(`${childId}:period-parent`) < 0.5 ? firstPeriods : secondPeriods;
  if (selected[0]) periods.push(selected[0]);
  const other = selected === firstPeriods ? secondPeriods : firstPeriods;
  if (other[0] && other[0] !== periods[0] && stableUnit(`${childId}:period-second`) < 0.5) periods.push(other[0]);
  if (stableUnit(`${childId}:period-variation`) < 0.15) {
    const values = Object.values(VISIT_TIME_PERIODS);
    const varied = values[Math.min(values.length - 1, Math.floor(stableUnit(`${childId}:period-mutation`) * values.length))];
    if (!periods.includes(varied)) periods.push(varied);
  }
  return periods.slice(0, 2);
}

export function arePopulationPairCloseRelatives(firstId, secondId, byId) {
  const first = byId.get(firstId);
  const second = byId.get(secondId);
  if (!first || !second) return true;
  if (first.relationships.some((relationship) => relationship.personId === secondId
    && [PERSON_RELATIONSHIP_KINDS.parent, PERSON_RELATIONSHIP_KINDS.child, PERSON_RELATIONSHIP_KINDS.sibling].includes(relationship.kind))) return true;
  const firstAncestors = ancestorIds(firstId, byId, 3);
  const secondAncestors = ancestorIds(secondId, byId, 3);
  if (firstAncestors.has(secondId) || secondAncestors.has(firstId)) return true;
  return [...firstAncestors].some((id) => secondAncestors.has(id));
}

export function populationPairSoftPenaltyDays(firstId, secondId, byId) {
  const first = byId.get(firstId);
  const second = byId.get(secondId);
  if (!first || !second) return Number.POSITIVE_INFINITY;
  let penalty = visualSurnamePairPenaltyDays(first, second);
  const firstFour = ancestorIds(firstId, byId, 4);
  const secondFour = ancestorIds(secondId, byId, 4);
  if (firstFour.has(secondId) || secondFour.has(firstId) || [...firstFour].some((id) => secondFour.has(id))) return penalty + 6;
  const firstFive = ancestorIds(firstId, byId, 5);
  const secondFive = ancestorIds(secondId, byId, 5);
  if (firstFive.has(secondId) || secondFive.has(firstId) || [...firstFive].some((id) => secondFive.has(id))) penalty += 3;
  return penalty;
}

function pairCandidateScore(first, candidate, byId) {
  const wealthDistance = Math.abs(spendingCapacityIndex(first.spendingCapacity)
    - spendingCapacityIndex(candidate.spendingCapacity));
  return Math.abs(lifeDaysForAgeYears(first.ageYears) - lifeDaysForAgeYears(candidate.ageYears))
    + wealthDistance * 4
    + populationPairSoftPenaltyDays(first.id, candidate.id, byId);
}

function ancestorIds(personId, byId, depth) {
  const result = new Set();
  let frontier = [personId];
  for (let level = 0; level < depth; level += 1) {
    const next = [];
    for (const id of frontier) {
      const person = byId.get(id);
      for (const parentId of parentIdsForChild(person)) {
        if (result.has(parentId)) continue;
        result.add(parentId);
        next.push(parentId);
      }
    }
    frontier = next;
  }
  return result;
}

function sharedChildren(first, second, byId) {
  return sharedChildIds(first, second).map((id) => byId.get(id)).filter(Boolean);
}
function sharedChildIds(first, second) {
  const secondChildren = new Set(childIdsForParent(second));
  return childIdsForParent(first).filter((id) => secondChildren.has(id));
}
function childIdsForParent(person) {
  return Array.isArray(person?.relationships) ? person.relationships
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.parent)
    .map((relationship) => relationship.personId) : [];
}
function parentIdsForChild(person) {
  return Array.isArray(person?.relationships) ? person.relationships
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.child)
    .map((relationship) => relationship.personId) : [];
}
function livingPartnerId(person, byId) {
  return person.relationships
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.partner)
    .map((relationship) => byId.get(relationship.personId))
    .find(isLivingPopulationPerson)?.id ?? null;
}
function addReciprocalRelationship(first, second, firstKind, secondKind) {
  addRelationship(first, second.id, firstKind);
  addRelationship(second, first.id, secondKind);
}
function addRelationship(person, relatedPersonId, kind) {
  if (!person.relationships.some((relationship) => relationship.personId === relatedPersonId && relationship.kind === kind)) {
    person.relationships.push({ personId: relatedPersonId, kind });
  }
  person.relatedPersonIds = person.relationships.map((relationship) => relationship.personId);
}
function pairKey(firstId, secondId) { return [firstId, secondId].sort().join("|"); }
function livingCount(population) { return population.filter(isLivingPopulationPerson).length; }
function emptySummary() {
  return {
    daysProcessed: 0,
    births: 0,
    arrivals: 0,
    deaths: 0,
    naturalDeaths: 0,
    accidentalDeaths: 0,
    arrivalIds: [],
    naturalDeathIds: [],
    accidentalDeathIds: [],
    aliveCount: 0,
  };
}
function nonNegativeNumber(value, fallback) {
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
function round(value) { return Math.round(value * 1_000_000) / 1_000_000; }
