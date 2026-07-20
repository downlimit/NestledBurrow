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

export const MOVEMENT_CONFIG_FIELDS = Object.freeze([
  "maxSpeed",
  "acceleration",
  "brakingDeceleration",
  "reverseAcceleration",
  "turnDeceleration",
  "facingTurnSpeed",
  "movingSpeedThreshold",
  "maxDeltaMs",
]);

export function cloneMovementConfig(config = DEFAULT_MOVEMENT_CONFIG) {
  return Object.fromEntries(MOVEMENT_CONFIG_FIELDS.map((key) => [key, config[key]]));
}
