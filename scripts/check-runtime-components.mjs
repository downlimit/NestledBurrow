import assert from "node:assert/strict";
import { MobileJoystick } from "../src/mobileJoystick.js";
import {
  MOVEMENT_STORAGE_KEY,
  MovementDebugPanel,
  loadMovementDebugConfig,
} from "../src/movementDebugPanel.js";
import { DEFAULT_MOVEMENT_CONFIG, MOVEMENT_TUNING_FIELDS } from "../src/movementConfig.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

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
    destroyed: false,
    setStrokeStyle() { return this; },
    setDepth() { return this; },
    setScrollFactor() { return this; },
    setVisible(value) { this.visible = value; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    destroy() { this.destroyed = true; },
  };
}

function createJoystickEnvironment({ supported = true, releaseThrows = false } = {}) {
  const canvas = new EventTargetStub();
  canvas.getBoundingClientRect = () => ({
    left: 10,
    top: 20,
    width: GAME_WIDTH * 2,
    height: GAME_HEIGHT * 2,
  });
  canvas.setPointerCapture = () => {};
  canvas.releasePointerCapture = () => {
    if (releaseThrows) throw new Error("lost");
  };

  const windowRef = new EventTargetStub();
  windowRef.matchMedia = () => ({ matches: supported });
  const documentRef = new EventTargetStub();
  documentRef.hidden = false;
  const input = new PhaserInputStub();

  return {
    canvas,
    windowRef,
    documentRef,
    input,
    scene: {
      input,
      game: { canvas },
      add: { circle: () => createGraphicStub() },
    },
    navigatorRef: { maxTouchPoints: supported ? 1 : 0 },
  };
}

function pointerEvent(pointerId, x, y) {
  return {
    pointerId,
    clientX: 10 + x * 2,
    clientY: 20 + y * 2,
    cancelable: true,
    preventDefault() { this.prevented = true; },
  };
}

let joystickEnvironment = createJoystickEnvironment({ supported: false });
let joystick = new MobileJoystick(joystickEnvironment.scene, {
  windowRef: joystickEnvironment.windowRef,
  documentRef: joystickEnvironment.documentRef,
  navigatorRef: joystickEnvironment.navigatorRef,
  canvas: joystickEnvironment.canvas,
});
assert.equal(joystick.enabled, false, "unsupported devices disable joystick");
assert.equal(
  joystickEnvironment.input.count() +
    joystickEnvironment.canvas.count() +
    joystickEnvironment.windowRef.count() +
    joystickEnvironment.documentRef.count(),
  0,
  "disabled joystick does not register listeners",
);
joystick.destroy();

joystickEnvironment = createJoystickEnvironment();
joystick = new MobileJoystick(joystickEnvironment.scene, {
  windowRef: joystickEnvironment.windowRef,
  documentRef: joystickEnvironment.documentRef,
  navigatorRef: joystickEnvironment.navigatorRef,
  canvas: joystickEnvironment.canvas,
  isExcludedPoint: (x, y) => x < 30 && y < 30,
});
joystickEnvironment.canvas.emit("pointerdown", pointerEvent(1, 20, 20));
assert.equal(joystick.activeJoystickPointerId, null, "excluded activation ignored");
joystickEnvironment.canvas.emit("pointerdown", pointerEvent(1, 80, 90));
assert.equal(joystick.activeJoystickPointerId, 1, "activates on left half");
assert.deepEqual(joystick.getDirection(), { x: 0, y: 0 });
joystickEnvironment.canvas.emit("pointerdown", pointerEvent(2, 70, 90));
assert.equal(joystick.activeJoystickPointerId, 1, "second pointer cannot take ownership");
joystickEnvironment.windowRef.emit("pointermove", pointerEvent(1, 82, 90));
assert.deepEqual(joystick.getDirection(), { x: 0, y: 0 }, "dead zone applies through production math");
joystickEnvironment.windowRef.emit("pointermove", pointerEvent(1, -200, GAME_HEIGHT + 160));
assert(
  Math.hypot(joystick.direction.x, joystick.direction.y) > 0.99,
  "outside-canvas move remains tracked and clamped",
);
joystickEnvironment.canvas.emit("pointerleave", {});
joystickEnvironment.input.emit("gameout", {});
joystickEnvironment.input.emit("pointerout", {});
assert.equal(joystick.activeJoystickPointerId, 1, "boundary leave/out does not reset");
joystickEnvironment.canvas.emit("lostpointercapture", { pointerId: 1 });
assert.equal(joystick.pointerCaptured, false);
assert.equal(joystick.activeJoystickPointerId, 1, "lost capture does not end ownership");
joystickEnvironment.windowRef.emit("pointerup", pointerEvent(2, 80, 90));
assert.equal(joystick.activeJoystickPointerId, 1, "nonmatching release ignored");
joystickEnvironment.windowRef.emit("pointerup", pointerEvent(1, 80, 90));
assert.equal(joystick.activeJoystickPointerId, null, "matching release resets");
joystickEnvironment.canvas.emit("pointerdown", pointerEvent(3, 80, 90));
joystickEnvironment.windowRef.emit("pointercancel", pointerEvent(3, 80, 90));
assert.equal(joystick.activeJoystickPointerId, null, "pointercancel resets");
joystickEnvironment.input.emit("pointerdown", {
  id: 4,
  x: 80,
  y: 90,
  wasTouch: true,
  identifier: 44,
  event: {},
});
joystickEnvironment.canvas.emit("touchcancel", {
  changedTouches: [{ identifier: 44 }],
});
assert.equal(joystick.activeJoystickPointerId, null, "touchcancel resets matching touch identifier");

for (const [name, fire] of [
  ["blur", () => joystickEnvironment.windowRef.emit("blur")],
  ["hidden", () => {
    joystickEnvironment.documentRef.hidden = true;
    joystickEnvironment.documentRef.emit("visibilitychange");
    joystickEnvironment.documentRef.hidden = false;
  }],
  ["fullscreen", () => joystickEnvironment.documentRef.emit("fullscreenchange")],
]) {
  joystickEnvironment.canvas.emit("pointerdown", pointerEvent(5, 80, 90));
  fire();
  assert.equal(joystick.activeJoystickPointerId, null, `${name} safety reset`);
}

joystick.destroy();
joystick.reset();
assert.equal(
  joystickEnvironment.input.count() +
    joystickEnvironment.canvas.count() +
    joystickEnvironment.windowRef.count() +
    joystickEnvironment.documentRef.count(),
  0,
  "destroy removes all joystick listeners and is idempotent",
);

joystickEnvironment = createJoystickEnvironment({ releaseThrows: true });
joystick = new MobileJoystick(joystickEnvironment.scene, {
  windowRef: joystickEnvironment.windowRef,
  documentRef: joystickEnvironment.documentRef,
  navigatorRef: joystickEnvironment.navigatorRef,
  canvas: joystickEnvironment.canvas,
});
joystickEnvironment.canvas.emit("pointerdown", pointerEvent(6, 80, 90));
assert.doesNotThrow(() => joystick.reset(), "reset tolerates lost capture");
assert.doesNotThrow(() => joystick.destroy(), "destroy tolerates lost capture");

class ElementStub extends EventTargetStub {
  constructor(tagName) {
    super();
    this.tagName = tagName;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.textContent = "";
    this.value = "";
    this.className = "";
    this.removed = false;
  }

  append(...nodes) {
    this.children.push(...nodes);
    for (const node of nodes) node.parent = this;
  }

  setAttribute(key, value) {
    this.attributes[key] = value;
  }

  remove() {
    this.removed = true;
    if (this.parent) {
      this.parent.children = this.parent.children.filter((child) => child !== this);
    }
  }

  input() {
    this.emit("input", {});
  }
}

class DocumentStub {
  constructor() {
    this.body = new ElementStub("body");
  }

  createElement(tagName) {
    return new ElementStub(tagName);
  }
}

function createStorage() {
  return {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
}

function createTimerWindow({ immediate = false } = {}) {
  let nextId = 1;
  const timers = new Map();
  return {
    timers,
    setTimeout(callback) {
      const id = nextId++;
      timers.set(id, callback);
      if (immediate) {
        timers.delete(id);
        callback();
      }
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    runAll() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
  };
}

let documentStub = new DocumentStub();
let storage = createStorage();
let gameplayTuning = { maximumEnergy: 100, axeDamage: 1, smallLogChopHp: 7, energyPerHit: 1, awakeDrainAmount: 0.5, awakeWalkDrainAmount: 1.5, awakeRunDrainAmount: 3, universalHitCooldownSeconds: 0.66, minimumFatigueSpeedMultiplier: 0.25, sleepTimeScale: 32, sleepEnergyPerGameHour: 12.5, realSecondsPerGameDay: 1440 };
let changeCalls = 0;
let resetCalls = 0;
let panel = new MovementDebugPanel({ enabled: false, gameplayTuning, documentRef: documentStub, storage });
assert.equal(documentStub.body.children.length, 0, "disabled debug controls are absent");
assert.deepEqual(loadMovementDebugConfig({ enabled: true, storage }), {}, "legacy movement overrides are no longer exposed");

documentStub = new DocumentStub();
panel = new MovementDebugPanel({
  enabled: true, gameplayTuning, documentRef: documentStub, storage,
  onGameplayTuningChange: () => changeCalls++,
  onResetBalanceRun: () => resetCalls++,
  getStatusSnapshot: () => ({ clock: "06:00", energy: 100, smallLogsCleared: 2, wood: 2, stone: 1, rubies: 0 }),
});
assert.equal(documentStub.body.children.length, 2, "enabled debug creates a toggle and panel");
assert.equal(panel.panel.hidden, true, "panel is closed by default");
panel.toggleButton.emit("click");
assert.equal(panel.panel.hidden, false, "toggle opens the panel");
panel.toggleButton.emit("click");
assert.equal(panel.panel.hidden, true, "toggle closes the panel");
assert.deepEqual([...panel.inputs.keys()], ["axeDamage", "smallLogChopHp", "universalHitCooldownSeconds", "minimumFatigueSpeedMultiplier", "sleepTimeScale", "sleepEnergyPerGameHour"], "panel exposes only agreed balance fields");
const hpInput = panel.inputs.get("smallLogChopHp");
hpInput.value = "9";
hpInput.input();
assert.equal(gameplayTuning.smallLogChopHp, 9, "input applies live normalized tuning");
assert.equal(changeCalls, 1, "live tuning callback fires");
assert(storage.getItem("nestledBurrow.gameplayDebug").includes('"smallLogChopHp":9'), "balance tuning persists separately");
assert(panel.derived.textContent.includes("14"), "derived large log HP updates and remains read-only");
panel.updateStatus();
assert(panel.status.textContent.includes("time 06:00") && panel.status.textContent.includes("wood 2 stone 1 ruby 0"), "compact live status reports balance state");
const resetButton = panel.panel.children.at(-1).children[0];
resetButton.emit("click");
assert.equal(resetCalls, 1, "balance reset action is wired");
panel.resetDefaults();
assert.equal(gameplayTuning.smallLogChopHp, 7, "defaults restore production preset");
const panelNode = panel.panel;
const toggleNode = panel.toggleButton;
panel.destroy(); panel.destroy();
assert.equal(panelNode.removed, true, "destroy removes panel idempotently");
assert.equal(toggleNode.removed, true, "destroy removes toggle idempotently");

console.log("runtime component checks passed");
