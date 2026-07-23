export const FIRST_DEBRIS_ID = "fallen-log-001";
export const FIRST_DEBRIS_ENTITY_ID = FIRST_DEBRIS_ID;
export const FIRST_DEBRIS_INTERACTION_ID = `clear-${FIRST_DEBRIS_ID}`;
export const FIRST_DEBRIS_CELL = Object.freeze({ x: 28, y: 32 });
export const FIRST_DEBRIS_POSITION = Object.freeze({ x: FIRST_DEBRIS_CELL.x * 16 + 8, y: FIRST_DEBRIS_CELL.y * 16 + 8 });
export const GAMEPLAY_TUNING_DEFAULTS = Object.freeze({ maxEnergy: 100, clearEnergyCost: 20, woodReward: 1 });
export const GAMEPLAY_DEBUG_STORAGE_KEY = "nestledBurrow.gameplayDebug";

export function createDefaultGameplayState(tuning = GAMEPLAY_TUNING_DEFAULTS) {
  const maxEnergy = normalizePositiveInt(tuning.maxEnergy, GAMEPLAY_TUNING_DEFAULTS.maxEnergy);
  return { energy: { current: maxEnergy, max: maxEnergy }, resources: { wood: 0 }, debris: { [FIRST_DEBRIS_ID]: { cleared: false } } };
}

export function normalizeGameplayTuning(value = {}) {
  return {
    maxEnergy: normalizePositiveInt(value.maxEnergy, GAMEPLAY_TUNING_DEFAULTS.maxEnergy),
    clearEnergyCost: normalizeNonNegativeInt(value.clearEnergyCost, GAMEPLAY_TUNING_DEFAULTS.clearEnergyCost),
    woodReward: normalizeNonNegativeInt(value.woodReward, GAMEPLAY_TUNING_DEFAULTS.woodReward),
  };
}

export function loadGameplayDebugTuning({ enabled, storage = globalThis.localStorage } = {}) {
  if (!enabled) return normalizeGameplayTuning();
  try { return normalizeGameplayTuning(JSON.parse(storage?.getItem(GAMEPLAY_DEBUG_STORAGE_KEY) ?? "{}")); }
  catch { return normalizeGameplayTuning(); }
}

export function persistGameplayDebugTuning(tuning, storage = globalThis.localStorage) {
  try { storage?.setItem(GAMEPLAY_DEBUG_STORAGE_KEY, JSON.stringify(normalizeGameplayTuning(tuning))); } catch {}
}

export function clearGameplayDebugTuning(storage = globalThis.localStorage) { try { storage?.removeItem(GAMEPLAY_DEBUG_STORAGE_KEY); } catch {} }

export function isFirstDebrisCleared(state) { return state.gameplay?.debris?.[FIRST_DEBRIS_ID]?.cleared === true; }

export function clearFirstDebris(state, tuning = GAMEPLAY_TUNING_DEFAULTS) {
  const config = normalizeGameplayTuning(tuning);
  if (isFirstDebrisCleared(state)) return { status: "already-cleared", mutated: false };
  if (state.gameplay.energy.current < config.clearEnergyCost) return { status: "insufficient-energy", mutated: false };
  state.gameplay.energy.current -= config.clearEnergyCost;
  state.gameplay.resources.wood += config.woodReward;
  state.gameplay.debris[FIRST_DEBRIS_ID].cleared = true;
  return { status: "cleared", mutated: true, energyCost: config.clearEnergyCost, woodReward: config.woodReward };
}

export function applyMaxEnergy(state, maxEnergy) {
  const next = normalizePositiveInt(maxEnergy, GAMEPLAY_TUNING_DEFAULTS.maxEnergy);
  state.gameplay.energy.max = next;
  state.gameplay.energy.current = Math.min(state.gameplay.energy.current, next);
  return next;
}

export function refillEnergy(state) { state.gameplay.energy.current = state.gameplay.energy.max; }

function normalizePositiveInt(value, fallback) { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 1 ? n : fallback; }
function normalizeNonNegativeInt(value, fallback) { const n = Math.floor(Number(value)); return Number.isFinite(n) && n >= 0 ? n : fallback; }
