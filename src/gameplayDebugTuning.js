import { DEFAULT_GAMEPLAY_TUNING, normalizeGameplayTuning } from "./debrisConfig.js";

export const GAMEPLAY_DEBUG_STORAGE_KEY = "nestledBurrow.gameplayDebug";

export function loadGameplayDebugTuning({ enabled, storage = globalThis.localStorage } = {}) {
  if (!enabled) return normalizeGameplayTuning(DEFAULT_GAMEPLAY_TUNING);
  try {
    return normalizeGameplayTuning(JSON.parse(storage?.getItem(GAMEPLAY_DEBUG_STORAGE_KEY) ?? "{}"));
  } catch {
    return normalizeGameplayTuning(DEFAULT_GAMEPLAY_TUNING);
  }
}

export function saveGameplayDebugTuning(tuning, storage = globalThis.localStorage) {
  try {
    storage?.setItem(GAMEPLAY_DEBUG_STORAGE_KEY, JSON.stringify(normalizeGameplayTuning(tuning)));
  } catch {
    // Debug tuning persistence is optional.
  }
}

export function clearGameplayDebugTuning(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(GAMEPLAY_DEBUG_STORAGE_KEY);
  } catch {
    // Debug tuning persistence is optional.
  }
}
