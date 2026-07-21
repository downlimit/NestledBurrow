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
import { FULLSCREEN_HIT_AREA, isPointInRect } from "../src/hud.js";

function near(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

function simulateJoystick() {
  const canvasRect = { left: 40, top: 30, width: GAME_WIDTH * 2, height: GAME_HEIGHT * 2 };
  const state = {
    activePointerId: null,
    center: null,
    vector: { x: 0, y: 0 },
    knob: null,
    captured: false,
    globalFallback: false,
  };

  const canvasPointFromNativeEvent = (event) => ({
    x: (event.clientX - canvasRect.left) * (GAME_WIDTH / canvasRect.width),
    y: (event.clientY - canvasRect.top) * (GAME_HEIGHT / canvasRect.height),
  });

  const reset = () => {
    state.activePointerId = null;
    state.center = null;
    state.vector = { x: 0, y: 0 };
    state.knob = null;
    state.captured = false;
    state.globalFallback = false;
  };

  const down = (event) => {
    const point = canvasPointFromNativeEvent(event);
    if (state.activePointerId !== null) return;
    if (isPointInRect(point.x, point.y, FULLSCREEN_HIT_AREA)) return;
    if (!isInsideJoystickActivation(point.x, point.y)) return;
    state.activePointerId = event.pointerId;
    state.center = clampJoystickCenter(point.x, point.y);
    state.vector = { x: 0, y: 0 };
    state.knob = { ...state.center };
    state.captured = true;
  };

  const move = (event) => {
    if (event.pointerId !== state.activePointerId) return;
    const point = canvasPointFromNativeEvent(event);
    const joystick = getJoystickState(point.x, point.y, state.center);
    state.vector = { x: joystick.movementX, y: joystick.movementY };
    state.knob = { x: joystick.knobX, y: joystick.knobY };
  };

  const up = (event) => {
    if (event.pointerId === state.activePointerId) reset();
  };

  const boundaryLeave = () => {
    // Native pointerleave / Phaser gameout are boundary notifications only.
  };

  const lostPointerCapture = (event) => {
    if (event.pointerId !== state.activePointerId) return;
    state.captured = false;
    state.globalFallback = true;
  };

  const safetyReset = () => reset();

  return { state, down, move, up, boundaryLeave, lostPointerCapture, safetyReset, reset };
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
joystick.down({ pointerId: 99, clientX: 40 + (GAME_WIDTH - 20) * 2, clientY: 30 + 12 * 2 });
assert.equal(joystick.state.activePointerId, null, "HUD pointer does not capture joystick");
joystick.down({ pointerId: 1, clientX: 40 + 80 * 2, clientY: 30 + 90 * 2 });
assert.equal(joystick.state.activePointerId, 1, "left-half press captures joystick");
assert.deepEqual(joystick.state.center, { x: 80, y: 90 });
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "activation itself does not move");
joystick.move({ pointerId: 1, clientX: 40 - 200 * 2, clientY: 30 + (GAME_HEIGHT + 160) * 2 });
near(Math.hypot(joystick.state.vector.x, joystick.state.vector.y), 1, "captured movement beyond canvas remains clamped and non-zero");
assert(Math.hypot(joystick.state.knob.x - joystick.state.center.x, joystick.state.knob.y - joystick.state.center.y) <= JOYSTICK.maxOffset + 1e-12, "external movement clamps visual knob");
joystick.boundaryLeave();
assert.equal(joystick.state.activePointerId, 1, "boundary leave does not reset while pointer is captured");
joystick.down({ pointerId: 2, clientX: 40 + 60 * 2, clientY: 30 + 90 * 2 });
assert.equal(joystick.state.activePointerId, 1, "second finger cannot take over");
joystick.up({ pointerId: 2 });
assert.equal(joystick.state.activePointerId, 1, "lifting another finger does not reset");
joystick.up({ pointerId: 1 });
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "pointerup resets movement");
assert.equal(joystick.state.center, null, "pointerup hides joystick center");

joystick.reset();
joystick.down({ pointerId: 7, clientX: 40 + 80 * 2, clientY: 30 + 90 * 2 });
joystick.boundaryLeave();
joystick.lostPointerCapture({ pointerId: 7 });
assert.equal(joystick.state.activePointerId, 7, "lostpointercapture keeps active joystick ownership");
assert.equal(joystick.state.globalFallback, true, "lostpointercapture switches to global pointer tracking");
joystick.move({ pointerId: 7, clientX: 40 + (GAME_WIDTH + 300) * 2, clientY: 30 - 220 * 2 });
near(Math.hypot(joystick.state.vector.x, joystick.state.vector.y), 1, "window pointermove far beyond canvas keeps clamped non-zero input");
assert(Math.hypot(joystick.state.knob.x - joystick.state.center.x, joystick.state.knob.y - joystick.state.center.y) <= JOYSTICK.maxOffset + 1e-12, "window pointermove beyond canvas clamps visual knob");
joystick.up({ pointerId: 7 });
assert.equal(joystick.state.activePointerId, null, "window pointerup after capture loss clears active pointer");
assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, "window pointerup after capture loss stops movement");
assert.equal(joystick.state.center, null, "window pointerup after capture loss hides joystick");

for (const reason of ["pointerupoutside", "pointercancel", "window blur", "visibilitychange hidden", "fullscreenchange"]) {
  joystick.down({ pointerId: 3, clientX: 40 + 80 * 2, clientY: 30 + 90 * 2 });
  joystick.move({ pointerId: 3, clientX: 40 + 100 * 2, clientY: 30 + 90 * 2 });
  joystick.safetyReset();
  assert.equal(joystick.state.activePointerId, null, `${reason} clears active pointer`);
  assert.deepEqual(joystick.state.vector, { x: 0, y: 0 }, `${reason} stops joystick movement`);
}

const combined = clampVectorLength({ x: 1, y: 1 });
near(Math.hypot(combined.x, combined.y), 1, "keyboard plus joystick is clamped to speed 1");
assert.deepEqual(clampVectorLength({ x: 1, y: 0 }), { x: 1, y: 0 }, "keyboard vector is preserved when already within speed 1");

console.log("input checks passed");
