import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JOYSTICK,
  clampJoystickCenter,
  clampVectorLength,
  getJoystickState,
  isInsideJoystickActivation,
  isPlayerMovementSuppressed,
  isTouchJoystickSupported,
} from "../src/controls/input.js";
import { createGameCanvasInputGuard, shouldPreventGameBrowserShortcut } from "../src/controls/gameCanvasInputGuard.js";
import { MobileJoystick } from "../src/controls/mobileJoystick.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/world/worldConfig.js";

function near(actual, expected, message) {
  assert(Math.abs(actual - expected) < 1e-12, `${message}: expected ${expected}, got ${actual}`);
}

assert.equal(isTouchJoystickSupported({ maxTouchPoints: 1 }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: true }), true);
assert.equal(isTouchJoystickSupported({ maxTouchPoints: 0, coarsePointer: false }), false);
assert.deepEqual(clampJoystickCenter(80, 90), { x: 80, y: 90 });
assert.deepEqual(clampJoystickCenter(2, 1), { x: 2, y: 1 }, "edge touch remains the joystick center");
assert.deepEqual(clampJoystickCenter(GAME_WIDTH / 2 - 1, GAME_HEIGHT - 1), {
  x: GAME_WIDTH / 2 - 1,
  y: GAME_HEIGHT - 1,
}, "the center is never shifted away from an edge");
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2 - 0.1, 90), true);
assert.equal(isInsideJoystickActivation(GAME_WIDTH / 2, 90), false);
assert.equal(isPlayerMovementSuppressed({ buildModeActive: true }), false, "build mode keeps WASD movement enabled");
assert.equal(isPlayerMovementSuppressed({ sleeping: true }), true);
assert.equal(isPlayerMovementSuppressed({ facilityActive: true }), true);
assert.equal(isPlayerMovementSuppressed({ dialogueActive: true }), true);
assert.equal(isPlayerMovementSuppressed({ cookingActive: true }), true);

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
    setStrokeStyle(width, color, alpha) { this.strokeStyle = { width, color, alpha }; return this; },
    setDepth() { return this; },
    setScrollFactor() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.destroyed = true; },
  };
}

function keyboardEvent(code, target = { tagName: "CANVAS" }) {
  let prevented = false;
  return {
    code,
    target,
    preventDefault() { prevented = true; },
    get prevented() { return prevented; },
  };
}

assert.equal(shouldPreventGameBrowserShortcut(keyboardEvent("AltLeft")), true, "physical Alt is captured");
assert.equal(shouldPreventGameBrowserShortcut(keyboardEvent("KeyD")), true, "Alt combinations cannot focus the address bar");
assert.equal(shouldPreventGameBrowserShortcut(keyboardEvent("Tab")), true, "Tab remains inside the game");
assert.equal(shouldPreventGameBrowserShortcut(keyboardEvent("F11")), false, "F11 remains a browser fullscreen shortcut");
assert.equal(
  shouldPreventGameBrowserShortcut(keyboardEvent("KeyA", { tagName: "INPUT" })),
  false,
  "editable controls keep native keyboard input",
);

const guardCanvas = new EventTargetStub();
const guardWindow = new EventTargetStub();
const inputGuard = createGameCanvasInputGuard(guardCanvas, { windowRef: guardWindow });
const tabDown = keyboardEvent("Tab");
guardWindow.emit("keydown", tabDown);
assert.equal(tabDown.prevented, true, "keydown browser defaults are prevented");
const movementUp = keyboardEvent("KeyD");
guardWindow.emit("keyup", movementUp);
assert.equal(movementUp.prevented, true, "keyup browser defaults are prevented");
const fullscreenDown = keyboardEvent("F11");
guardWindow.emit("keydown", fullscreenDown);
assert.equal(fullscreenDown.prevented, false, "F11 passes through the installed guard");
const editableDown = keyboardEvent("Tab", { tagName: "TEXTAREA" });
guardWindow.emit("keydown", editableDown);
assert.equal(editableDown.prevented, false, "editable targets pass through the installed guard");
const contextMenu = keyboardEvent("ContextMenu");
guardCanvas.emit("contextmenu", contextMenu);
assert.equal(contextMenu.prevented, true, "canvas context menu remains disabled");
inputGuard.destroy();
assert.equal(guardCanvas.count() + guardWindow.count(), 0, "input guard removes every listener");

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
assert.equal(joystick.isSprinting(), true, "raw pointer distance beyond the 54.45 px ring enables sprint");
canvas.emit("pointerleave", {});
assert.equal(joystick.activeJoystickPointerId, 1, "boundary leave does not reset");
canvas.emit("lostpointercapture", { pointerId: 1 });
assert.equal(joystick.activeJoystickPointerId, 1, "lost capture keeps owner");
windowRef.emit("pointerup", { pointerId: 2, cancelable: true, preventDefault() {} });
assert.equal(joystick.activeJoystickPointerId, 1, "nonmatching release ignored");
windowRef.emit("pointerup", { pointerId: 1, cancelable: true, preventDefault() {} });
assert.deepEqual(joystick.getDirection(), { x: 0, y: 0 }, "matching release resets");
assert.equal(joystick.isSprinting(), false, "matching release clears sprint");
assert.equal(joystick.sprintRing.strokeStyle?.alpha ?? 0.36, 0.36, "sprint ring stroke uses the requested 0.36 alpha");

joystick.destroy();
assert.equal(
  phaserInput.count() + canvas.count() + windowRef.count() + documentRef.count(),
  0,
  "destroy removes actual component listeners",
);

const mainSource = readFileSync("src/main.js", "utf8");
const interactionHudSource = readFileSync("src/ui/interactionHud.js", "utf8");
assert(mainSource.includes('addKeys("SPACE")'), "desktop interaction is bound to Space");
assert(!mainSource.includes('addKeys("E,SPACE")') && !mainSource.includes('interactKeys.E'), "desktop interaction no longer advertises or samples E");
assert(interactionHudSource.includes("SPACE · "), "desktop interaction prompt advertises uppercase Space with middle-dot separator");
assert(interactionHudSource.includes("SPACE - "), "desktop interaction prompt uses an ASCII separator without an unsupported glyph");
assert(!interactionHudSource.includes("SPACE  "), "desktop interaction prompt does not use double spaces");

console.log("input checks passed");
