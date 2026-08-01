export const GUEST_SPAWN_INTERVAL_MIN_MS = 3_000;
export const GUEST_SPAWN_INTERVAL_MAX_MS = 8_000;
export const GUEST_WAVE_MIN = 1;
export const GUEST_WAVE_MAX = 2;
export const GUEST_ACTIVE_CAP = 6;

export const DEFAULT_TAVERN_SERVICE_STATE = Object.freeze({
  nextGuestId: 0,
  spawnRemainingMs: GUEST_SPAWN_INTERVAL_MIN_MS,
  guests: Object.freeze([]),
});

export function sampleGuestSpawnDelay(randomSource = Math.random) {
  const unit = randomUnit(randomSource);
  return GUEST_SPAWN_INTERVAL_MIN_MS
    + unit * (GUEST_SPAWN_INTERVAL_MAX_MS - GUEST_SPAWN_INTERVAL_MIN_MS);
}

export function sampleGuestWaveSize(randomSource = Math.random) {
  return GUEST_WAVE_MIN + Math.floor(randomUnit(randomSource) * (GUEST_WAVE_MAX - GUEST_WAVE_MIN + 1));
}

export function allowedGuestWaveSize({
  requested,
  activeGuests,
  unreservedPortions,
  cap = GUEST_ACTIVE_CAP,
}) {
  return Math.max(0, Math.min(
    Math.max(0, Math.floor(Number(requested) || 0)),
    Math.max(0, cap - Math.max(0, Math.floor(Number(activeGuests) || 0))),
    Math.max(0, Math.floor(Number(unreservedPortions) || 0)),
  ));
}

export function normalizeTavernServiceState(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Tavern service state must be an object");
  const nextGuestId = nonNegativeInteger(value.nextGuestId, 0, "Next guest ID");
  const spawnRemainingMs = nonNegativeNumber(
    value.spawnRemainingMs,
    GUEST_SPAWN_INTERVAL_MIN_MS,
    "Guest spawn timer",
  );
  if (!Array.isArray(value.guests ?? [])) throw new Error("Tavern guests must be an array");
  const ids = new Set();
  const guests = [];
  for (const raw of value.guests ?? []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const id = String(raw.id ?? "");
    if (!/^tavern-guest-\d+$/.test(id) || ids.has(id)) continue;
    const x = Number(raw.position?.x);
    const y = Number(raw.position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    ids.add(id);
    guests.push({
      id,
      state: String(raw.state ?? "approaching-sign"),
      stateElapsedMs: nonNegativeNumber(raw.stateElapsedMs, 0, `Guest ${id} elapsed time`),
      position: { x, y },
      itemId: raw.itemId === "lemonade" || raw.itemId === "fried-potato-dish" ? raw.itemId : null,
      servingTableId: furnitureId(raw.servingTableId),
      diningTableId: furnitureId(raw.diningTableId),
      reservationActive: Boolean(raw.reservationActive),
      mealCompleted: Boolean(raw.mealCompleted),
      paid: Boolean(raw.paid),
    });
  }
  return { nextGuestId, spawnRemainingMs, guests };
}

function furnitureId(value) {
  if (value === undefined || value === null) return null;
  const id = String(value);
  if (!id || ["__proto__", "constructor", "prototype"].includes(id)) return null;
  return id;
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
