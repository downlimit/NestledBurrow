import assert from "node:assert/strict";
import {
  applyBlockedAxes,
  createMovementState,
  createRuntimeMovementConfig,
  energyTargetSpeedMultiplier,
  movementDelta,
  movementSpeed,
  stepCharacterMovement,
  stepSpeedMultiplier,
} from "../src/characterMovement.js";
import { getActorProfile } from "../src/actorProfiles.js";
import { DEFAULT_MOVEMENT_CONFIG, sanitizeMovementConfig } from "../src/movementConfig.js";

const config = { ...DEFAULT_MOVEMENT_CONFIG };
const close = (a, b, epsilon = 0.001) => Math.abs(a - b) <= epsilon;

assert.equal(energyTargetSpeedMultiplier(25, 100), 1);
assert(close(energyTargetSpeedMultiplier(13, 100), 0.8125));
assert(close(energyTargetSpeedMultiplier(5, 100), 0.4791667));
assert.equal(energyTargetSpeedMultiplier(1, 100), 0.25);
assert.equal(energyTargetSpeedMultiplier(0, 100), 0.25);
assert.equal(energyTargetSpeedMultiplier(50, 200), 1, "energy curve uses maximumEnergy instead of absolute points");
const firstFatigueFrame = stepSpeedMultiplier(1, 0.25, 16);
assert(firstFatigueFrame < 1 && firstFatigueFrame > 0.25, "effective multiplier starts moving without jumping to target");
assert.equal(stepSpeedMultiplier(firstFatigueFrame, 0.25, 500), 0.25, "effective multiplier reaches the target after enough time");
assert.equal(stepSpeedMultiplier(0.25, 1, 500), 1, "recovered speed returns smoothly to its target");

let state = stepMany(createMovementState(), { x: 1, y: 1 }, 1000);
assert(movementSpeed(state) <= config.maxSpeed + 0.001, "diagonal movement has no speed boost");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
assert(close(movementSpeed(state), config.maxSpeed), "movement reaches max speed");

const moving = state;
state = stepCharacterMovement(state, { x: 0, y: 0 }, 16, { config });
assert(movementSpeed(state) < movementSpeed(moving), "released input starts gradual braking");
assert(movementSpeed(state) > 0, "released input does not stop instantly");
state = stepMany(state, { x: 0, y: 0 }, 1000);
assert(close(movementSpeed(state), 0), "released input eventually stops");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
let reversed = stepCharacterMovement(state, { x: -1, y: 0 }, 16, { config });
assert(reversed.velocity.x > 0, "sharp reverse does not instantly invert velocity");
let closestToZero = Math.abs(reversed.velocity.x);
for (let elapsed = 0; elapsed < 500 && reversed.velocity.x >= 0; elapsed += 1) {
  reversed = stepCharacterMovement(reversed, { x: -1, y: 0 }, 1, { config });
  closestToZero = Math.min(closestToZero, Math.abs(reversed.velocity.x));
}
assert(reversed.velocity.x < 0, "sharp reverse reaches the opposite direction");
assert(closestToZero <= 1, "sharp reverse passes continuously through near-zero speed");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
const turned = stepMany(state, { x: 0, y: 1 }, 120);
assert(turned.velocity.x > 0 && turned.velocity.y > 0, "90 degree turn blends old and new velocity");
assert(turned.velocity.x < state.velocity.x, "90 degree turn decelerates the old axis");
assert(movementSpeed(turned) <= config.maxSpeed + 0.001, "turning respects max speed");

const permissiveTurnConfig = {
  ...config,
  acceleration: 3000,
  turnDeceleration: 0,
};
state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000, permissiveTurnConfig);
state = stepMany(state, { x: 0, y: 1 }, 100, permissiveTurnConfig);
assert(
  movementSpeed(state) <= permissiveTurnConfig.maxSpeed + 0.001,
  "max speed remains invariant under extreme tuning values",
);

const half = stepMany(createMovementState(), { x: 0.5, y: 0 }, 1000);
assert(close(movementSpeed(half), config.maxSpeed * 0.5), "analog strength scales target speed");

state = stepMany(createMovementState(), { x: 1, y: 1 }, 1000);
const blocked = applyBlockedAxes(state, { x: true, y: false });
assert.equal(blocked.velocity.x, 0, "blocked axis component is zeroed");
assert(blocked.velocity.y > 0, "unblocked axis preserves sliding velocity");

state = createMovementState({ facing: { x: 0, y: 1 } });
const aimed = stepCharacterMovement(state, { x: 1, y: 0 }, 16, {
  config,
  aimDirection: { x: 0, y: -1 },
});
assert(aimed.velocity.x > 0, "movement can differ from aim direction");
assert(aimed.aimDirection.y < -0.99, "aim is stored independently as a continuous vector");

const frozenFacing = stepCharacterMovement(state, { x: 1, y: 0 }, 16, {
  config: { ...config, facingTurnSpeed: 0 },
});
assert.deepEqual(
  frozenFacing.facingDirection,
  state.facingDirection,
  "zero facing turn speed preserves the current facing",
);

const smallDelta = stepCharacterMovement(createMovementState(), { x: 1, y: 0 }, config.maxDeltaMs, {
  config,
});
const hugeDelta = stepCharacterMovement(createMovementState(), { x: 1, y: 0 }, 10_000, { config });
assert.deepEqual(hugeDelta.velocity, smallDelta.velocity, "large simulation delta is capped");
assert.deepEqual(
  movementDelta(hugeDelta, 10_000, config),
  movementDelta(hugeDelta, config.maxDeltaMs, config),
  "large displacement delta is capped by the same rule",
);

assert.deepEqual(
  createRuntimeMovementConfig({ maxSpeed: -20, maxDeltaMs: 9999, acceleration: Number.NaN }),
  sanitizeMovementConfig({ maxSpeed: -20, maxDeltaMs: 9999, acceleration: Number.NaN }),
  "runtime config is sanitized through the canonical constraints",
);
assert.equal(createRuntimeMovementConfig({ maxSpeed: -20 }).maxSpeed, 0);
assert.equal(createRuntimeMovementConfig({ maxDeltaMs: 9999 }).maxDeltaMs, 250);
assert.equal(
  createRuntimeMovementConfig({ acceleration: Number.NaN }).acceleration,
  DEFAULT_MOVEMENT_CONFIG.acceleration,
);
const playerProfile = getActorProfile("player");
assert.equal(
  DEFAULT_MOVEMENT_CONFIG,
  playerProfile.movement,
  "default movement is the canonical immutable player profile object",
);
const villagerProfile = getActorProfile("villager");
const villagerProductionAcceleration = villagerProfile.movement.acceleration;
const villagerRuntime = createRuntimeMovementConfig(villagerProfile.movement, villagerProfile.movement);
assert.deepEqual(
  villagerRuntime,
  villagerProfile.movement,
  "production villager runtime config clones explicit villager values",
);
assert.notEqual(villagerRuntime, villagerProfile.movement, "runtime movement config is a mutable clone");
villagerRuntime.acceleration = 111;
assert.equal(
  villagerProfile.movement.acceleration,
  villagerProductionAcceleration,
  "mutating runtime config does not mutate production profile",
);

function stepMany(initial, input, milliseconds, activeConfig = config) {
  let next = initial;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
    next = stepCharacterMovement(next, input, Math.min(16, milliseconds - elapsed), {
      config: activeConfig,
    });
  }
  return next;
}

console.log("movement checks passed");
