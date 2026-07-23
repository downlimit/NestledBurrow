import { createRuntimeMovementConfig, movementSpeed } from "./characterMovement.js";
import { DEFAULT_MOVEMENT_CONFIG, MOVEMENT_TUNING_FIELDS } from "./movementConfig.js";
import { DEFAULT_GAMEPLAY_TUNING, normalizeGameplayTuning } from "./debrisConfig.js";
import { clearGameplayDebugTuning, saveGameplayDebugTuning } from "./gameplayDebugTuning.js";

export const MOVEMENT_STORAGE_KEY = "nestledBurrow.movementDebug";

export function loadMovementDebugConfig({ enabled, storage = globalThis.localStorage } = {}) {
  if (!enabled) return {};
  try {
    return JSON.parse(storage?.getItem(MOVEMENT_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export class MovementDebugPanel {
  constructor({
    enabled,
    movementConfig,
    onConfigChange = () => {},
    getStatusSnapshot = () => null,
    gameplayTuning = null,
    onGameplayTuningChange = () => {},
    onRefillEnergy = () => {},
    documentRef = globalThis.document,
    storage = globalThis.localStorage,
    navigatorRef = globalThis.navigator,
    windowRef = globalThis.window,
  } = {}) {
    this.enabled = Boolean(enabled);
    this.movementConfig = movementConfig;
    this.onConfigChange = onConfigChange;
    this.getStatusSnapshot = getStatusSnapshot;
    this.gameplayTuning = gameplayTuning;
    this.onGameplayTuningChange = onGameplayTuningChange;
    this.onRefillEnergy = onRefillEnergy;
    this.documentRef = documentRef;
    this.storage = storage;
    this.navigatorRef = navigatorRef;
    this.windowRef = windowRef;
    this.inputs = new Map();
    this.timers = [];
    this.destroyed = false;

    if (!this.enabled) return;

    const panel = documentRef.createElement("section");
    panel.className = "movement-debug-panel";
    panel.setAttribute("aria-label", "Developer tuning");

    const title = documentRef.createElement("strong");
    title.textContent = "Developer tuning";
    panel.append(title);

    for (const field of MOVEMENT_TUNING_FIELDS) {
      const label = documentRef.createElement("label");
      const name = documentRef.createElement("span");
      name.textContent = field.key;

      const input = documentRef.createElement("input");
      input.type = "number";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(movementConfig[field.key]);
      input.dataset.field = field.key;
      input.addEventListener("input", () => this.applyInput(field, input));

      label.append(name, input);
      panel.append(label);
      this.inputs.set(field.key, input);
    }

    if (this.gameplayTuning) this.appendGameplayControls(panel);

    this.status = documentRef.createElement("output");
    this.status.className = "movement-debug-status";
    panel.append(this.status);

    const actions = documentRef.createElement("div");
    actions.className = "movement-debug-actions";

    const reset = documentRef.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset defaults";
    reset.addEventListener("click", () => this.resetDefaults());

    this.copyButton = documentRef.createElement("button");
    this.copyButton.type = "button";
    this.copyButton.textContent = "Copy config";
    this.copyButton.addEventListener("click", () => {
      void this.copyConfig();
    });

    actions.append(reset, this.copyButton);
    panel.append(actions);
    documentRef.body.append(panel);
    this.panel = panel;
    this.updateStatus();
  }

  applyInput(field, input) {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    Object.assign(
      this.movementConfig,
      createRuntimeMovementConfig({ ...this.movementConfig, [field.key]: value }),
    );
    input.value = String(this.movementConfig[field.key]);
    this.persist();
    this.onConfigChange(this.movementConfig);
  }

  persist() {
    try {
      this.storage?.setItem(MOVEMENT_STORAGE_KEY, JSON.stringify(this.movementConfig));
    } catch {
      // Debug persistence is optional.
    }
  }

  resetDefaults() {
    Object.assign(
      this.movementConfig,
      createRuntimeMovementConfig(DEFAULT_MOVEMENT_CONFIG),
    );
    if (this.gameplayTuning) {
      Object.assign(this.gameplayTuning, normalizeGameplayTuning(DEFAULT_GAMEPLAY_TUNING));
      clearGameplayDebugTuning(this.storage);
      this.onGameplayTuningChange(this.gameplayTuning);
    }
    try {
      this.storage?.removeItem(MOVEMENT_STORAGE_KEY);
    } catch {
      // Debug persistence is optional.
    }
    this.syncInputs();
    this.onConfigChange(this.movementConfig);
  }

  appendGameplayControls(panel) {
    for (const field of [
      { key: "maximumEnergy", min: 1, max: 999, step: 1 },
      { key: "clearingEnergyCost", min: 0, max: 999, step: 1 },
      { key: "woodReward", min: 0, max: 999, step: 1 },
    ]) {
      const label = this.documentRef.createElement("label");
      const name = this.documentRef.createElement("span");
      name.textContent = field.key;
      const input = this.documentRef.createElement("input");
      input.type = "number";
      input.min = String(field.min);
      input.max = String(field.max);
      input.step = String(field.step);
      input.value = String(this.gameplayTuning[field.key]);
      input.dataset.field = field.key;
      input.addEventListener("input", () => this.applyGameplayInput(field, input));
      label.append(name, input);
      panel.append(label);
      this.inputs.set(field.key, input);
    }
    const refill = this.documentRef.createElement("button");
    refill.type = "button";
    refill.textContent = "Refill energy";
    refill.addEventListener("click", () => this.onRefillEnergy());
    panel.append(refill);
  }

  applyGameplayInput(field, input) {
    const value = Number(input.value);
    if (!Number.isFinite(value) || !this.gameplayTuning) return;
    Object.assign(this.gameplayTuning, normalizeGameplayTuning({ ...this.gameplayTuning, [field.key]: value }));
    input.value = String(this.gameplayTuning[field.key]);
    saveGameplayDebugTuning(this.gameplayTuning, this.storage);
    this.onGameplayTuningChange(this.gameplayTuning);
  }

  syncInputs() {
    for (const [key, input] of this.inputs) {
      input.value = String(this.movementConfig[key]);
    }
  }

  async copyConfig() {
    const button = this.copyButton;
    if (!button || this.destroyed) return;

    let statusText;
    try {
      if (!this.navigatorRef?.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await this.navigatorRef.clipboard.writeText(
        JSON.stringify(this.movementConfig, null, 2),
      );
      statusText = "Copied";
    } catch {
      statusText = "Copy unavailable";
    }

    if (this.destroyed || this.copyButton !== button) return;
    button.textContent = statusText;

    const timerId = this.windowRef?.setTimeout?.(() => {
      if (!this.destroyed && this.copyButton === button) {
        button.textContent = "Copy config";
      }
    }, 1200);
    if (timerId !== undefined) this.timers.push(timerId);
  }

  updateStatus(snapshot = this.getStatusSnapshot()) {
    if (!this.status || !snapshot) return;
    const velocity = snapshot.velocity ?? { x: 0, y: 0 };
    const speed =
      typeof snapshot.speed === "number"
        ? snapshot.speed
        : movementSpeed({ velocity });
    this.status.textContent = [
      `speed ${speed.toFixed(1)} / ${this.movementConfig.maxSpeed}`,
      `velocity ${velocity.x.toFixed(1)}, ${velocity.y.toFixed(1)}`,
      `facing ${snapshot.facing}`,
    ].join("\n");
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    for (const timerId of this.timers) {
      this.windowRef?.clearTimeout?.(timerId);
    }
    this.timers = [];
    this.panel?.remove();
    this.panel = null;
    this.status = null;
    this.copyButton = null;
    this.inputs.clear();
  }
}
