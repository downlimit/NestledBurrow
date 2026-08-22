import {
  isLivingPopulationPerson,
  PERSON_LIFE_STAGES,
  PERSON_RELATIONSHIP_KINDS,
  SPENDING_CAPACITY_VALUES,
  SPENDING_CAPACITY_WEIGHTS,
} from "./populationDomain.js";
import { personEconomyProfile } from "./personEconomyProfile.js";

export const WEALTH_SUBGROUP_MIN_SIZE = 15;
export const WEALTH_BALANCE_MAX_HOUSEHOLDS_PER_DAY = 4;
export const WEALTH_MOBILITY_CHANCE_PER_DAY = 0.035;
export const EXTREME_GENERATION_WEALTH_EXCEPTION_CHANCE = 0.02;

const INDEPENDENT_LIFE_STAGES = new Set([
  PERSON_LIFE_STAGES.youngAdult,
  PERSON_LIFE_STAGES.adult,
  PERSON_LIFE_STAGES.elder,
]);

export function wealthTargetShares() {
  const total = SPENDING_CAPACITY_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  return SPENDING_CAPACITY_WEIGHTS.map((weight) => weight / total);
}

export function spendingCapacityIndex(value) {
  const numeric = Number(value);
  const exact = SPENDING_CAPACITY_VALUES.indexOf(numeric);
  if (exact >= 0) return exact;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < SPENDING_CAPACITY_VALUES.length; index += 1) {
    const distance = Math.abs(SPENDING_CAPACITY_VALUES[index] - numeric);
    if (distance < bestDistance) { bestIndex = index; bestDistance = distance; }
  }
  return bestIndex;
}

export function wealthDistributionForPopulation(population) {
  const counts = Array(SPENDING_CAPACITY_VALUES.length).fill(0);
  const living = (Array.isArray(population) ? population : []).filter(isLivingPopulationPerson);
  for (const person of living) counts[spendingCapacityIndex(person.spendingCapacity)] += 1;
  return {
    livingCount: living.length,
    counts,
    shares: living.length > 0 ? counts.map((count) => count / living.length) : counts.map(() => 0),
    targetShares: wealthTargetShares(),
  };
}

export function alignPartnerWealth(first, second) {
  if (!first || !second) return false;
  const firstIndex = spendingCapacityIndex(first.spendingCapacity);
  const secondIndex = spendingCapacityIndex(second.spendingCapacity);
  if (firstIndex === secondIndex) return false;
  const average = (firstIndex + secondIndex) / 2;
  const lower = Math.floor(average);
  const upper = Math.ceil(average);
  const targetIndex = lower === upper
    ? lower
    : stableUnit(`partner-wealth:${pairKey(first.id, second.id)}`) < 0.5 ? lower : upper;
  const capacity = SPENDING_CAPACITY_VALUES[targetIndex];
  first.spendingCapacity = capacity;
  second.spendingCapacity = capacity;
  return true;
}

export function synchronizePartnerWealth(population) {
  if (!Array.isArray(population)) return 0;
  const byId = new Map(population.map((person) => [person?.id, person]).filter(([id]) => id));
  let changes = alignAllLivingPartners(population, byId);
  for (const person of population) {
    if (!isLivingPopulationPerson(person)) continue;
    const parentIndices = livingParentIndices(person, byId);
    if (parentIndices.length === 0 || extremeGenerationException(person.id)) continue;
    const parentIndex = Math.round(parentIndices.reduce((sum, index) => sum + index, 0) / parentIndices.length);
    const childIndex = spendingCapacityIndex(person.spendingCapacity);
    if (Math.abs(childIndex - parentIndex) <= 2) continue;
    const targetIndex = childIndex < parentIndex ? parentIndex - 2 : parentIndex + 2;
    person.spendingCapacity = SPENDING_CAPACITY_VALUES[targetIndex];
    changes += 1;
  }
  changes += alignAllLivingPartners(population, byId);
  return changes;
}

export function inheritedFamilySpendingCapacity(first, second, childId, population = []) {
  const firstIndex = spendingCapacityIndex(first?.spendingCapacity);
  const secondIndex = spendingCapacityIndex(second?.spendingCapacity);
  const baseIndex = Math.round((firstIndex + secondIndex) / 2);
  const distribution = wealthDistributionForPopulation(population);
  const shares = distribution.targetShares;
  const projectedCount = Math.max(1, distribution.livingCount + 1);
  const candidates = [...new Set([baseIndex - 1, baseIndex, baseIndex + 1]
    .filter((index) => index >= 0 && index < SPENDING_CAPACITY_VALUES.length))];
  const weighted = candidates.map((index) => {
    const baseWeight = index === baseIndex ? 0.76 : 0.12;
    const target = shares[index] * projectedCount;
    const deficit = Math.max(0, target - distribution.counts[index]);
    return { index, weight: baseWeight * (1 + 2 * deficit / Math.max(1, target)) };
  });
  return SPENDING_CAPACITY_VALUES[pickWeightedIndex(weighted, `${childId}:wealth-inheritance`)];
}

export function recommendedPopulationEntryCapacity(population, key = "entry") {
  const distribution = wealthDistributionForPopulation(population);
  const projectedCount = Math.max(1, distribution.livingCount + 1);
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < SPENDING_CAPACITY_VALUES.length; index += 1) {
    const target = distribution.targetShares[index] * projectedCount;
    const deficit = target - distribution.counts[index];
    const score = deficit / Math.max(1, target) + stableUnit(`${key}:${index}`) * 0.0001;
    if (score > bestScore) { bestIndex = index; bestScore = score; }
  }
  return SPENDING_CAPACITY_VALUES[bestIndex];
}

export function rebalancePopulationWealth(population, dayIndex, {
  maxHouseholdMoves = WEALTH_BALANCE_MAX_HOUSEHOLDS_PER_DAY,
  mobilityChance = WEALTH_MOBILITY_CHANCE_PER_DAY,
  excludedPersonIds = [],
} = {}) {
  if (!Array.isArray(population) || maxHouseholdMoves <= 0) return [];
  synchronizePartnerWealth(population);
  const excluded = new Set(excludedPersonIds ?? []);
  const byId = new Map(population.map((person) => [person?.id, person]).filter(([id]) => id));
  const units = economicUnits(population)
    .filter((members) => members.every((person) => !excluded.has(person.id)))
    .sort((left, right) => (
      stableUnit(`career-order:${dayIndex}:${unitKey(left)}`)
      - stableUnit(`career-order:${dayIndex}:${unitKey(right)}`)
    ));
  const moves = [];
  for (const members of units) {
    if (moves.length >= maxHouseholdMoves) break;
    if (stableUnit(`career-event:${dayIndex}:${unitKey(members)}`) >= clamp(Number(mobilityChance), 0, 1)) continue;
    const move = chooseCareerMove(population, members, dayIndex, byId);
    if (!move) continue;
    const capacity = SPENDING_CAPACITY_VALUES[move.toIndex];
    for (const person of members) person.spendingCapacity = capacity;
    moves.push({
      event: move.toIndex > move.fromIndex ? "promotion" : "demotion",
      personIds: members.map((person) => person.id),
      from: SPENDING_CAPACITY_VALUES[move.fromIndex],
      to: capacity,
      balanceImprovement: round(move.improvement),
    });
  }
  synchronizePartnerWealth(population);
  return moves;
}

export function wealthSubgroupsForPopulation(population) {
  const living = (Array.isArray(population) ? population : []).filter(isLivingPopulationPerson);
  const membersByKey = new Map();
  for (const person of living) {
    for (const key of subgroupKeysForPerson(person)) {
      if (!membersByKey.has(key)) membersByKey.set(key, []);
      membersByKey.get(key).push(person);
    }
  }
  return [...membersByKey.entries()]
    .filter(([, members]) => members.length >= WEALTH_SUBGROUP_MIN_SIZE)
    .map(([key, members]) => ({ key, members }));
}

function chooseCareerMove(population, members, dayIndex, byId) {
  const fromIndex = spendingCapacityIndex(members[0].spendingCapacity);
  if (!members.every((person) => spendingCapacityIndex(person.spendingCapacity) === fromIndex)) return null;
  const distribution = wealthDistributionForPopulation(population);
  const subgroups = wealthSubgroupsForPopulation(population);
  const options = [-1, 1].flatMap((direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= SPENDING_CAPACITY_VALUES.length) return [];
    if (!generationMoveAllowed(members, toIndex, byId)) return [];
    const improvement = moveImprovement(distribution, subgroups, members, fromIndex, toIndex);
    const balanceWeight = Math.exp(clamp(improvement, -3, 3));
    return [{ fromIndex, toIndex, improvement, weight: balanceWeight }];
  });
  if (options.length === 0) return null;
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  let cursor = stableUnit(`career-direction:${dayIndex}:${unitKey(members)}`) * total;
  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option;
  }
  return options.at(-1);
}

function alignAllLivingPartners(population, byId) {
  const seen = new Set();
  let changes = 0;
  for (const person of population) {
    if (!isLivingPopulationPerson(person)) continue;
    const partnerId = livingPartnerId(person, byId);
    if (!partnerId) continue;
    const key = pairKey(person.id, partnerId);
    if (seen.has(key)) continue;
    seen.add(key);
    if (alignPartnerWealth(person, byId.get(partnerId))) changes += 1;
  }
  return changes;
}

function generationMoveAllowed(members, toIndex, byId) {
  for (const person of members) {
    const parentIndices = livingParentIndices(person, byId);
    if (parentIndices.length === 0 || extremeGenerationException(person.id)) continue;
    for (const parentIndex of parentIndices) if (Math.abs(toIndex - parentIndex) > 2) return false;
  }
  return true;
}

function livingParentIndices(person, byId) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.child)
    .map((relationship) => byId.get(relationship.personId))
    .filter(isLivingPopulationPerson)
    .map((parent) => spendingCapacityIndex(parent.spendingCapacity));
}

function extremeGenerationException(personId) {
  return stableUnit(`${personId}:extreme-generation-wealth`) < EXTREME_GENERATION_WEALTH_EXCEPTION_CHANCE;
}

function moveImprovement(distribution, subgroups, members, fromIndex, toIndex) {
  const memberCount = members.length;
  const targetCounts = distribution.targetShares.map((share) => share * distribution.livingCount);
  const beforeGlobal = distributionError(distribution.counts, targetCounts);
  const afterGlobalCounts = [...distribution.counts];
  afterGlobalCounts[fromIndex] -= memberCount;
  afterGlobalCounts[toIndex] += memberCount;
  const afterGlobal = distributionError(afterGlobalCounts, targetCounts);
  let improvement = (beforeGlobal - afterGlobal) * 4;
  const memberIds = new Set(members.map((person) => person.id));
  for (const subgroup of subgroups) {
    const movedCount = subgroup.members.reduce((count, person) => count + (memberIds.has(person.id) ? 1 : 0), 0);
    if (movedCount === 0) continue;
    const counts = Array(SPENDING_CAPACITY_VALUES.length).fill(0);
    for (const person of subgroup.members) counts[spendingCapacityIndex(person.spendingCapacity)] += 1;
    const targets = distribution.targetShares.map((share) => share * subgroup.members.length);
    const before = distributionError(counts, targets, true);
    counts[fromIndex] -= movedCount;
    counts[toIndex] += movedCount;
    const after = distributionError(counts, targets, true);
    improvement += before - after;
  }
  return improvement;
}

function distributionError(counts, targets, protectCoverage = false) {
  let error = 0;
  for (let index = 0; index < counts.length; index += 1) {
    const target = targets[index];
    const delta = counts[index] - target;
    error += delta * delta / Math.max(1, target);
    if (protectCoverage && target >= 0.75 && counts[index] === 0) error += 2.5;
  }
  return error;
}

function economicUnits(population) {
  const living = (Array.isArray(population) ? population : []).filter(isLivingPopulationPerson);
  const byId = new Map(living.map((person) => [person.id, person]));
  const used = new Set();
  const units = [];
  for (const person of living) {
    if (used.has(person.id) || !INDEPENDENT_LIFE_STAGES.has(person.lifeStage)) continue;
    const members = [person];
    const partnerId = livingPartnerId(person, byId);
    if (partnerId) {
      const partner = byId.get(partnerId);
      if (partner && !used.has(partner.id)) members.push(partner);
    }
    const anchorIds = new Set(members.map((member) => member.id));
    for (const candidate of living) {
      if (used.has(candidate.id) || INDEPENDENT_LIFE_STAGES.has(candidate.lifeStage)) continue;
      const livingParents = (Array.isArray(candidate.relationships) ? candidate.relationships : [])
        .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.child)
        .map((relationship) => relationship.personId);
      if (livingParents.some((parentId) => anchorIds.has(parentId))) members.push(candidate);
    }
    for (const member of members) used.add(member.id);
    units.push(members);
  }
  return units;
}

function subgroupKeysForPerson(person) {
  const keys = [];
  for (const period of Array.isArray(person?.preferredVisitPeriods) ? person.preferredVisitPeriods : []) {
    keys.push(`visit:${period}`);
  }
  for (const [level, preferences] of Object.entries(person?.foodPreferences ?? {})) {
    for (const [tag, preference] of Object.entries(preferences ?? {})) {
      if (Number(preference) > 0) keys.push(`food:${level}:${tag}`);
    }
  }
  const pricePreference = personEconomyProfile(person).pricePreference;
  keys.push(`pricePreference:${pricePreference}`);
  return [...new Set(keys)];
}

function livingPartnerId(person, byId) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.partner)
    .map((relationship) => byId.get(relationship.personId))
    .find(isLivingPopulationPerson)?.id ?? null;
}

function pickWeightedIndex(weighted, key) {
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let cursor = stableUnit(key) * total;
  for (const item of weighted) {
    cursor -= item.weight;
    if (cursor <= 0) return item.index;
  }
  return weighted.at(-1).index;
}

function unitKey(members) { return members.map((person) => person.id).sort().join("|"); }
function pairKey(firstId, secondId) { return [firstId, secondId].sort().join("|"); }
function stableUnit(key) {
  let hash = 2166136261;
  for (const character of String(key ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}
function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number.isFinite(value) ? value : minimum));
}
function round(value) { return Math.round((Number(value) || 0) * 1_000_000) / 1_000_000; }
