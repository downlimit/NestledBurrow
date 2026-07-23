import { TILE_SIZE } from "./worldConfig.js";

export const DEBRIS_OBJECT_ID = "fallen-log-01";
export const DEBRIS_INTERACTION_KIND = "clear-debris";
export const DEFAULT_GAMEPLAY_TUNING = Object.freeze({
  maximumEnergy: 100,
  clearingEnergyCost: 20,
  woodReward: 1,
});
export const DEBRIS_OBJECT = Object.freeze({
  id: DEBRIS_OBJECT_ID,
  entityId: DEBRIS_OBJECT_ID,
  kind: DEBRIS_INTERACTION_KIND,
  tile: Object.freeze({ x: 28, y: 31 }),
  position: Object.freeze({ x: 28 * TILE_SIZE + TILE_SIZE / 2, y: 31 * TILE_SIZE + TILE_SIZE / 2 }),
  radius: 24,
  priority: 1,
  requiresFacing: true,
  facingDotThreshold: 0,
  prompt: "hud:interaction.clear",
  payload: Object.freeze({ debrisId: DEBRIS_OBJECT_ID }),
});

export function normalizeGameplayTuning(value = {}) {
  const maximumEnergy = normalizeInteger(value.maximumEnergy, DEFAULT_GAMEPLAY_TUNING.maximumEnergy, 1, 999);
  return {
    maximumEnergy,
    clearingEnergyCost: normalizeInteger(value.clearingEnergyCost, DEFAULT_GAMEPLAY_TUNING.clearingEnergyCost, 0, 999),
    woodReward: normalizeInteger(value.woodReward, DEFAULT_GAMEPLAY_TUNING.woodReward, 0, 999),
  };
}

function normalizeInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}
