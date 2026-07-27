import { DEFAULT_GAMEPLAY_TUNING, normalizeGameplayTuning } from "./resourceConfig.js";
import { clearGameplayDebugTuning, saveGameplayDebugTuning } from "./gameplayDebugTuning.js";
import { LARGE_RESOURCE_HP_MULTIPLIER } from "./resourceDomain.js";
import { attachEditorAuthoringRuntime } from "./editorAuthoringRuntime.js";

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
  constructor({ enabled, gameplayTuning, onGameplayTuningChange = () => {}, onRefillEnergy = () => {}, onAddCookedDish = () => {}, onColliderVisibilityChange = () => {}, onColliderEditModeChange = () => {}, onColliderDraftConfirm = () => {}, onResetBalanceRun = () => {}, getStatusSnapshot = () => null, documentRef = globalThis.document, storage = globalThis.localStorage } = {}) {
    this.enabled = Boolean(enabled);
    this.gameplayTuning = gameplayTuning;
    this.onGameplayTuningChange = onGameplayTuningChange;
    this.onRefillEnergy = onRefillEnergy;
    this.onResetBalanceRun = onResetBalanceRun;
    this.onColliderDraftConfirm = onColliderDraftConfirm;
    this.getStatusSnapshot = getStatusSnapshot;
    this.documentRef = documentRef;
    this.storage = storage;
    this.inputs = new Map();
    this.open = false;
    this.destroyed = false;
    this.scene = null;
    this.authoringRuntime = null;
    this.startingLayoutRestoreListener = null;
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

    const colliderLabel = documentRef.createElement("label");
    const colliderName = documentRef.createElement("span");
    colliderName.textContent = "Показывать коллайдеры";
    const colliderCheckbox = documentRef.createElement("input");
    colliderCheckbox.type = "checkbox";
    colliderCheckbox.addEventListener("change", () => onColliderVisibilityChange(Boolean(colliderCheckbox.checked)));
    colliderLabel.append(colliderName, colliderCheckbox);
    panel.append(colliderLabel);
    this.colliderCheckbox = colliderCheckbox;

    const colliderEditLabel = documentRef.createElement("label");
    const colliderEditName = documentRef.createElement("span");
    colliderEditName.textContent = "Редактировать коллайдеры";
    const colliderEditCheckbox = documentRef.createElement("input");
    colliderEditCheckbox.type = "checkbox";
    colliderEditCheckbox.addEventListener("change", () => {
      const active = Boolean(colliderEditCheckbox.checked);
      if (active && !colliderCheckbox.checked) {
        colliderCheckbox.checked = true;
        onColliderVisibilityChange(true);
      }
      this.colliderEditor.hidden = !active;
      onColliderEditModeChange(active);
    });
    colliderEditLabel.append(colliderEditName, colliderEditCheckbox);
    panel.append(colliderEditLabel);
    this.colliderEditCheckbox = colliderEditCheckbox;

    const colliderEditor = documentRef.createElement("div");
    colliderEditor.className = "collider-debug-editor";
    colliderEditor.hidden = true;
    const colliderEditorStatus = documentRef.createElement("output");
    colliderEditorStatus.textContent = "Кликните по объекту";
    colliderEditor.append(colliderEditorStatus);
    const colliderConfirm = documentRef.createElement("button");
    colliderConfirm.type = "button";
    colliderConfirm.textContent = "Применить в проект";
    colliderConfirm.addEventListener("click", () => void this.applyColliderDraftToProject());
    colliderEditor.append(colliderConfirm);
    panel.append(colliderEditor);
    this.colliderEditor = colliderEditor;
    this.colliderEditorStatus = colliderEditorStatus;
    this.colliderConfirmButton = colliderConfirm;

    this.authoringStatus = documentRef.createElement("output");
    this.authoringStatus.className = "movement-debug-status";
    panel.append(this.authoringStatus);

    const actions = documentRef.createElement("div");
    actions.className = "movement-debug-actions";
    const actionDefinitions = [
      ["Сбросить баланс-забег", onResetBalanceRun],
      ["Восполнить энергию", onRefillEnergy],
      ["Добавить готовое блюдо", onAddCookedDish],
      ["Вернуть значения по умолчанию", () => this.resetDefaults()],
      ["Сохранить расстановку как стартовую", () => void this.persistStartingLayout()],
    ];
    for (const [label, handler] of actionDefinitions) {
      const button = documentRef.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", handler);
      actions.append(button);
      if (label === "Сохранить расстановку как стартовую") this.layoutSaveButton = button;
    }
    panel.append(actions);
    documentRef.body.append(toggle, panel);
    this.toggleButton = toggle;
    this.panel = panel;
    this.syncInputs();
    this.updateStatus();

    if (typeof window !== "undefined" && documentRef === globalThis.document) {
      void this.attachSceneRuntime();
    }
  }

  async resolveWorldScene() {
    if (this.scene && !this.scene.sys?.isDestroyed?.()) return this.scene;
    const module = await import("phaser");
    const Phaser = module.default ?? module;
    for (const game of Phaser.GAMES ?? []) {
      const scene = game?.scene?.getScene?.("world") ?? game?.scene?.keys?.world ?? null;
      if (scene) return scene;
    }
    return null;
  }

  async attachSceneRuntime() {
    try {
      const scene = await this.resolveWorldScene();
      if (!scene || this.destroyed) return;
      this.scene = scene;
      this.authoringRuntime = attachEditorAuthoringRuntime(scene, {
        storage: this.storage,
        confirmColliderDraft: this.onColliderDraftConfirm,
      });
      this.startingLayoutRestoreListener = () => {
        try {
          const layout = this.authoringRuntime?.restoreStartingLayout?.();
          this.setAuthoringStatus(layout ? "Стартовая расстановка загружена" : "Стартовая расстановка: базовая");
        } catch (error) {
          console.warn("Starting layout restore failed", error);
          this.setAuthoringStatus("Ошибка загрузки стартовой расстановки", true);
        }
      };
      scene.events?.once?.("update", this.startingLayoutRestoreListener);
    } catch (error) {
      console.warn("Editor authoring runtime unavailable", error);
      this.setAuthoringStatus("Редактор проекта недоступен", true);
    }
  }

  async applyColliderDraftToProject() {
    if (this.colliderConfirmButton) this.colliderConfirmButton.disabled = true;
    this.setAuthoringStatus("Сохранение коллайдеров в проект…");
    try {
      if (!this.authoringRuntime?.applyColliderDraftToProject) {
        const localResult = this.onColliderDraftConfirm();
        this.setAuthoringStatus(localResult?.status === "empty" ? "Сначала выберите коллайдер" : "Коллайдер применён локально", localResult?.status === "empty");
        return;
      }
      const result = await this.authoringRuntime.applyColliderDraftToProject();
      if (!result || result.status === "empty") {
        this.setAuthoringStatus("Сначала выберите коллайдер", true);
        return;
      }
      this.setAuthoringStatus("Коллайдеры сохранены в проекте");
    } catch (error) {
      console.warn("Collider project save failed", error);
      this.setAuthoringStatus("Коллайдер применён локально, но проект не записан: нужен локальный dev-preview", true);
    } finally {
      if (this.colliderConfirmButton) this.colliderConfirmButton.disabled = false;
    }
  }

  async persistStartingLayout() {
    if (this.layoutSaveButton) this.layoutSaveButton.disabled = true;
    this.setAuthoringStatus("Сохранение стартовой расстановки…");
    try {
      if (!this.authoringRuntime?.saveStartingLayout) throw new Error("Authoring runtime is unavailable");
      const layout = await this.authoringRuntime.saveStartingLayout();
      const count = (layout?.buildObjects?.length ?? 0) + (layout?.facilities?.length ?? 0) + (layout?.beds?.length ?? 0);
      this.setAuthoringStatus(`Стартовая расстановка сохранена в проекте: ${count} объектов`);
    } catch (error) {
      console.warn("Starting layout save failed", error);
      this.setAuthoringStatus("Ошибка сохранения расстановки: нужен локальный dev-preview", true);
    } finally {
      if (this.layoutSaveButton) this.layoutSaveButton.disabled = false;
    }
  }

  setAuthoringStatus(message, error = false) {
    if (!this.authoringStatus) return;
    this.authoringStatus.textContent = message;
    if (this.authoringStatus.dataset) this.authoringStatus.dataset.status = error ? "error" : "ok";
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

  setColliderEditorState(state) {
    if (!this.colliderEditorStatus) return;
    this.colliderEditorStatus.textContent = state?.id
      ? `${state.id}\n${Math.round(state.width)} × ${Math.round(state.height)} px`
      : "Кликните по объекту";
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.startingLayoutRestoreListener) this.scene?.events?.off?.("update", this.startingLayoutRestoreListener);
    this.authoringRuntime?.destroy?.();
    this.toggleButton?.remove(); this.panel?.remove(); this.inputs.clear();
    this.toggleButton = null; this.panel = null; this.status = null;
    this.colliderCheckbox = null;
    this.colliderEditCheckbox = null; this.colliderEditor = null; this.colliderEditorStatus = null;
    this.colliderConfirmButton = null; this.layoutSaveButton = null; this.authoringStatus = null;
    this.authoringRuntime = null; this.scene = null; this.startingLayoutRestoreListener = null;
  }
}

function stopEvent(event) { event?.stopPropagation?.(); }
