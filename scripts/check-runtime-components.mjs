import assert from "node:assert/strict";
import { MobileJoystick } from "../src/mobileJoystick.js";
import {
  MOVEMENT_STORAGE_KEY,
  MovementDebugPanel,
  loadMovementDebugConfig,
} from "../src/movementDebugPanel.js";
import { DEFAULT_MOVEMENT_CONFIG, MOVEMENT_TUNING_FIELDS } from "../src/movementConfig.js";
import { GAMEPLAY_DEBUG_STORAGE_KEY } from "../src/debrisGameplay.js";
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
let movementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
let changeCalls = 0;
let gameplayChangeCalls = 0;
let refillCalls = 0;
let panel = new MovementDebugPanel({
  enabled: false,
  movementConfig,
  documentRef: documentStub,
  storage,
});
assert.equal(documentStub.body.children.length, 0, "disabled debug panel is not created");

storage.setItem(MOVEMENT_STORAGE_KEY, '{"maxSpeed":123}');
assert.equal(
  loadMovementDebugConfig({ enabled: true, storage }).maxSpeed,
  123,
  "stored overrides load",
);
storage.setItem(MOVEMENT_STORAGE_KEY, "{");
assert.deepEqual(
  loadMovementDebugConfig({ enabled: true, storage }),
  {},
  "malformed stored JSON is ignored",
);

documentStub = new DocumentStub();
storage = createStorage();
movementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
const timerWindow = createTimerWindow();
panel = new MovementDebugPanel({
  enabled: true,
  movementConfig,
  documentRef: documentStub,
  storage,
  onConfigChange: () => changeCalls++,
  onGameplayTuningChange: () => gameplayChangeCalls++,
  onRefillEnergy: () => refillCalls++,
  getStatusSnapshot: () => ({ velocity: { x: 3, y: 4 }, facing: "right" }),
  navigatorRef: {
    clipboard: {
      async writeText(text) {
        storage.clipboard = text;
      },
    },
  },
  windowRef: timerWindow,
});
assert.equal(documentStub.body.children.length, 1, "enabled debug panel is created");
assert.deepEqual(
  [...panel.inputs.keys()],
  [...MOVEMENT_TUNING_FIELDS.map((field) => field.key), "gameplay:maxEnergy", "gameplay:clearEnergyCost", "gameplay:woodReward"],
  "panel exposes configured fields",
);
const speedInput = panel.inputs.get("maxSpeed");
speedInput.value = "9999";
speedInput.input();
assert.equal(movementConfig.maxSpeed, 300, "input is normalized");
assert.equal(changeCalls, 1, "change callback fires");
assert(
  storage.getItem(MOVEMENT_STORAGE_KEY).includes('"maxSpeed":300'),
  "changes persist",
);
speedInput.value = "nan";
speedInput.input();
assert.equal(changeCalls, 1, "NaN input is ignored");
const maxEnergyInput = panel.inputs.get("gameplay:maxEnergy");
maxEnergyInput.value = "77";
maxEnergyInput.input();
assert.equal(gameplayChangeCalls, 1, "gameplay tuning callback fires");
assert(storage.getItem(GAMEPLAY_DEBUG_STORAGE_KEY).includes("\"maxEnergy\":77"), "gameplay tuning persists separately from movement config");
panel.updateStatus();
assert(
  panel.status.textContent.includes("velocity 3.0, 4.0") &&
    panel.status.textContent.includes("facing right"),
  "status updates from snapshot",
);
await panel.copyConfig();
assert(storage.clipboard.includes('"maxSpeed": 300'), "copy writes JSON");
assert.equal(panel.copyButton.textContent, "Copied", "copy status is visible before timeout");
timerWindow.runAll();
assert.equal(panel.copyButton.textContent, "Copy config", "copy status restores");
panel.navigatorRef = {
  clipboard: {
    async writeText() {
      throw new Error("no");
    },
  },
};
await panel.copyConfig();
assert.equal(panel.copyButton.textContent, "Copy unavailable", "copy failure is visible");
timerWindow.runAll();
assert.equal(panel.copyButton.textContent, "Copy config", "copy failure status restores");
panel.resetDefaults();
assert.equal(movementConfig.maxSpeed, DEFAULT_MOVEMENT_CONFIG.maxSpeed, "reset restores defaults");
assert.equal(storage.getItem(MOVEMENT_STORAGE_KEY), null, "reset clears movement storage");
assert.equal(storage.getItem(GAMEPLAY_DEBUG_STORAGE_KEY), null, "reset clears gameplay debug storage");
assert.equal(speedInput.value, String(DEFAULT_MOVEMENT_CONFIG.maxSpeed), "reset syncs inputs");
assert.equal(maxEnergyInput.value, "100", "reset syncs gameplay inputs");
const panelNode = panel.panel;
panel.destroy();
panel.destroy();
assert.equal(panelNode.removed, true, "destroy removes DOM node and is idempotent");

let resolveClipboard;
const clipboardDeferred = new Promise((resolve) => {
  resolveClipboard = resolve;
});
documentStub = new DocumentStub();
movementConfig = { ...DEFAULT_MOVEMENT_CONFIG };
const deferredTimerWindow = createTimerWindow();
panel = new MovementDebugPanel({
  enabled: true,
  movementConfig,
  documentRef: documentStub,
  storage: createStorage(),
  navigatorRef: {
    clipboard: {
      async writeText() {
        await clipboardDeferred;
      },
    },
  },
  windowRef: deferredTimerWindow,
});
const pendingCopy = panel.copyConfig();
panel.destroy();
resolveClipboard();
await assert.doesNotReject(
  pendingCopy,
  "clipboard completion after panel destruction must not touch removed UI",
);
assert.equal(panel.copyButton, null, "destroyed panel does not resurrect its copy button");
assert.equal(deferredTimerWindow.timers.size, 0, "destroyed panel schedules no delayed UI reset");

console.log("runtime component checks passed");
