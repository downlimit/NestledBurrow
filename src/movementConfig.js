import { PLAYER_SPEED } from "./worldConfig.js";

export const DEFAULT_MOVEMENT_CONFIG = Object.freeze({
  maxSpeed: PLAYER_SPEED,
  acceleration: 520,
  brakingDeceleration: 620,
  reverseAcceleration: 760,
  turnDeceleration: 420,
  facingTurnSpeed: 10,
  movingSpeedThreshold: 2,
  maxDeltaMs: 50,
});

export const MOVEMENT_TUNING_FIELDS = Object.freeze([
  Object.freeze({ key: "maxSpeed", min: 0, max: 300, step: 1 }),
  Object.freeze({ key: "acceleration", min: 0, max: 3000, step: 10 }),
  Object.freeze({ key: "brakingDeceleration", min: 0, max: 3000, step: 10 }),
  Object.freeze({ key: "reverseAcceleration", min: 0, max: 3000, step: 10 }),
  Object.freeze({ key: "turnDeceleration", min: 0, max: 3000, step: 10 }),
  Object.freeze({ key: "facingTurnSpeed", min: 0, max: 30, step: 0.5 }),
  Object.freeze({ key: "movingSpeedThreshold", min: 0, max: 50, step: 0.5 }),
  Object.freeze({ key: "maxDeltaMs", min: 1, max: 250, step: 1 }),
]);

export const MOVEMENT_CONFIG_FIELDS = Object.freeze(
  MOVEMENT_TUNING_FIELDS.map((field) => field.key),
);

export function cloneMovementConfig(config = DEFAULT_MOVEMENT_CONFIG) {
  return Object.fromEntries(MOVEMENT_CONFIG_FIELDS.map((key) => [key, config[key]]));
}

export function sanitizeMovementConfig(overrides = {}, base = DEFAULT_MOVEMENT_CONFIG) {
  const source = overrides && typeof overrides === "object" ? overrides : {};
  const result = cloneMovementConfig(base);

  for (const field of MOVEMENT_TUNING_FIELDS) {
    const value = Number(source[field.key]);
    if (!Number.isFinite(value)) continue;
    result[field.key] = clamp(value, field.min, field.max);
  }

  return result;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
