import assert from "node:assert/strict";
import {
  JOYSTICK,
  clampJoystickCenter,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isTouchJoystickSupported,
} from "../src/input.js";
import { MobileJoystick } from "../src/mobileJoystick.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

function near(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

assert.equal(isTouchJoystickSupported({ maxTouchPoints: 1 }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: true }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: false }), false);
assert.deepEqual(clampJoystickCenter(80, 90), { x: 80, y: 90 });
assert.deepEqual(clampJoystickCenter(2, 1), {
  x: JOYSTICK.baseRadius,
  y: JOYSTICK.baseRadius,
});
assert.deepEqual(clampJoystickCenter(GAME_WIDTH / 2 - 1, GAME_HEIGHT - 1), {
  x: GAME_WIDTH / 2 - JOYSTICK.baseRadius,
  y: GAME_HEIGHT - JOYSTICK.baseRadius,
});
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2 - 0.1, 90), true);
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2, 90), false);

const center = { x: 60, y: 70 };
const centered = getJoystickState(center.x, center.y, center);
assert.deepEqual(
  { x: centered.movementX, y: centered.movementY },
  { x: 0, y: 0 },
);
const deadZone = getJoystickState(
  center.x + JOYSTICK.maxOffset * JOYSTICK.deadZoneRatio * 0.5,
  center.y,
  center,
);
assert.deepEqual(
  { x: deadZone.movementX, y: deadZone.movementY },
  { x: 0, y: 0 },
);
const maximum = getJoystickState(
  center.x + JOYSTICK.maxOffset * 4,
  center.y + JOYSTICK.maxOffset * 4,
  center,
);
near(Math.hypot(maximum.movementX, maximum.movementY), 1, "max diagonal movement normalizes");
assert(
  Math.hypot(maximum.knobX - center.x, maximum.knobY - center.y) <=
    JOYSTICK.maxOffset + 1e-12,
);
const combined = clampVectorLength({ x: 1, y: 1 });
near(Math.hypot(combined.x, combined.y), 1, "combined vector clamps");

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((candidate) => candidate !== listener),
    );
  }

  emit(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }

  count() {
    return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.length, 0);
  }
}

class PhaserInputStub {
  constructor() {
    this.listeners = new Map();
  }

  on(type, listener, context) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push([listener, context]);
    this.listeners.set(type, listeners);
  }

  off(type, listener, context) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        ([candidate, candidateContext]) =>
          candidate !== listener || candidateContext !== context,
      ),
    );
  }

  emit(type, pointer) {
    for (const [listener, context] of [...(this.listeners.get(type) ?? [])]) {
      listener.call(context, pointer);
    }
  }

  count() {
    return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.length, 0);
  }
}

function createGraphicStub() {
  return {
    visible: false,
    x: 0,
    y: 0,
    setStrokeStyle() { return this; },
    setDepth() { return this; },
    setScrollFactor() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.destroyed = true; },
  };
}

const canvas = new EventTargetStub();
canvas.getBoundingClientRect = () => ({
  left: 40,
  top: 30,
  width: GAME_WIDTH * 2,
  height: GAME_HEIGHT * 2,
});
canvas.setPointerCapture = () => {};
canvas.releasePointerCapture = () => {};

const windowRef = new EventTargetStub();
windowRef.matchMedia = () => ({ matches: true });
const documentRef = new EventTargetStub();
documentRef.hidden = false;
const phaserInput = new PhaserInputStub();
const scene = {
  input: phaserInput,
  game: { canvas },
  add: { circle: () => createGraphicStub() },
};

const joystick = new MobileJoystick(scene, {
  windowRef,
  documentRef,
  navigatorRef: { maxTouchPoints: 1 },
  canvas,
  isExcludedPoint: (x) => x > GAME_WIDTH - 50,
});

canvas.emit("pointerdown", {
  pointerId: 9,
  clientX: 40 + (GAME_WIDTH - 20) * 2,
  clientY: 30 + 12 * 2,
  cancelable: true,
  preventDefault() {},
});
assert.equal(joystick.activeJoystickPointerId, null, "excluded HUD point is ignored by actual component");

canvas.emit("pointerdown", {
  pointerId: 1,
  clientX: 40 + 80 * 2,
  clientY: 30 + 90 * 2,
  cancelable: true,
  preventDefault() {},
});
windowRef.emit("pointermove", {
  pointerId: 1,
  clientX: 40 + (GAME_WIDTH + 300) * 2,
  clientY: 30 - 220 * 2,
  cancelable: true,
  preventDefault() {},
});
near(
  Math.hypot(joystick.direction.x, joystick.direction.y),
  1,
  "actual component uses production joystick math outside canvas",
);
canvas.emit("pointerleave", {});
assert.equal(joystick.activeJoystickPointerId, 1, "boundary leave does not reset");
canvas.emit("lostpointercapture", { pointerId: 1 });
assert.equal(joystick.activeJoystickPointerId, 1, "lost capture keeps owner");
windowRef.emit("pointerup", { pointerId: 2, cancelable: true, preventDefault() {} });
assert.equal(joystick.activeJoystickPointerId, 1, "nonmatching release ignored");
windowRef.emit("pointerup", { pointerId: 1, cancelable: true, preventDefault() {} });
assert.deepEqual(joystick.getDirection(), { x: 0, y: 0 }, "matching release resets");

joystick.destroy();
assert.equal(
  phaserInput.count() + canvas.count() + windowRef.count() + documentRef.count(),
  0,
  "destroy removes actual component listeners",
);

console.log("input checks passed");
