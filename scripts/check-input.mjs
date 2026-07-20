import assert from "node:assert/strict";
import {
  JOYSTICK,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "../src/input.js";
import { getMovementVector, resolveFacing } from "../src/movement.js";

function simulateJoystick() {
  const state = {
    activePointerId: null,
    vector: { x: 0, y: 0 },
    knob: { x: JOYSTICK.centerX, y: JOYSTICK.centerY },
  };

  const reset = () => {
    state.activePointerId = null;
    state.vector = { x: 0, y: 0 };
    state.knob = { x: JOYSTICK.centerX, y: JOYSTICK.centerY };
  };

  const down = (pointer) => {
    if (state.activePointerId !== null) return;
    if (!isInsideJoystickActivation(pointer.x, pointer.y)) return;
    state.activePointerId = pointer.id;
    move(pointer);
  };

  const move = (pointer) => {
    if (pointer.id !== state.activePointerId) return;
    const joystick = getJoystickState(pointer.x, pointer.y);
    state.vector = { x: joystick.movementX, y: joystick.movementY };
    state.knob = { x: joystick.knobX, y: joystick.knobY };
  };

  const up = (pointer) => {
    if (pointer.id === state.activePointerId) reset();
  };

  return { state, down, move, up, reset };
}

assert.equal(isTouchJoystickSupported({ maxTouchPoints: 1, coarsePointer: false }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: true }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: false }), false);

const joystick = simulateJoystick();
joystick.down({ id: 1, x: JOYSTICK.centerX + 10, y: JOYSTICK.centerY });
assert.equal(joystick.state.activePointerId, 1, "press inside activation zone captures joystick");

joystick.move({ id: 1, x: JOYSTICK.centerX + JOYSTICK.maxOffset, y: JOYSTICK.centerY + JOYSTICK.maxOffset });
assert(Math.abs(Math.hypot(joystick.state.vector.x, joystick.state.vector.y) - 1) < 1e-12, "diagonal movement reaches full strength without exceeding 1");
assert(Math.hypot(joystick.state.knob.x - JOYSTICK.centerX, joystick.state.knob.y - JOYSTICK.centerY) <= JOYSTICK.maxOffset + 1e-12, "knob clamps at max offset outside base");

joystick.down({ id: 2, x: JOYSTICK.centerX, y: JOYSTICK.centerY });
assert.equal(joystick.state.activePointerId, 1, "second finger cannot take over");
joystick.up({ id: 2 });
assert.equal(joystick.state.activePointerId, 1, "lifting another finger does not reset");

joystick.up({ id: 1 });
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "pointerup inside canvas resets movement");
assert.deepEqual(joystick.state.knob, { x: JOYSTICK.centerX, y: JOYSTICK.centerY }, "knob returns to center");

for (const reason of ["pointerupoutside", "pointercancel", "window blur", "visibilitychange hidden"]) {
  joystick.down({ id: 3, x: JOYSTICK.centerX, y: JOYSTICK.centerY });
  joystick.move({ id: 3, x: JOYSTICK.centerX + JOYSTICK.activationRadius, y: JOYSTICK.centerY });
  joystick.reset();
  assert.equal(joystick.state.activePointerId, null, `${reason} clears active pointer`);
  assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, `${reason} stops joystick movement`);
}

const combined = clampVectorLength({ x: 1, y: 1 });
assert(Math.abs(Math.hypot(combined.x, combined.y) - 1) < 1e-12, "keyboard plus joystick is clamped to speed 1");
assert.deepEqual(clampVectorLength({ x: 1, y: 0 }), { x: 1, y: 0 }, "keyboard vector is preserved when already within speed 1");

assert.deepEqual(
  getMovementVector({ left: true, right: false, up: true, down: false }),
  { x: -1, y: -1 },
  "keyboard state produces the expected up-left movement vector",
);
assert.deepEqual(
  getMovementVector({ left: true, right: true, up: false, down: false }),
  { x: 0, y: 0 },
  "opposite keyboard directions cancel before movement is clamped",
);
assert.deepEqual(
  getMovementVector(
    { left: false, right: true, up: false, down: false },
    { x: -0.25, y: 0.5 },
  ),
  { x: 0.75, y: 0.5 },
  "keyboard and joystick vectors combine before the final speed clamp",
);

assert.equal(
  resolveFacing("down", { x: 0, y: 0 }, 0.15),
  "down",
  "idle keeps the last facing direction",
);
assert.equal(
  resolveFacing("down", { x: 1, y: 0.1 }, 0.15),
  "right",
  "mostly horizontal movement faces right",
);
assert.equal(
  resolveFacing("right", { x: -1, y: 0.1 }, 0.15),
  "left",
  "mostly horizontal movement faces left",
);
assert.equal(
  resolveFacing("left", { x: 0.1, y: -1 }, 0.15),
  "up",
  "mostly vertical movement faces up",
);
assert.equal(
  resolveFacing("up", { x: 0.1, y: 1 }, 0.15),
  "down",
  "mostly vertical movement faces down",
);
assert.equal(
  resolveFacing("left", { x: 0.5, y: 0.55 }, 0.15),
  "left",
  "near-diagonal movement keeps facing stable inside hysteresis",
);

console.log("input checks passed");
