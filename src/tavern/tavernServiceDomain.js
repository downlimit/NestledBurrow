import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";

export const VISIT_OPPORTUNITY_INTERVAL_MIN_MS = 3_000;
export const VISIT_OPPORTUNITY_INTERVAL_MAX_MS = 8_000;
export const GUEST_ACTIVE_CAP = 6;

export const DEFAULT_TAVERN_SERVICE_STATE = Object.freeze({
  nextGuestId: 0,
  opportunityRemainingMs: VISIT_OPPORTUNITY_INTERVAL_MIN_MS,
  visitorHistoryByPersonId: Object.freeze({}),
  guests: Object.freeze([]),
});

export function sampleVisitOpportunityDelay(randomSource = Math.random) {
  const unit = randomUnit(randomSource);
  return VISIT_OPPORTUNITY_INTERVAL_MIN_MS
    + unit * (VISIT_OPPORTUNITY_INTERVAL_MAX_MS - VISIT_OPPORTUNITY_INTERVAL_MIN_MS);
}

export function normalizeTavernServiceState(value = {}, { population = [] } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tavern service state must be an object");
  const nextGuestId = nonNegativeInteger(value.nextGuestId, 0, "Next guest ID");
  const opportunityRemainingMs = nonNegativeNumber(
    value.opportunityRemainingMs ?? value.spawnRemainingMs,
    VISIT_OPPORTUNITY_INTERVAL_MIN_MS,
    "Visit opportunity timer",
  );
  const populationIds = population.map((person) => person?.id).filter(isSafePersonId);
  const validPersonIds = new Set(populationIds);
  const visitorHistoryByPersonId = normalizeVisitorHistory(value.visitorHistoryByPersonId, validPersonIds);
  if (!Array.isArray(value.guests ?? [])) throw new Error("Tavern guests must be an array");
  const ids = new Set();
  const activePersonIds = new Set();
  const guests = [];
  for (const raw of value.guests ?? []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const id = String(raw.id ?? "");
    if (!/^tavern-guest-\d+$/.test(id) || ids.has(id)) continue;
    const x = Number(raw.position?.x);
    const y = Number(raw.position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const requestedPersonId = isSafePersonId(raw.personId) ? raw.personId : null;
    const personId = requestedPersonId
      && (validPersonIds.size === 0 || validPersonIds.has(requestedPersonId))
      && !activePersonIds.has(requestedPersonId)
      ? requestedPersonId
      : populationIds.find((candidateId) => !activePersonIds.has(candidateId));
    if (!personId) continue;
    ids.add(id);
    activePersonIds.add(personId);
    const itemId = SELLABLE_ITEM_IDS.includes(raw.itemId) ? raw.itemId : null;
    guests.push({
      id,
      personId,
      state: String(raw.state ?? "approaching-sign"),
      stateElapsedMs: nonNegativeNumber(raw.stateElapsedMs, 0, `Guest ${id} elapsed time`),
      position: { x, y },
      itemId,
      acceptableItemIds: normalizeAcceptableItemIds(raw.acceptableItemIds, itemId),
      servingTableId: furnitureId(raw.servingTableId),
      diningTableId: furnitureId(raw.diningTableId),
      reservationActive: Boolean(raw.reservationActive),
      mealCompleted: Boolean(raw.mealCompleted),
      paid: Boolean(raw.paid),
    });
  }
  return { nextGuestId, opportunityRemainingMs, visitorHistoryByPersonId, guests };
}

export function recordCompletedVisit(serviceState, personId, worldTimeSeconds) {
  if (!isSafePersonId(personId)) return { status: "invalid-person", mutated: false, history: null };
  serviceState.visitorHistoryByPersonId ??= {};
  const previous = normalizeHistoryEntry(serviceState.visitorHistoryByPersonId[personId]);
  const history = {
    completedVisitCount: previous.completedVisitCount + 1,
    lastCompletedVisitWorldTimeSeconds: nonNegativeNumber(worldTimeSeconds, 0, "Completed visit time"),
  };
  serviceState.visitorHistoryByPersonId[personId] = history;
  return { status: "completed-visit-recorded", mutated: true, history: { ...history } };
}

function normalizeVisitorHistory(value, validPersonIds) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(Object.entries(source)
    .filter(([personId]) => isSafePersonId(personId) && (validPersonIds.size === 0 || validPersonIds.has(personId)))
    .map(([personId, history]) => [personId, normalizeHistoryEntry(history)]));
}

function normalizeHistoryEntry(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const completedVisitCount = nonNegativeInteger(source.completedVisitCount, 0, "Completed visit count");
  const lastVisit = source.lastCompletedVisitWorldTimeSeconds;
  const lastCompletedVisitWorldTimeSeconds = Number.isFinite(lastVisit) && lastVisit >= 0 ? lastVisit : null;
  return { completedVisitCount, lastCompletedVisitWorldTimeSeconds };
}

function normalizeAcceptableItemIds(value, fallbackItemId = null) {
  const requested = new Set(Array.isArray(value) ? value : fallbackItemId ? [fallbackItemId] : SELLABLE_ITEM_IDS);
  return SELLABLE_ITEM_IDS.filter((itemId) => requested.has(itemId));
}

function furnitureId(value) {
  if (value === undefined || value === null) return null;
  const id = String(value);
  if (!id || ["__proto__", "constructor", "prototype"].includes(id)) return null;
  return id;
}

function isSafePersonId(value) {
  return typeof value === "string" && /^person-[a-z0-9-]+$/i.test(value)
    && !["__proto__", "constructor", "prototype"].includes(value);
}

function randomUnit(randomSource) {
  const value = Number(randomSource?.());
  return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
}

function nonNegativeInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function nonNegativeNumber(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
  return value;
}
