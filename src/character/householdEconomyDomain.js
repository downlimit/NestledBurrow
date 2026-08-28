import {
  isLivingPopulationPerson,
  PERSON_GAME_DAY_SECONDS,
  PERSON_LIFE_STAGES,
  PERSON_RELATIONSHIP_KINDS,
  SPENDING_CAPACITY_VALUES,
} from "./populationDomain.js";
import { spendingCapacityIndex } from "./populationWealthBalance.js";

export const HOUSEHOLD_REFERENCE_SAVINGS = Object.freeze([5_000, 15_000, 45_000, 120_000, 300_000]);
export const HOUSEHOLD_DAILY_INCOME_PER_WORKER = Object.freeze([500, 1_500, 4_000, 10_000, 25_000]);
export const HOUSEHOLD_INCOME_VARIATION = 0.1;
export const HOUSEHOLD_EXPENSE_VARIATION = 0.08;
export const HOUSEHOLD_MIN_DISCRETIONARY_SCALE = 0.2;
export const HOUSEHOLD_NORMAL_DISCRETIONARY_SCALE = 0.75;
export const HOUSEHOLD_MAX_DISCRETIONARY_SCALE = 2.5;

const DEPENDENT_STAGES = new Set([
  PERSON_LIFE_STAGES.newborn,
  PERSON_LIFE_STAGES.infant,
  PERSON_LIFE_STAGES.toddler,
  PERSON_LIFE_STAGES.child,
  PERSON_LIFE_STAGES.teen,
]);
const WORKER_STAGES = new Set([PERSON_LIFE_STAGES.youngAdult, PERSON_LIFE_STAGES.adult]);
const ADULT_STAGES = new Set([
  PERSON_LIFE_STAGES.youngAdult,
  PERSON_LIFE_STAGES.adult,
  PERSON_LIFE_STAGES.elder,
]);

export function createHouseholdEconomy(population, worldTimeSeconds = 0) {
  return normalizeHouseholdEconomy(null, population, { worldTimeSeconds });
}

export function normalizeHouseholdEconomy(value, population, {
  worldTimeSeconds = 0,
  validReservationIds = null,
} = {}) {
  const currentAssignments = deriveHouseholdAssignments(population);
  const currentMembers = membersByHousehold(currentAssignments);
  const raw = isPlainRecord(value) ? value : {};
  const oldAssignments = normalizeAssignments(raw.personHouseholdIds);
  const oldHouseholds = normalizeHouseholds(raw.households, validReservationIds);
  const lastProcessedWorldTimeSeconds = nonNegativeNumber(
    raw.lastProcessedWorldTimeSeconds,
    nonNegativeNumber(worldTimeSeconds, 0),
  );

  if (sameAssignments(oldAssignments, currentAssignments)
    && householdsCoverAssignments(oldHouseholds, currentMembers)) {
    return {
      lastProcessedWorldTimeSeconds,
      households: ensureCurrentHouseholdDefaults(oldHouseholds, currentMembers, population),
      personHouseholdIds: currentAssignments,
    };
  }

  const households = reconcileHouseholds(oldHouseholds, oldAssignments, currentAssignments, currentMembers, population);
  return { lastProcessedWorldTimeSeconds, households, personHouseholdIds: currentAssignments };
}

export function reconcileHouseholdEconomy(economy, population, worldTimeSeconds = null) {
  const normalized = normalizeHouseholdEconomy(economy, population, {
    worldTimeSeconds: worldTimeSeconds ?? economy?.lastProcessedWorldTimeSeconds ?? 0,
  });
  replaceEconomyState(economy, normalized);
  return economy;
}

export function advanceHouseholdEconomy(economy, population, targetWorldTimeSeconds) {
  if (!isPlainRecord(economy)) throw new Error("Household economy state is required");
  reconcileHouseholdEconomy(economy, population, targetWorldTimeSeconds);
  const targetTime = nonNegativeNumber(targetWorldTimeSeconds, economy.lastProcessedWorldTimeSeconds);
  const elapsed = Math.max(0, targetTime - economy.lastProcessedWorldTimeSeconds);
  const daysProcessed = Math.floor(elapsed / PERSON_GAME_DAY_SECONDS);
  if (daysProcessed <= 0) return { daysProcessed: 0, income: 0, expenses: 0 };

  let income = 0;
  let expenses = 0;
  const members = membersByHousehold(economy.personHouseholdIds);
  const byId = new Map((Array.isArray(population) ? population : [])
    .filter((person) => person?.id)
    .map((person) => [person.id, person]));
  const firstDayIndex = Math.floor(economy.lastProcessedWorldTimeSeconds / PERSON_GAME_DAY_SECONDS);

  for (let dayOffset = 1; dayOffset <= daysProcessed; dayOffset += 1) {
    const dayIndex = firstDayIndex + dayOffset;
    for (const [householdId, memberIds] of Object.entries(members)) {
      const people = memberIds.map((personId) => byId.get(personId)).filter(isLivingPopulationPerson);
      if (people.length === 0) continue;
      const household = economy.households[householdId]
        ?? (economy.households[householdId] = createInitialHousehold(people));
      const profile = householdDailyProfile(people);
      const lockedCoins = reservedCoins(household);
      const freeCoins = Math.max(0, household.coins - lockedCoins);
      const reserveRatio = profile.reserveTarget > 0 ? freeCoins / profile.reserveTarget : 1;
      const incomeMultiplier = dailyMultiplier(
        `${householdId}:income:${dayIndex}`,
        HOUSEHOLD_INCOME_VARIATION,
      );
      const expenseMultiplier = dailyMultiplier(
        `${householdId}:expenses:${dayIndex}`,
        HOUSEHOLD_EXPENSE_VARIATION,
      );
      const actualIncome = roundCoins(profile.income * incomeMultiplier);
      const discretionaryScale = discretionaryScaleForReserveRatio(reserveRatio);
      const actualExpenses = roundCoins((
        profile.mandatoryExpenses
        + profile.discretionaryExpenses * discretionaryScale
      ) * expenseMultiplier);
      household.coins = roundCoins(
        lockedCoins + Math.max(0, freeCoins + actualIncome - actualExpenses),
      );
      income += actualIncome;
      expenses += Math.min(actualExpenses, freeCoins + actualIncome);
    }
  }

  economy.lastProcessedWorldTimeSeconds += daysProcessed * PERSON_GAME_DAY_SECONDS;
  return {
    daysProcessed,
    income: roundCoins(income),
    expenses: roundCoins(expenses),
  };
}

export function householdIdForPerson(economy, personId) {
  return typeof economy?.personHouseholdIds?.[personId] === "string"
    ? economy.personHouseholdIds[personId]
    : null;
}

export function householdSnapshotForPerson(economy, personId) {
  const householdId = householdIdForPerson(economy, personId);
  const household = householdId ? economy?.households?.[householdId] : null;
  if (!household) return null;
  return {
    householdId,
    coins: household.coins,
    reservedCoins: reservedCoins(household),
    availableCoins: availableCoinsFromHousehold(household),
  };
}

export function householdFinancialProfileForPerson(economy, population, personId) {
  const snapshot = householdSnapshotForPerson(economy, personId);
  if (!snapshot) return null;
  const memberIds = Object.entries(economy?.personHouseholdIds ?? {})
    .filter(([, householdId]) => householdId === snapshot.householdId)
    .map(([memberId]) => memberId);
  const byId = new Map((Array.isArray(population) ? population : [])
    .filter((person) => person?.id)
    .map((person) => [person.id, person]));
  const people = memberIds.map((memberId) => byId.get(memberId)).filter(isLivingPopulationPerson);
  const profile = householdDailyProfile(people);
  return {
    ...snapshot,
    wealthIndex: profile.wealthIndex,
    dailyIncome: profile.income,
    reserveTarget: profile.reserveTarget,
  };
}

export function householdAvailableCoins(economy, personId) {
  return householdSnapshotForPerson(economy, personId)?.availableCoins ?? 0;
}

export function reserveHouseholdPurchase(economy, population, {
  personId,
  reservationId,
  amount,
} = {}) {
  if (!nonEmptyString(personId) || !nonEmptyString(reservationId)) {
    return { status: "invalid-reservation", reserved: false };
  }
  reconcileHouseholdEconomy(economy, population);
  const householdId = householdIdForPerson(economy, personId);
  const household = householdId ? economy.households[householdId] : null;
  if (!household) return { status: "unknown-household", reserved: false };
  const price = positiveAmount(amount);
  if (price === null) return { status: "invalid-amount", reserved: false };
  const existing = household.reservations[reservationId];
  if (existing) {
    return existing.personId === personId && existing.amount === price
      ? { status: "already-reserved", reserved: true, householdId, amount: price }
      : { status: "reservation-conflict", reserved: false };
  }
  if (availableCoinsFromHousehold(household) + 1e-9 < price) {
    return { status: "insufficient-household-funds", reserved: false, householdId, amount: price };
  }
  household.reservations[reservationId] = { personId, amount: price };
  return { status: "reserved", reserved: true, householdId, amount: price };
}

export function releaseHouseholdPurchase(economy, reservationId) {
  if (!nonEmptyString(reservationId) || !isPlainRecord(economy?.households)) return false;
  for (const household of Object.values(economy.households)) {
    if (!isPlainRecord(household?.reservations) || !household.reservations[reservationId]) continue;
    delete household.reservations[reservationId];
    return true;
  }
  return false;
}

export function settleHouseholdPurchase(economy, reservationId) {
  if (!nonEmptyString(reservationId) || !isPlainRecord(economy?.households)) {
    return { status: "unknown-reservation", settled: false };
  }
  for (const [householdId, household] of Object.entries(economy.households)) {
    const reservation = household?.reservations?.[reservationId];
    if (!reservation) continue;
    household.coins = roundCoins(Math.max(0, household.coins - reservation.amount));
    delete household.reservations[reservationId];
    return {
      status: "settled",
      settled: true,
      householdId,
      personId: reservation.personId,
      amount: reservation.amount,
      coins: household.coins,
    };
  }
  return { status: "unknown-reservation", settled: false };
}

export function ensureHouseholdPurchaseReservation(economy, population, reservation) {
  return reserveHouseholdPurchase(economy, population, reservation);
}

export function tavernHouseholdReservationId(personId) {
  return `tavern:${String(personId ?? "").trim()}`;
}

export function householdDailyProfile(people) {
  const living = (Array.isArray(people) ? people : []).filter(isLivingPopulationPerson);
  const wealthIndex = householdWealthIndex(living);
  let workerUnits = living.reduce((sum, person) => sum + workerIncomeUnits(person), 0);
  if (workerUnits <= 0 && living.length > 0) workerUnits = 0.35;
  const adultCount = living.filter((person) => ADULT_STAGES.has(person.lifeStage)).length;
  const dependentCount = living.filter((person) => DEPENDENT_STAGES.has(person.lifeStage)).length;
  const income = roundCoins(workerUnits * HOUSEHOLD_DAILY_INCOME_PER_WORKER[wealthIndex]);
  const householdScale = clamp(0.6 + adultCount * 0.15 + dependentCount * 0.1, 0.7, 1.4);
  const reserveTarget = roundCoins(HOUSEHOLD_REFERENCE_SAVINGS[wealthIndex] * householdScale);
  const mandatoryShare = clamp(
    0.55 + Math.max(0, adultCount - 1) * 0.03 + dependentCount * 0.08,
    0.55,
    0.84,
  );
  const mandatoryExpenses = roundCoins(income * mandatoryShare);
  const discretionaryExpenses = roundCoins(Math.max(0, income - mandatoryExpenses));
  return {
    wealthIndex,
    workerUnits,
    adultCount,
    dependentCount,
    income,
    mandatoryExpenses,
    discretionaryExpenses,
    expenses: roundCoins(mandatoryExpenses + discretionaryExpenses),
    reserveTarget,
  };
}

export function discretionaryScaleForReserveRatio(reserveRatio) {
  const ratio = Math.max(0, Number(reserveRatio) || 0);
  if (ratio <= 1) {
    return roundCoins(HOUSEHOLD_MIN_DISCRETIONARY_SCALE
      + (HOUSEHOLD_NORMAL_DISCRETIONARY_SCALE - HOUSEHOLD_MIN_DISCRETIONARY_SCALE) * ratio);
  }
  return roundCoins(Math.min(
    HOUSEHOLD_MAX_DISCRETIONARY_SCALE,
    HOUSEHOLD_NORMAL_DISCRETIONARY_SCALE + (ratio - 1) * 1.5,
  ));
}

export function deriveHouseholdAssignments(population) {
  const living = (Array.isArray(population) ? population : []).filter(isLivingPopulationPerson);
  const byId = new Map(living.map((person) => [person.id, person]));
  const independentHouseholdByPersonId = {};
  for (const person of living) {
    if (DEPENDENT_STAGES.has(person.lifeStage)) continue;
    const partner = livingPartner(person, byId);
    independentHouseholdByPersonId[person.id] = partner
      ? householdIdForAnchor([person.id, partner.id].sort()[0])
      : householdIdForAnchor(person.id);
  }

  const assignments = {};
  for (const person of living) {
    if (!DEPENDENT_STAGES.has(person.lifeStage)) {
      assignments[person.id] = independentHouseholdByPersonId[person.id] ?? householdIdForAnchor(person.id);
      continue;
    }
    const livingParents = parentIds(person)
      .map((parentId) => byId.get(parentId))
      .filter(isLivingPopulationPerson)
      .sort((first, second) => first.id.localeCompare(second.id));
    const parentHousehold = livingParents
      .map((parent) => independentHouseholdByPersonId[parent.id])
      .find(Boolean);
    assignments[person.id] = parentHousehold ?? householdIdForAnchor(person.id);
  }
  return assignments;
}

function reconcileHouseholds(oldHouseholds, oldAssignments, currentAssignments, currentMembers, population) {
  if (Object.keys(oldHouseholds).length === 0 || Object.keys(oldAssignments).length === 0) {
    return createInitialHouseholds(currentMembers, population);
  }
  const contributions = {};
  const currentTargetCountsByOld = new Map();
  for (const [personId, oldHouseholdId] of Object.entries(oldAssignments)) {
    const targetId = currentAssignments[personId];
    if (!targetId || !oldHouseholds[oldHouseholdId]) continue;
    if (!currentTargetCountsByOld.has(oldHouseholdId)) currentTargetCountsByOld.set(oldHouseholdId, new Map());
    const counts = currentTargetCountsByOld.get(oldHouseholdId);
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1);
  }

  for (const [oldHouseholdId, household] of Object.entries(oldHouseholds)) {
    const counts = currentTargetCountsByOld.get(oldHouseholdId);
    if (!counts || counts.size === 0) continue;
    const routedReservations = new Map();
    let routedReservedTotal = 0;
    for (const [reservationId, reservation] of Object.entries(household.reservations)) {
      const targetId = currentAssignments[reservation.personId];
      if (!targetId || !counts.has(targetId)) continue;
      if (!routedReservations.has(targetId)) routedReservations.set(targetId, {});
      routedReservations.get(targetId)[reservationId] = { ...reservation };
      routedReservedTotal += reservation.amount;
    }
    const unreservedPool = Math.max(0, household.coins - routedReservedTotal);
    const totalMemberCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
    for (const [targetId, memberCount] of counts) {
      const reservations = routedReservations.get(targetId) ?? {};
      const targetReserved = Object.values(reservations).reduce((sum, item) => sum + item.amount, 0);
      const share = totalMemberCount > 0 ? memberCount / totalMemberCount : 0;
      const coins = roundCoins(targetReserved + unreservedPool * share);
      contributions[targetId] ??= [];
      contributions[targetId].push({ coins, reservations });
    }
  }

  const byId = new Map((Array.isArray(population) ? population : []).map((person) => [person?.id, person]));
  const households = {};
  for (const [householdId, memberIds] of Object.entries(currentMembers)) {
    const people = memberIds.map((personId) => byId.get(personId)).filter(isLivingPopulationPerson);
    const items = contributions[householdId] ?? [];
    if (items.length === 0) {
      households[householdId] = createInitialHousehold(people);
      continue;
    }
    const reservations = {};
    for (const item of items) Object.assign(reservations, item.reservations);
    households[householdId] = {
      coins: roundCoins(items.reduce((sum, item) => sum + item.coins, 0)),
      reservations,
    };
  }
  return households;
}

function createInitialHouseholds(currentMembers, population) {
  const byId = new Map((Array.isArray(population) ? population : []).map((person) => [person?.id, person]));
  return Object.fromEntries(Object.entries(currentMembers).map(([householdId, memberIds]) => {
    const people = memberIds.map((personId) => byId.get(personId)).filter(isLivingPopulationPerson);
    return [householdId, createInitialHousehold(people)];
  }));
}

function createInitialHousehold(people) {
  const profile = householdDailyProfile(people);
  const key = people.map((person) => person.id).sort().join("|");
  const multiplier = 0.8 + stableUnit(`initial-household-savings:${key}`) * 0.4;
  return { coins: roundCoins(profile.reserveTarget * multiplier), reservations: {} };
}

function ensureCurrentHouseholdDefaults(households, currentMembers, population) {
  const byId = new Map((Array.isArray(population) ? population : []).map((person) => [person?.id, person]));
  const result = {};
  for (const [householdId, memberIds] of Object.entries(currentMembers)) {
    const people = memberIds.map((personId) => byId.get(personId)).filter(isLivingPopulationPerson);
    result[householdId] = households[householdId] ?? createInitialHousehold(people);
  }
  return result;
}

function householdWealthIndex(people) {
  const adults = people.filter((person) => ADULT_STAGES.has(person.lifeStage));
  const source = adults.length > 0 ? adults : people;
  if (source.length === 0) return 0;
  const average = source.reduce((sum, person) => sum + spendingCapacityIndex(person.spendingCapacity), 0) / source.length;
  return Math.max(0, Math.min(SPENDING_CAPACITY_VALUES.length - 1, Math.round(average)));
}

function workerIncomeUnits(person) {
  if (WORKER_STAGES.has(person?.lifeStage)) return 1;
  if (person?.lifeStage === PERSON_LIFE_STAGES.elder) return 0.75;
  return 0;
}

function livingPartner(person, byId) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.partner)
    .map((relationship) => byId.get(relationship.personId))
    .find(isLivingPopulationPerson) ?? null;
}

function parentIds(person) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.child)
    .map((relationship) => relationship.personId);
}

function membersByHousehold(assignments) {
  const members = {};
  for (const [personId, householdId] of Object.entries(assignments ?? {})) {
    if (!nonEmptyString(personId) || !nonEmptyString(householdId)) continue;
    members[householdId] ??= [];
    members[householdId].push(personId);
  }
  for (const memberIds of Object.values(members)) memberIds.sort();
  return members;
}

function normalizeHouseholds(value, validReservationIds) {
  if (!isPlainRecord(value)) return {};
  const allowed = Array.isArray(validReservationIds) ? new Set(validReservationIds) : null;
  const result = {};
  for (const [householdId, household] of Object.entries(value)) {
    if (!nonEmptyString(householdId) || !isPlainRecord(household)) continue;
    const coins = nonNegativeNumber(household.coins, 0);
    const reservations = {};
    let reserved = 0;
    if (isPlainRecord(household.reservations)) {
      for (const [reservationId, reservation] of Object.entries(household.reservations)) {
        if (allowed && !allowed.has(reservationId)) continue;
        if (!nonEmptyString(reservationId) || !isPlainRecord(reservation) || !nonEmptyString(reservation.personId)) continue;
        const amount = positiveAmount(reservation.amount);
        if (amount === null || reserved + amount > coins + 1e-9) continue;
        reservations[reservationId] = { personId: reservation.personId, amount };
        reserved += amount;
      }
    }
    result[householdId] = { coins: roundCoins(coins), reservations };
  }
  return result;
}

function normalizeAssignments(value) {
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([personId, householdId]) => nonEmptyString(personId) && nonEmptyString(householdId)));
}

function sameAssignments(first, second) {
  const firstEntries = Object.entries(first ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const secondEntries = Object.entries(second ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(firstEntries) === JSON.stringify(secondEntries);
}

function householdsCoverAssignments(households, members) {
  return Object.keys(members).every((householdId) => isPlainRecord(households?.[householdId]));
}

function replaceEconomyState(target, source) {
  if (!isPlainRecord(target)) return;
  target.lastProcessedWorldTimeSeconds = source.lastProcessedWorldTimeSeconds;
  target.households = source.households;
  target.personHouseholdIds = source.personHouseholdIds;
}

function availableCoinsFromHousehold(household) {
  return roundCoins(Math.max(0, nonNegativeNumber(household?.coins, 0) - reservedCoins(household)));
}

function reservedCoins(household) {
  return roundCoins(Object.values(household?.reservations ?? {})
    .reduce((sum, reservation) => sum + nonNegativeNumber(reservation?.amount, 0), 0));
}

function dailyMultiplier(key, variation) {
  const amount = clamp(Number(variation), 0, 0.5);
  return 1 - amount + stableUnit(key) * amount * 2;
}

function householdIdForAnchor(personId) { return `household:${personId}`; }
function positiveAmount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? roundCoins(number) : null;
}
function nonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function nonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
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
function roundCoins(value) { return Math.round((Number(value) || 0) * 1000) / 1000; }
