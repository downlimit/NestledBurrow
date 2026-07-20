import assert from "node:assert/strict";
import {
  applyBlockedAxes,
  createMovementState,
  movementSpeed,
  stepCharacterMovement,
} from "../src/characterMovement.js";
import { DEFAULT_MOVEMENT_CONFIG } from "../src/movementConfig.js";

const config = { ...DEFAULT_MOVEMENT_CONFIG };
const close = (a, b, epsilon = 0.001) => Math.abs(a - b) <= epsilon;

let state = createMovementState();
state = stepMany(state, { x: 1, y: 1 }, 180);
assert(movementSpeed(state) <= config.maxSpeed + 0.001, "diagonal movement has no speed boost");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
assert(close(movementSpeed(state), config.maxSpeed), "movement reaches max speed");

const moving = state;
state = stepCharacterMovement(state, { x: 0, y: 0 }, 16, { config });
assert(movementSpeed(state) < movementSpeed(moving), "released input starts gradual braking");
state = stepMany(state, { x: 0, y: 0 }, 1000);
assert(close(movementSpeed(state), 0), "released input eventually stops");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
let reversed = stepCharacterMovement(state, { x: -1, y: 0 }, 16, { config });
assert(reversed.velocity.x > 0, "sharp reverse does not instantly invert velocity");
reversed = stepMany(reversed, { x: -1, y: 0 }, 200);
assert(reversed.velocity.x < 0, "sharp reverse passes through zero before moving opposite");

state = stepMany(createMovementState(), { x: 1, y: 0 }, 1000);
const turned = stepMany(state, { x: 0, y: 1 }, 120);
assert(turned.velocity.x > 0 && turned.velocity.y > 0, "90 degree turn blends old and new velocity");
assert(turned.velocity.x < state.velocity.x, "90 degree turn decelerates old axis");

const half = stepMany(createMovementState(), { x: 0.5, y: 0 }, 1000);
assert(close(movementSpeed(half), config.maxSpeed * 0.5), "analog joystick strength scales target speed");

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
assert(aimed.aimDirection.y < -0.99, "aim direction is stored independently as a continuous vector");

const smallDelta = stepCharacterMovement(createMovementState(), { x: 1, y: 0 }, config.maxDeltaMs, { config });
const hugeDelta = stepCharacterMovement(createMovementState(), { x: 1, y: 0 }, 10_000, { config });
assert.deepEqual(hugeDelta.velocity, smallDelta.velocity, "large frame delta is capped");

function stepMany(initial, input, milliseconds) {
  let next = initial;
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
    next = stepCharacterMovement(next, input, Math.min(16, milliseconds - elapsed), { config });
  }
  return next;
}

console.log("movement checks passed");
