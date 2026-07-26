import { DEFAULT_GAMEPLAY_TUNING, normalizeGameplayTuning } from "./resourceConfig.js";
import { clearGameplayDebugTuning, saveGameplayDebugTuning } from "./gameplayDebugTuning.js";
import { LARGE_RESOURCE_HP_MULTIPLIER } from "./resourceDomain.js";

export const MOVEMENT_STORAGE_KEY = "nestledBurrow.movementDebug";

const FIELDS = Object.freeze([
  Object.freeze({ key: "axeDamage", label: "Урон топора", min: 0, max: 999, step: 1 }),
  Object.freeze({ key: "smallLogChopHp", label: "Прочность малого бревна", min: 1, max: 99, step: 1 }),
  Object.freeze({ key: "universalHitCooldownSeconds", label: "Перезарядка удара, с", min: 0, max: 30, step: 0.1 }),
  Object.freeze({ key: "minimumFatigueSpeedMultiplier", label: "Мин. скорость при усталости", min: 0.05, max: 1, step: 0.05 }),
  Object.freeze({ key: "sleepTimeScale", label: "Скорость времени во сне", min: 1, max: 64, step: 1 }),
  Object.freeze({ key: "sleepEnergyPerGameHour", label: "Энергия сна за игровой час", min: 0, max: 999, step: 0.5 }),
  Object.freeze({ key: "backPointFollowRate", label: "Камера: скорость точки B", min: 0.1, max: 20, step: 0.1 }),
  Object.freeze({ key: "cameraLeadTransitionSeconds", label: "Камера: переход B→F, с", min: 0.1, max: 10, step: 0.1 }),
]);

export function loadMovementDebugConfig() { return {}; }

export class MovementDebugPanel {
  constructor({ enabled, gameplayTuning, onGameplayTuningChange = () => {}, onRefillEnergy = () => {}, onResetBalanceRun = () => {}, getStatusSnapshot = () => null, documentRef = globalThis.document, storage = globalThis.localStorage } = {}) {
    this.enabled = Boolean(enabled);
    this.gameplayTuning = gameplayTuning;
    this.onGameplayTuningChange = onGameplayTuningChange;
    this.onRefillEnergy = onRefillEnergy;
    this.onResetBalanceRun = onResetBalanceRun;
    this.getStatusSnapshot = getStatusSnapshot;
    this.documentRef = documentRef;
    this.storage = storage;
    this.inputs = new Map();
    this.open = false;
    this.destroyed = false;
    if (!this.enabled) return;

    const toggle = documentRef.createElement("button");
    toggle.type = "button";
    toggle.className = "balance-debug-toggle";
    toggle.textContent = "ОТЛ";
    toggle.title = "Отладка";
    toggle.setAttribute("aria-label", "Открыть отладочную панель");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", () => this.setOpen(!this.open));

    const panel = documentRef.createElement("section");
    panel.className = "movement-debug-panel";
    panel.setAttribute("aria-label", "Отладочная панель");
    panel.hidden = true;
    panel.addEventListener("pointerdown", stopEvent);
    panel.addEventListener("keydown", stopEvent);
    const title = documentRef.createElement("strong");
    title.textContent = "Отладка";
    panel.append(title);

    for (const field of FIELDS) this.appendInput(panel, field);
    const derived = documentRef.createElement("output");
    derived.className = "balance-derived";
    panel.append(derived);
    this.derived = derived;

    this.status = documentRef.createElement("output");
    this.status.className = "movement-debug-status";
    panel.append(this.status);

    const actions = documentRef.createElement("div");
    actions.className = "movement-debug-actions";
    for (const [label, handler] of [["Сбросить баланс-забег", onResetBalanceRun], ["Восполнить энергию", onRefillEnergy], ["Вернуть значения по умолчанию", () => this.resetDefaults()]]) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", handler);
      actions.append(button);
    }
    panel.append(actions);
    documentRef.body.append(toggle, panel);
    this.toggleButton = toggle;
    this.panel = panel;
    this.syncInputs();
    this.updateStatus();
  }

  appendInput(panel, field) {
    const label = this.documentRef.createElement("label");
    const name = this.documentRef.createElement("span");
    name.textContent = field.label;
    const input = this.documentRef.createElement("input");
    input.type = "number";
    input.min = String(field.min); input.max = String(field.max); input.step = String(field.step);
    input.dataset.field = field.key;
    input.addEventListener("input", () => this.applyInput(field, input));
    label.append(name, input); panel.append(label); this.inputs.set(field.key, input);
  }

  applyInput(field, input) {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    Object.assign(this.gameplayTuning, normalizeGameplayTuning({ ...this.gameplayTuning, [field.key]: value }));
    saveGameplayDebugTuning(this.gameplayTuning, this.storage);
    this.syncInputs();
    this.onGameplayTuningChange(this.gameplayTuning);
  }

  setOpen(value) {
    this.open = Boolean(value);
    if (this.panel) this.panel.hidden = !this.open;
    this.toggleButton?.setAttribute("aria-expanded", String(this.open));
  }

  setSuppressed(value) {
    const suppressed = Boolean(value);
    if (suppressed) this.setOpen(false);
    if (this.toggleButton) this.toggleButton.hidden = suppressed;
    if (this.panel) this.panel.hidden = suppressed || !this.open;
  }

  resetDefaults() {
    Object.assign(this.gameplayTuning, normalizeGameplayTuning(DEFAULT_GAMEPLAY_TUNING));
    clearGameplayDebugTuning(this.storage);
    this.syncInputs();
    this.onGameplayTuningChange(this.gameplayTuning);
  }

  syncInputs() {
    for (const field of FIELDS) {
      const input = this.inputs.get(field.key);
      if (input) input.value = String(this.gameplayTuning[field.key]);
    }
    if (this.derived) this.derived.textContent = `Прочность большого бревна: ${Math.round(this.gameplayTuning.smallLogChopHp * LARGE_RESOURCE_HP_MULTIPLIER)}`;
  }

  updateStatus(snapshot = this.getStatusSnapshot()) {
    if (!this.status || !snapshot) return;
    this.status.textContent = [`время ${snapshot.clock ?? "--:--"}`, `энергия ${Math.floor(snapshot.energy ?? 0)}`, `малые брёвна ${snapshot.smallLogsCleared ?? 0}`, `дерево ${snapshot.wood ?? 0} камень ${snapshot.stone ?? 0} рубины ${snapshot.rubies ?? 0}`].join("\n");
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.toggleButton?.remove(); this.panel?.remove(); this.inputs.clear();
    this.toggleButton = null; this.panel = null; this.status = null;
  }
}

function stopEvent(event) { event?.stopPropagation?.(); }
