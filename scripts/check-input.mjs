import assert from "node:assert/strict";
import {
  JOYSTICK,
  clampJoystickCenter,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "../src/input.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

function near(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

function simulateJoystick() {
  const state = {
    activePointerId: null,
    center: null,
    vector: { x: 0, y: 0 },
    knob: null,
  };

  const reset = () => {
    state.activePointerId = null;
    state.center = null;
    state.vector = { x: 0, y: 0 };
    state.knob = null;
  };

  const down = (pointer) => {
    if (state.activePointerId !== null) return;
    if (!isInsideJoystickActivation(pointer.x, pointer.y)) return;
    state.activePointerId = pointer.id;
    state.center = clampJoystickCenter(pointer.x, pointer.y);
    state.vector = { x: 0, y: 0 };
    state.knob = { ...state.center };
  };

  const move = (pointer) => {
    if (pointer.id !== state.activePointerId) return;
    const joystick = getJoystickState(pointer.x, pointer.y, state.center);
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

assert.deepEqual(clampJoystickCenter(80, 90), { x: 80, y: 90 }, "safe left-half touch keeps center under finger");
assert.deepEqual(clampJoystickCenter(2, 1), { x: JOYSTICK.baseRadius, y: JOYSTICK.baseRadius }, "center clamps at left and top edges");
assert.deepEqual(clampJoystickCenter(40, GAME_HEIGHT - 1), { x: 40, y: GAME_HEIGHT - JOYSTICK.baseRadius }, "center clamps at bottom edge");
assert.deepEqual(clampJoystickCenter(GAME_WIDTH / 2 - 1, 90), { x: GAME_WIDTH / 2 - JOYSTICK.baseRadius, y: 90 }, "center cannot enter the right half");
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2 - 0.1, 90), true, "left half activates");
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2, 90), false, "right half is rejected");

const centerA = { x: 60, y: 70 };
const centerB = { x: 110, y: 130 };
const centered = getJoystickState(centerA.x, centerA.y, centerA);
assert.deepEqual({ x: centered.movementX, y: centered.movementY }, { x: 0, y: 0 }, "pointer at runtime center is idle");
const dead = getJoystickState(centerA.x + JOYSTICK.maxOffset * JOYSTICK.deadZoneRatio * 0.5, centerA.y, centerA);
assert.deepEqual({ x: dead.movementX, y: dead.movementY }, { x: 0, y: 0 }, "dead zone remains active");
const max = getJoystickState(centerA.x + JOYSTICK.maxOffset * 4, centerA.y + JOYSTICK.maxOffset * 4, centerA);
near(Math.hypot(max.movementX, max.movementY), 1, "max diagonal movement normalizes to length 1");
assert(Math.hypot(max.knobX - centerA.x, max.knobY - centerA.y) <= JOYSTICK.maxOffset + 1e-12, "knob clamps at max offset");
const offsetA = getJoystickState(centerA.x + 10, centerA.y, centerA);
const offsetB = getJoystickState(centerB.x + 10, centerB.y, centerB);
assert.deepEqual({ x: offsetA.movementX, y: offsetA.movementY }, { x: offsetB.movementX, y: offsetB.movementY }, "different runtime centers produce independent equivalent vectors");

const joystick = simulateJoystick();
joystick.down({ id: 1, x: 80, y: 90 });
assert.equal(joystick.state.activePointerId, 1, "left-half press captures joystick");
assert.deepEqual(joystick.state.center, { x: 80, y: 90 });
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "activation itself does not move");
joystick.move({ id: 1, x: 95, y: 105 });
near(Math.hypot(joystick.state.vector.x, joystick.state.vector.y), 1, "diagonal movement reaches full strength without exceeding 1");
joystick.down({ id: 2, x: 60, y: 90 });
assert.equal(joystick.state.activePointerId, 1, "second finger cannot take over");
joystick.up({ id: 2 });
assert.equal(joystick.state.activePointerId, 1, "lifting another finger does not reset");
joystick.up({ id: 1 });
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "pointerup resets movement");
assert.equal(joystick.state.center, null, "pointerup hides joystick center");

for (const reason of ["pointerupoutside", "pointercancel", "window blur", "visibilitychange hidden", "fullscreenchange"]) {
  joystick.down({ id: 3, x: 80, y: 90 });
  joystick.move({ id: 3, x: 100, y: 90 });
  joystick.reset();
  assert.equal(joystick.state.activePointerId, null, `${reason} clears active pointer`);
  assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, `${reason} stops joystick movement`);
}

const combined = clampVectorLength({ x: 1, y: 1 });
near(Math.hypot(combined.x, combined.y), 1, "keyboard plus joystick is clamped to speed 1");
assert.deepEqual(clampVectorLength({ x: 1, y: 0 }), { x: 1, y: 0 }, "keyboard vector is preserved when already within speed 1");

console.log("input checks passed");
