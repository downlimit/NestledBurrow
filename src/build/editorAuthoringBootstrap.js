import { MovementDebugPanel } from "../devtools/movementDebugPanel.js";
import { INTERACTION_APPROACH_DIRECTIONS } from "../interaction/interactionDirections.js";
import { perimeterInteractionPointEntries } from "../interaction/interactionApproach.js";
import {
  ASSET_RENDER_MODES,
  ASSET_PROFILES_VERSION,
  DEFAULT_ASSET_PROFILES,
  INTERACTION_TIMELINE_FACING_MODES,
  INTERACTION_TIMELINE_SCREEN_ORIENTATIONS,
  normalizeAssetRenderMode,
  normalizeInteractionPadding,
  normalizeInteractionTimeline,
  normalizeVisualCropInsets,
  saveAssetProfiles,
} from "./assetProfiles.js";
import {
  applyVisualCrop,
  cropInsetsFromVisibleBounds,
  cropVisibleBounds,
  getVisualCropSourceBounds,
} from "./assetVisualCrop.js";
import {
  editRectDraftByArrow,
  getColliderResizeEdges,
  resizeColliderDraft,
} from "./colliderResize.js";
import { getCurrentWorldScene } from "./worldSceneRegistry.js";
import {
  assetAuthoringColliderSelectionPoint,
  collectAssetAuthoringInstances,
} from "./assetAuthoringRegistry.js";

const retryDelayMs = 50;
const originalAttachSceneRuntime = MovementDebugPanel.prototype.attachSceneRuntime;
const originalPersistStartingLayout = MovementDebugPanel.prototype.persistStartingLayout;
const originalSetEditorMode = MovementDebugPanel.prototype.setEditorMode;
const originalDestroy = MovementDebugPanel.prototype.destroy;

const MODE_LABELS = Object.freeze({
  collider: "Коллайдер",
  pivot: "Пивот",
  "visual-offset": "Оффсет визуала",
  crop: "Обрезка визуала",
  interaction: "Точки подхода",
  "interaction-point": "Точка взаимодействия",
  render: "Режим рендера",
  timeline: "Таймлайн взаимодействия",
});
const RENDER_MODE_LABELS = Object.freeze({
  [ASSET_RENDER_MODES.belowCharacter]: "Всегда под персонажем",
  [ASSET_RENDER_MODES.pivotDepth]: "По глубине пивота",
  [ASSET_RENDER_MODES.aboveCharacter]: "Всегда поверх персонажа",
});
const TIMELINE_FACING_LABELS = Object.freeze({
  [INTERACTION_TIMELINE_FACING_MODES.keepCurrent]: "Как в момент взаимодействия",
  [INTERACTION_TIMELINE_FACING_MODES.up]: "Вверх",
  [INTERACTION_TIMELINE_FACING_MODES.down]: "Вниз",
  [INTERACTION_TIMELINE_FACING_MODES.left]: "Влево",
  [INTERACTION_TIMELINE_FACING_MODES.right]: "Вправо",
});
const TIMELINE_SCREEN_ORIENTATION_LABELS = Object.freeze({
  [INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.original]: "Исходная",
  [INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.clockwise90]: "90° по часовой",
  [INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.counterClockwise90]: "90° против часовой",
  [INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.rotate180]: "180°",
});
const DIRECTION_BUTTONS = Object.freeze([
  ["top-left", "↖"], ["top", "↑"], ["top-right", "↗"],
  ["left", "←"], [null, "·"], ["right", "→"],
  ["bottom-left", "↙"], ["bottom", "↓"], ["bottom-right", "↘"],
]);
const INTERACTION_OWNER_PATCH = Symbol("nestledBurrowInteractionProfilePatch");

function delay(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

function isAuthoringSceneReady(scene) {
  return Boolean(
    scene?.worldBuildCoordinator?.getPlacedObjects
      && scene?.worldLayout,
  );
}

MovementDebugPanel.prototype.resolveWorldScene = async function resolveRegisteredWorldScene() {
  while (!this.destroyed) {
    const scene = getCurrentWorldScene();
    if (scene) return scene;
    await delay(retryDelayMs);
  }
  return null;
};

async function waitForAuthoringScene(panel) {
  while (!panel.destroyed) {
    const scene = await panel.resolveWorldScene();
    if (scene && isAuthoringSceneReady(scene)) return scene;
    await delay(retryDelayMs);
  }
  return null;
}

MovementDebugPanel.prototype.attachSceneRuntime = function attachSceneRuntimeOnce() {
  if (this.destroyed || this.authoringRuntime) return Promise.resolve(this.authoringRuntime);
  if (this.authoringRuntimeAttachPromise) return this.authoringRuntimeAttachPromise;

  const promise = (async () => {
    const scene = await waitForAuthoringScene(this);
    if (!scene || this.destroyed) return null;

    this.scene = scene;
    await originalAttachSceneRuntime.call(this);
    if (!this.authoringRuntime || this.destroyed) return this.authoringRuntime;

    if (this.startingLayoutRestoreListener) {
      scene.events?.off?.("update", this.startingLayoutRestoreListener);
      this.startingLayoutRestoreListener = null;
    }

    try {
      const layout = this.authoringRuntime.restoreStartingLayout?.();
      this.setAuthoringStatus(
        layout
          ? "Стартовая расстановка загружена из браузера/проекта"
          : "Стартовая расстановка: базовая",
      );
    } catch (error) {
      console.warn("Starting layout restore failed", error);
      this.setAuthoringStatus("Ошибка загрузки стартовой расстановки", true);
    }

    installAssetAuthoringEnhancements(this, scene);
    return this.authoringRuntime;
  })().finally(() => {
    if (this.authoringRuntimeAttachPromise === promise) this.authoringRuntimeAttachPromise = null;
  });

  this.authoringRuntimeAttachPromise = promise;
  return promise;
};

MovementDebugPanel.prototype.persistStartingLayout = async function persistStartingLayoutAfterAttach() {
  if (!this.authoringRuntime) await this.attachSceneRuntime();
  return originalPersistStartingLayout.call(this);
};

MovementDebugPanel.prototype.applyColliderDraftToProject = async function applyAssetProfileLive() {
  if (!this.authoringRuntime) await this.attachSceneRuntime();
  const state = this.assetAuthoringEnhancement;
  const hasSelection = Boolean(
    this.scene?.colliderEditSelection
      || this.authoringRuntime?.getPivotSelection?.()
      || this.authoringRuntime?.getVisualOffsetSelection?.()
      || this.authoringRuntime?.getInteractionPointSelection?.()
      || state?.cropSelection
      || state?.interactionSelection
      || state?.renderSelection
      || state?.timelineSelection,
  );
  if (!hasSelection) {
    this.setAuthoringStatus("Сначала выберите ассет", true);
    return;
  }

  if (this.colliderConfirmButton) this.colliderConfirmButton.disabled = true;
  this.setAuthoringStatus("Применение профиля ассета…");
  try {
    this.scene?.confirmColliderDraft?.();
    saveAssetProfiles(this.scene?.assetProfiles ?? {}, this.storage);
    this.scene?.interactionRuntime?.refresh?.();
    this.setAuthoringStatus("Профиль применён в живой сцене и сохранён локально — перезагрузка не требуется");
  } catch (error) {
    console.warn("Asset profile live apply failed", error);
    this.setAuthoringStatus("Ошибка применения профиля ассета", true);
  } finally {
    if (this.colliderConfirmButton) this.colliderConfirmButton.disabled = false;
  }
};

MovementDebugPanel.prototype.setEditorMode = function setExtendedEditorMode(mode) {
  originalSetEditorMode.call(this, mode);
  const state = this.assetAuthoringEnhancement;
  if (!state) return;
  if (state.cropResetButton) state.cropResetButton.hidden = mode !== "crop";
  if (state.directionGrid) state.directionGrid.hidden = mode !== "interaction";
  if (state.interactionControls) state.interactionControls.hidden = mode !== "interaction";
  if (state.renderControls) state.renderControls.hidden = mode !== "render";
  if (state.timelineControls) state.timelineControls.hidden = mode !== "timeline";
  if (this.colliderConfirmButton) this.colliderConfirmButton.textContent = {
    collider: "Применить коллайдер",
    pivot: "Применить пивот",
    "visual-offset": "Применить оффсет",
    crop: "Применить обрезку",
    interaction: "Применить точки подхода",
    "interaction-point": "Применить точку взаимодействия",
    render: "Применить режим рендера",
    timeline: "Применить таймлайн",
  }[mode] ?? "Сохранить профиль ассета";
};

MovementDebugPanel.prototype.setCropEditorState = function setCropEditorState(state) {
  if (!this.colliderEditorStatus) return;
  this.colliderEditorStatus.textContent = state?.profileKey
    ? `${state.profileKey}\nвидимая область ${state.width} × ${state.height} px\nстрелки: сдвиг · Ctrl: расширить · Alt: сузить`
    : "Кликните по спрайту; процедурные visuals не обрезаются";
};

MovementDebugPanel.prototype.setInteractionEditorState = function setInteractionEditorState(state) {
  if (!this.colliderEditorStatus) return;
  this.colliderEditorStatus.textContent = state?.profileKey
    ? `${state.profileKey}\nдистанция: ${state.interactionPadding} px от коллайдера\nразрешено направлений: ${state.directions.length}/8\nкликните по маркеру или кнопке направления`
    : "Кликните по объекту для настройки точек подхода";
  syncDirectionButtons(this, state?.directions ?? []);
};

MovementDebugPanel.prototype.setInteractionPointEditorState = function setInteractionPointEditorState(state) {
  if (!this.colliderEditorStatus) return;
  this.colliderEditorStatus.textContent = state?.profileKey
    ? `${state.profileKey}\nточка ${state.offset.x}, ${state.offset.y} px\nстрелки: 1 px`
    : "Кликните по спрайту для редактирования точки взаимодействия";
};

MovementDebugPanel.prototype.setRenderEditorState = function setRenderEditorState(state) {
  if (!this.colliderEditorStatus) return;
  this.colliderEditorStatus.textContent = state?.profileKey
    ? `${state.profileKey}\n${RENDER_MODE_LABELS[state.renderMode]}`
    : "Кликните по спрайту для выбора режима рендера";
};

MovementDebugPanel.prototype.setTimelineEditorState = function setTimelineEditorState(state) {
  if (!this.colliderEditorStatus) return;
  this.colliderEditorStatus.textContent = state?.profileKey
    ? `${state.profileKey}\nточка ${state.timeline.positionOffset.x}, ${state.timeline.positionOffset.y} px\nстрелки: 1 px`
    : "Кликните по спрайту для настройки таймлайна взаимодействия";
};

MovementDebugPanel.prototype.destroy = function destroyExtendedAuthoringPanel() {
  teardownAssetAuthoringEnhancements(this);
  return originalDestroy.call(this);
};

function installAssetAuthoringEnhancements(panel, scene) {
  if (panel.assetAuthoringEnhancement?.scene === scene) return;
  teardownAssetAuthoringEnhancements(panel);
  const state = {
    scene,
    mode: null,
    modeCheckboxes: new Map(),
    cropSelection: null,
    cropDrag: null,
    interactionSelection: null,
    interactionPointSelection: null,
    interactionPointDrag: null,
    renderSelection: null,
    timelineSelection: null,
    timelineDrag: null,
    selectedAsset: null,
    frame: 0,
    graphics: scene.add?.graphics?.().setDepth?.(8978) ?? null,
  };
  panel.assetAuthoringEnhancement = state;
  installCompactAuthoringUi(panel, state);
  installAuthoringInput(panel, state);
  patchInteractionOwners(scene);
  applyAllProfileCrops(scene);
  setAuthoringMode(panel, null);
}

function installCompactAuthoringUi(panel, state) {
  const documentRef = panel.documentRef;
  if (!documentRef?.createElement || !panel.panel) return;
  const section = documentRef.createElement("div");
  section.className = "authoring-debug-section";
  const heading = documentRef.createElement("strong");
  heading.textContent = "Авторинг ассетов";
  section.append(heading);

  const visibilityTitle = documentRef.createElement("span");
  visibilityTitle.className = "authoring-debug-caption";
  visibilityTitle.textContent = "Отображение";
  const visibility = documentRef.createElement("div");
  visibility.className = "authoring-option-list";
  renameCheckboxLabel(panel.colliderCheckbox, "Дебаг рендер");
  renameCheckboxLabel(panel.buildGridCheckbox, "Строительная сетка");
  appendExistingLabel(visibility, panel.colliderCheckbox);
  appendExistingLabel(visibility, panel.buildGridCheckbox);
  section.append(visibilityTitle, visibility);
  panel.colliderCheckbox?.addEventListener?.("change", () => {
    if (!panel.colliderCheckbox.checked) setAuthoringMode(panel, null);
    renderEnhancedAuthoring(panel);
  });

  const modeTitle = documentRef.createElement("span");
  modeTitle.className = "authoring-debug-caption";
  modeTitle.textContent = "Редактирование";
  const modes = documentRef.createElement("div");
  modes.className = "authoring-option-list authoring-mode-list";
  renameCheckboxLabel(panel.colliderEditCheckbox, MODE_LABELS.collider);
  renameCheckboxLabel(panel.pivotEditCheckbox, MODE_LABELS.pivot);
  renameCheckboxLabel(panel.visualOffsetEditCheckbox, MODE_LABELS["visual-offset"]);
  registerModeCheckbox(panel, state, modes, "collider", panel.colliderEditCheckbox);
  registerModeCheckbox(panel, state, modes, "pivot", panel.pivotEditCheckbox);
  registerModeCheckbox(panel, state, modes, "visual-offset", panel.visualOffsetEditCheckbox);
  registerModeCheckbox(panel, state, modes, "crop", createModeCheckbox(documentRef, MODE_LABELS.crop));
  registerModeCheckbox(panel, state, modes, "interaction", createModeCheckbox(documentRef, MODE_LABELS.interaction));
  registerModeCheckbox(panel, state, modes, "interaction-point", createModeCheckbox(documentRef, MODE_LABELS["interaction-point"]));
  registerModeCheckbox(panel, state, modes, "render", createModeCheckbox(documentRef, MODE_LABELS.render));
  registerModeCheckbox(panel, state, modes, "timeline", createModeCheckbox(documentRef, MODE_LABELS.timeline));
  section.append(modeTitle, modes);
  panel.panel.insertBefore?.(section, panel.colliderEditor ?? null);
  state.section = section;

  const cropResetButton = documentRef.createElement("button");
  cropResetButton.type = "button";
  cropResetButton.className = "collider-debug-wide-action";
  cropResetButton.textContent = "Сбросить обрезку";
  cropResetButton.hidden = true;
  cropResetButton.addEventListener("click", () => resetSelectedCrop(panel));
  panel.colliderEditor?.append?.(cropResetButton);
  state.cropResetButton = cropResetButton;

  const directionGrid = documentRef.createElement("div");
  directionGrid.className = "interaction-direction-grid";
  directionGrid.style.gridColumn = "1 / -1";
  directionGrid.style.gridTemplateColumns = "repeat(3, 32px)";
  directionGrid.hidden = true;
  for (const [direction, label] of DIRECTION_BUTTONS) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (!direction) {
      button.disabled = true;
      button.setAttribute?.("aria-hidden", "true");
    } else {
      button.dataset.direction = direction;
      button.title = direction;
      button.setAttribute?.("aria-pressed", "false");
      button.addEventListener("click", () => toggleInteractionDirection(panel, direction));
    }
    directionGrid.append(button);
  }
  panel.colliderEditor?.append?.(directionGrid);
  state.directionGrid = directionGrid;

  const interactionControls = documentRef.createElement("div");
  interactionControls.className = "authoring-profile-controls";
  interactionControls.hidden = true;
  const interactionPadding = appendTimelineNumber(
    documentRef,
    interactionControls,
    "Дистанция интеракта от коллайдера, px",
  );
  interactionPadding.min = "1";
  interactionPadding.max = "128";
  interactionPadding.step = "1";
  interactionPadding.addEventListener("input", () => applySelectedInteractionPadding(panel));
  panel.colliderEditor?.append?.(interactionControls);
  state.interactionControls = interactionControls;
  state.interactionPadding = interactionPadding;

  const renderControls = documentRef.createElement("div");
  renderControls.className = "authoring-profile-controls";
  renderControls.hidden = true;
  const renderLabel = documentRef.createElement("label");
  const renderName = documentRef.createElement("span");
  renderName.textContent = "Порядок";
  const renderSelect = documentRef.createElement("select");
  for (const [value, label] of Object.entries(RENDER_MODE_LABELS)) {
    const option = documentRef.createElement("option");
    option.value = value;
    option.textContent = label;
    renderSelect.append(option);
  }
  renderSelect.addEventListener("change", () => applySelectedRenderMode(panel, renderSelect.value));
  renderLabel.append(renderName, renderSelect);
  renderControls.append(renderLabel);
  panel.colliderEditor?.append?.(renderControls);
  state.renderControls = renderControls;
  state.renderSelect = renderSelect;

  const timelineControls = documentRef.createElement("div");
  timelineControls.className = "authoring-profile-controls";
  timelineControls.hidden = true;
  const timelineEnabled = appendTimelineCheckbox(documentRef, timelineControls, "Есть таймлайн");
  const timelineWalk = appendTimelineCheckbox(
    documentRef,
    timelineControls,
    "Перс играет анимацию ходьбы во время релокейта",
  );
  const timelineEnter = appendTimelineNumber(documentRef, timelineControls, "Вход, мс");
  const timelineExit = appendTimelineNumber(documentRef, timelineControls, "Выход, мс");
  const timelineFacing = appendTimelineSelect(
    documentRef,
    timelineControls,
    "Куда смотрит персонаж",
    TIMELINE_FACING_LABELS,
  );
  const timelineScreenOrientation = appendTimelineSelect(
    documentRef,
    timelineControls,
    "Ориентация в скринспейсе",
    TIMELINE_SCREEN_ORIENTATION_LABELS,
  );
  const syncTimeline = () => applySelectedTimelineControls(panel);
  timelineEnabled.addEventListener("change", syncTimeline);
  timelineWalk.addEventListener("change", syncTimeline);
  timelineEnter.addEventListener("input", syncTimeline);
  timelineExit.addEventListener("input", syncTimeline);
  timelineFacing.addEventListener("change", syncTimeline);
  timelineScreenOrientation.addEventListener("change", syncTimeline);
  panel.colliderEditor?.append?.(timelineControls);
  state.timelineControls = timelineControls;
  state.timelineEnabled = timelineEnabled;
  state.timelineWalk = timelineWalk;
  state.timelineEnter = timelineEnter;
  state.timelineExit = timelineExit;
  state.timelineFacing = timelineFacing;
  state.timelineScreenOrientation = timelineScreenOrientation;
}

function appendTimelineCheckbox(documentRef, container, text) {
  const label = documentRef.createElement("label");
  const name = documentRef.createElement("span");
  name.textContent = text;
  const input = documentRef.createElement("input");
  input.type = "checkbox";
  label.append(name, input);
  container.append(label);
  return input;
}

function appendTimelineNumber(documentRef, container, text) {
  const label = documentRef.createElement("label");
  const name = documentRef.createElement("span");
  name.textContent = text;
  const input = documentRef.createElement("input");
  input.type = "number";
  input.min = "0";
  input.max = "10000";
  input.step = "50";
  label.append(name, input);
  container.append(label);
  return input;
}

function appendTimelineSelect(documentRef, container, text, options) {
  const label = documentRef.createElement("label");
  const name = documentRef.createElement("span");
  name.textContent = text;
  const select = documentRef.createElement("select");
  for (const [value, optionText] of Object.entries(options)) {
    const option = documentRef.createElement("option");
    option.value = value;
    option.textContent = optionText;
    select.append(option);
  }
  label.append(name, select);
  container.append(label);
  return select;
}

function createModeCheckbox(documentRef, labelText) {
  const label = documentRef.createElement("label");
  const name = documentRef.createElement("span");
  name.textContent = labelText;
  const checkbox = documentRef.createElement("input");
  checkbox.type = "checkbox";
  label.append(name, checkbox);
  return checkbox;
}

function appendExistingLabel(container, checkbox) {
  const label = checkbox?.parentElement;
  if (label) container.append(label);
}

function renameCheckboxLabel(checkbox, text) {
  const label = checkbox?.parentElement;
  const name = label?.querySelector?.("span") ?? label?.children?.[0];
  if (name) name.textContent = text;
}

function registerModeCheckbox(panel, state, container, mode, checkbox) {
  if (!checkbox) return;
  state.modeCheckboxes.set(mode, checkbox);
  appendExistingLabel(container, checkbox);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) setAuthoringMode(panel, mode);
    else if (state.mode === mode) setAuthoringMode(panel, null);
  });
}

function setAuthoringMode(panel, mode) {
  const state = panel.assetAuthoringEnhancement;
  if (!state) return;
  state.mode = mode;
  for (const [candidate, checkbox] of state.modeCheckboxes) checkbox.checked = candidate === mode;
  const scene = state.scene;
  if (mode && !panel.colliderCheckbox?.checked) {
    panel.colliderCheckbox.checked = true;
    scene.setColliderDebugVisible?.(true);
  }
  scene.setColliderEditMode?.(mode === "collider");
  scene.setPivotEditMode?.(mode === "pivot");
  scene.setVisualOffsetEditMode?.(mode === "visual-offset");
  if (mode !== "crop") {
    state.cropSelection = null;
    state.cropDrag = null;
  }
  if (mode !== "interaction") state.interactionSelection = null;
  if (mode !== "interaction-point") {
    state.interactionPointSelection = null;
    state.interactionPointDrag = null;
  }
  if (mode !== "render") state.renderSelection = null;
  if (mode !== "timeline") {
    state.timelineSelection = null;
    state.timelineDrag = null;
  }
  scene.interactionPointEditEnabled = mode === "interaction-point" || mode === "timeline";
  panel.setEditorMode(mode);
  restoreSelectedAssetForMode(panel, mode);
  panel.syncCollisionToggle?.();
  if (mode === "collider") scene.syncColliderEditorPanel?.();
  else if (mode === "pivot") panel.setPivotEditorState(panel.authoringRuntime?.getPivotSelection?.());
  else if (mode === "visual-offset") panel.setVisualOffsetEditorState(panel.authoringRuntime?.getVisualOffsetSelection?.());
  else if (mode === "crop") panel.setCropEditorState(cropSelectionState(panel));
  else if (mode === "interaction") panel.setInteractionEditorState(interactionSelectionState(panel));
  else if (mode === "interaction-point") panel.setInteractionPointEditorState(interactionPointSelectionState(panel));
  else if (mode === "render") panel.setRenderEditorState(renderSelectionState(panel));
  else if (mode === "timeline") panel.setTimelineEditorState(timelineSelectionState(panel));
  syncRenderControls(panel);
  syncTimelineControls(panel);
  syncInteractionControls(panel);
  renderEnhancedAuthoring(panel);
}

function rememberSelectedAsset(state, instance) {
  state.selectedAsset = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
}

function restoreSelectedAssetForMode(panel, mode) {
  const state = panel.assetAuthoringEnhancement;
  const instance = selectedInstance(state?.scene, state?.selectedAsset);
  if (!instance || !mode) return;
  const scene = state.scene;
  const visualBounds = instanceWorldBounds(scene, instance);
  const visualPoint = {
    x: (visualBounds.left + visualBounds.right) / 2,
    y: (visualBounds.top + visualBounds.bottom) / 2,
  };
  if (mode === "collider") {
    const colliderPoint = assetAuthoringColliderSelectionPoint(scene, instance) ?? visualPoint;
    scene.beginColliderEditPointer?.({ worldX: colliderPoint.x, worldY: colliderPoint.y });
    return;
  }
  if (mode === "pivot") {
    panel.setPivotEditorState(panel.authoringRuntime?.selectPivotAt?.(visualPoint));
    scene.renderPivotDebug?.();
    return;
  }
  if (mode === "visual-offset") {
    panel.setVisualOffsetEditorState(panel.authoringRuntime?.selectVisualOffsetAt?.(visualPoint));
    scene.renderVisualOffsetDebug?.();
    return;
  }
  if (mode === "crop") {
    state.cropSelection = cropTargetForInstance(instance)
      ? { id: instance.id, profileKey: instance.profileKey }
      : null;
    return;
  }
  if (mode === "interaction") {
    state.interactionSelection = { id: instance.id, profileKey: instance.profileKey };
    return;
  }
  if (mode === "interaction-point") {
    const selection = panel.authoringRuntime?.selectInteractionPointAt?.(visualPoint);
    state.interactionPointSelection = selection ? { id: selection.id, profileKey: selection.profileKey } : null;
    return;
  }
  if (mode === "render") {
    state.renderSelection = { id: instance.id, profileKey: instance.profileKey };
    return;
  }
  if (mode === "timeline") state.timelineSelection = { id: instance.id, profileKey: instance.profileKey };
}

function installAuthoringInput(panel, state) {
  const scene = state.scene;
  const input = scene.input;
  if (!input) return;
  const listeners = {
    down: (pointer) => handleEnhancedPointerDown(panel, pointer),
    move: (pointer) => handleEnhancedPointerMove(panel, pointer),
    up: () => {
      state.cropDrag = null;
      state.interactionPointDrag = null;
      state.timelineDrag = null;
    },
    key: (event) => handleEnhancedKeyDown(panel, event),
    update: () => {
      state.frame += 1;
      if (state.frame % 30 === 0) {
        patchInteractionOwners(scene);
        applyAllProfileCrops(scene);
      }
      if ((state.mode || scene.colliderDebugVisible) && state.frame % 8 === 0) renderEnhancedAuthoring(panel);
    },
  };
  input.on("pointerdown", listeners.down);
  input.on("pointermove", listeners.move);
  input.on("pointerup", listeners.up);
  input.keyboard?.on?.("keydown", listeners.key);
  scene.events?.on?.("update", listeners.update);
  state.listeners = listeners;

  const originalDirection = scene.getControllerMoveDirection?.bind(scene);
  if (originalDirection) {
    state.originalGetControllerMoveDirection = originalDirection;
    state.directionWrapper = () => state.mode ? { x: 0, y: 0 } : originalDirection();
    scene.getControllerMoveDirection = state.directionWrapper;
  }
}

function teardownAssetAuthoringEnhancements(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state) return;
  const scene = state.scene;
  const listeners = state.listeners;
  if (listeners && scene?.input) {
    scene.input.off("pointerdown", listeners.down);
    scene.input.off("pointermove", listeners.move);
    scene.input.off("pointerup", listeners.up);
    scene.input.keyboard?.off?.("keydown", listeners.key);
    scene.events?.off?.("update", listeners.update);
  }
  if (scene?.getControllerMoveDirection === state.directionWrapper && state.originalGetControllerMoveDirection) {
    scene.getControllerMoveDirection = state.originalGetControllerMoveDirection;
  }
  state.graphics?.destroy?.();
  state.section?.remove?.();
  state.directionGrid?.remove?.();
  state.interactionControls?.remove?.();
  state.cropResetButton?.remove?.();
  state.renderControls?.remove?.();
  state.timelineControls?.remove?.();
  if (scene) scene.interactionPointEditEnabled = false;
  panel.assetAuthoringEnhancement = null;
}

function handleEnhancedPointerDown(panel, pointer) {
  const state = panel.assetAuthoringEnhancement;
  const scene = state?.scene;
  if (!state?.mode || scene?.buildMode?.isActive?.()) return;
  const point = pointerPoint(pointer);
  if (state.mode === "crop") {
    const current = cropSelectionState(panel);
    const edges = current ? getColliderResizeEdges(point, current.visibleWorldBounds) : null;
    if (edges) {
      state.cropDrag = { edges, startPoint: point, startVisible: { ...current.visibleWorldBounds } };
      return;
    }
    const instance = findAuthoringInstanceAt(scene, point, { requireCrop: true });
    rememberSelectedAsset(state, instance);
    state.cropSelection = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
    const selection = cropSelectionState(panel);
    panel.setCropEditorState(selection);
    if (!selection && instance) panel.setAuthoringStatus("Этот visual не поддерживает обрезку спрайта", true);
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "interaction") {
    const current = interactionSelectionState(panel);
    const hit = current?.entries.find(({ point: marker }) => Math.hypot(marker.x - point.x, marker.y - point.y) <= 4);
    if (hit) {
      toggleInteractionDirection(panel, hit.direction);
      return;
    }
    const instance = findAuthoringInstanceAt(scene, point);
    rememberSelectedAsset(state, instance);
    state.interactionSelection = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
    panel.setInteractionEditorState(interactionSelectionState(panel));
    syncInteractionControls(panel);
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "interaction-point") {
    const selection = panel.authoringRuntime?.selectInteractionPointAt?.(point) ?? null;
    rememberSelectedAsset(state, selectedInstance(scene, selection));
    state.interactionPointSelection = selection ? { id: selection.id, profileKey: selection.profileKey } : null;
    state.interactionPointDrag = selection ? { startPoint: point, startOffset: { ...selection.offset } } : null;
    panel.setInteractionPointEditorState(interactionPointSelectionState(panel));
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "render") {
    const instance = findAuthoringInstanceAt(scene, point);
    rememberSelectedAsset(state, instance);
    state.renderSelection = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
    panel.setRenderEditorState(renderSelectionState(panel));
    syncRenderControls(panel);
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "timeline") {
    const instance = findAuthoringInstanceAt(scene, point);
    rememberSelectedAsset(state, instance);
    state.timelineSelection = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
    const selection = timelineSelectionState(panel);
    state.timelineDrag = selection?.timeline.enabled
      ? { startPoint: point, startOffset: { ...selection.timeline.positionOffset } }
      : null;
    panel.setTimelineEditorState(selection);
    syncTimelineControls(panel);
    renderEnhancedAuthoring(panel);
  }
}

function handleEnhancedPointerMove(panel, pointer) {
  const state = panel.assetAuthoringEnhancement;
  if (!state || !pointer?.isDown) return;
  if (state.mode === "interaction-point" && state.interactionPointDrag) {
    const point = pointerPoint(pointer);
    const selection = panel.authoringRuntime?.setInteractionOffset?.({
      x: state.interactionPointDrag.startOffset.x + point.x - state.interactionPointDrag.startPoint.x,
      y: state.interactionPointDrag.startOffset.y + point.y - state.interactionPointDrag.startPoint.y,
    });
    panel.setInteractionPointEditorState(interactionPointSelectionState(panel) ?? selection);
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "timeline" && state.timelineDrag) {
    const point = pointerPoint(pointer);
    applyTimelinePatch(panel, {
      positionOffset: {
        x: state.timelineDrag.startOffset.x + point.x - state.timelineDrag.startPoint.x,
        y: state.timelineDrag.startOffset.y + point.y - state.timelineDrag.startPoint.y,
      },
    });
    return;
  }
  if (state.mode !== "crop" || !state.cropDrag) return;
  const selection = cropSelectionState(panel);
  if (!selection) return;
  const point = pointerPoint(pointer);
  const resized = resizeColliderDraft(
    state.cropDrag.startVisible,
    state.cropDrag.edges,
    { x: point.x - state.cropDrag.startPoint.x, y: point.y - state.cropDrag.startPoint.y },
  );
  applyCropVisibleBounds(panel, constrainVisibleBounds(resized, selection.sourceWorldBounds));
}

function handleEnhancedKeyDown(panel, event) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.mode) return;
  if (state.mode === "interaction-point") {
    const delta = arrowDelta(event);
    if (!delta || !interactionPointSelectionState(panel)) return;
    consumeArrowEvent(event);
    event?.stopImmediatePropagation?.();
    panel.authoringRuntime?.nudgeInteractionOffset?.(delta.x, delta.y);
    panel.setInteractionPointEditorState(interactionPointSelectionState(panel));
    renderEnhancedAuthoring(panel);
    return;
  }
  if (state.mode === "timeline") {
    const delta = arrowDelta(event);
    const selection = timelineSelectionState(panel);
    if (!delta || !selection?.timeline.enabled) return;
    consumeArrowEvent(event);
    event?.stopImmediatePropagation?.();
    applyTimelinePatch(panel, {
      positionOffset: {
        x: selection.timeline.positionOffset.x + delta.x,
        y: selection.timeline.positionOffset.y + delta.y,
      },
    });
    return;
  }
  if (state.mode === "collider") {
    const selection = state.scene.colliderEditSelection;
    if (!selection) return;
    const next = editRectDraftByArrow(selection.draft, event);
    if (!next) return;
    consumeArrowEvent(event);
    selection.draft = next;
    state.scene.syncColliderEditorPanel?.();
    state.scene.renderColliderDebug?.();
    return;
  }
  if (state.mode === "crop") {
    const selection = cropSelectionState(panel);
    if (!selection) return;
    const next = editRectDraftByArrow(selection.visibleWorldBounds, event, {
      bounds: selection.sourceWorldBounds,
    });
    if (!next) return;
    consumeArrowEvent(event);
    applyCropVisibleBounds(panel, next);
  }
}

function consumeArrowEvent(event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
}

function pointerPoint(pointer) {
  return {
    x: Math.round(Number(pointer?.worldX ?? pointer?.x) || 0),
    y: Math.round(Number(pointer?.worldY ?? pointer?.y) || 0),
  };
}

function authoringInstances(scene) {
  return collectAssetAuthoringInstances(scene);
}

function arrowDelta(event) {
  return {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  }[event?.key] ?? null;
}

function findAuthoringInstanceAt(scene, point, { requireCrop = false } = {}) {
  return authoringInstances(scene)
    .flatMap((instance) => {
      const bounds = instanceWorldBounds(scene, instance, { requireCrop });
      return bounds && contains(bounds, point) ? [{ instance, bounds }] : [];
    })
    .sort((a, b) => area(a.bounds) - area(b.bounds))[0]?.instance ?? null;
}

function instanceWorldBounds(scene, instance, { requireCrop = false } = {}) {
  const cropTarget = cropTargetForInstance(instance);
  if (cropTarget) return cropTarget.sourceWorldBounds;
  if (requireCrop) return null;
  const offset = scene.assetProfiles?.[instance.profileKey]?.visualOffset ?? { x: 0, y: 0 };
  return {
    left: instance.bounds.left + offset.x,
    right: instance.bounds.right + offset.x,
    top: instance.bounds.top + offset.y,
    bottom: instance.bounds.bottom + offset.y,
  };
}

function cropTargetForInstance(instance) {
  for (const target of instance?.targets ?? []) {
    const local = getVisualCropSourceBounds(target);
    if (!local) continue;
    const x = Number(target.x) || 0;
    const y = Number(target.y) || 0;
    return {
      target,
      sourceLocalBounds: local,
      sourceWorldBounds: {
        left: x + local.left,
        right: x + local.right,
        top: y + local.top,
        bottom: y + local.bottom,
      },
    };
  }
  return null;
}

function cropSelectionState(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.cropSelection) return null;
  const instance = authoringInstances(state.scene).find(({ id, profileKey }) => (
    id === state.cropSelection.id && profileKey === state.cropSelection.profileKey
  ));
  const cropTarget = instance ? cropTargetForInstance(instance) : null;
  if (!cropTarget) return null;
  const profile = state.scene.assetProfiles?.[instance.profileKey];
  const visibleLocal = cropVisibleBounds(cropTarget.sourceLocalBounds, profile?.visualCropInsets);
  const x = Number(cropTarget.target.x) || 0;
  const y = Number(cropTarget.target.y) || 0;
  const visibleWorldBounds = {
    left: x + visibleLocal.left,
    right: x + visibleLocal.right,
    top: y + visibleLocal.top,
    bottom: y + visibleLocal.bottom,
  };
  return {
    id: instance.id,
    profileKey: instance.profileKey,
    sourceLocalBounds: cropTarget.sourceLocalBounds,
    sourceWorldBounds: cropTarget.sourceWorldBounds,
    visibleWorldBounds,
    width: Math.round(visibleWorldBounds.right - visibleWorldBounds.left),
    height: Math.round(visibleWorldBounds.bottom - visibleWorldBounds.top),
  };
}

function applyCropVisibleBounds(panel, visibleWorldBounds) {
  const selection = cropSelectionState(panel);
  if (!selection) return;
  const localVisible = {
    left: selection.sourceLocalBounds.left + visibleWorldBounds.left - selection.sourceWorldBounds.left,
    right: selection.sourceLocalBounds.right - (selection.sourceWorldBounds.right - visibleWorldBounds.right),
    top: selection.sourceLocalBounds.top + visibleWorldBounds.top - selection.sourceWorldBounds.top,
    bottom: selection.sourceLocalBounds.bottom - (selection.sourceWorldBounds.bottom - visibleWorldBounds.bottom),
  };
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, {
    visualCropInsets: cropInsetsFromVisibleBounds(selection.sourceLocalBounds, localVisible),
  });
  applyAllProfileCrops(panel.assetAuthoringEnhancement.scene, selection.profileKey);
  panel.setCropEditorState(cropSelectionState(panel));
  renderEnhancedAuthoring(panel);
}

function resetSelectedCrop(panel) {
  const selection = cropSelectionState(panel);
  if (!selection) {
    panel.setAuthoringStatus("Сначала выберите спрайт в режиме обрезки", true);
    return;
  }
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, {
    visualCropInsets: normalizeVisualCropInsets(DEFAULT_ASSET_PROFILES[selection.profileKey]?.visualCropInsets),
  });
  applyAllProfileCrops(panel.assetAuthoringEnhancement.scene, selection.profileKey);
  panel.setCropEditorState(cropSelectionState(panel));
  panel.setAuthoringStatus("Обрезка возвращена к каноническому значению профиля");
  renderEnhancedAuthoring(panel);
}

function applyAllProfileCrops(scene, onlyProfileKey = null) {
  for (const instance of authoringInstances(scene)) {
    if (onlyProfileKey && instance.profileKey !== onlyProfileKey) continue;
    const insets = scene.assetProfiles?.[instance.profileKey]?.visualCropInsets ?? {};
    for (const target of instance.targets ?? []) applyVisualCrop(target, insets);
  }
}

function selectedInstance(scene, selection) {
  if (!selection) return null;
  return authoringInstances(scene).find(({ id, profileKey }) => (
    id === selection.id && profileKey === selection.profileKey
  )) ?? null;
}

function interactionPointSelectionState(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.interactionPointSelection) return null;
  return panel.authoringRuntime?.getInteractionPointSelection?.() ?? null;
}

function renderSelectionState(panel) {
  const state = panel.assetAuthoringEnhancement;
  const instance = selectedInstance(state?.scene, state?.renderSelection);
  if (!instance) return null;
  return {
    id: instance.id,
    profileKey: instance.profileKey,
    renderMode: normalizeAssetRenderMode(state.scene.assetProfiles?.[instance.profileKey]?.renderMode),
  };
}

function applySelectedRenderMode(panel, value) {
  const selection = renderSelectionState(panel);
  if (!selection) return;
  const renderMode = normalizeAssetRenderMode(value, selection.renderMode);
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, { renderMode });
  panel.setRenderEditorState(renderSelectionState(panel));
  syncRenderControls(panel);
  panel.setAuthoringStatus(`Режим рендера: ${RENDER_MODE_LABELS[renderMode]}`);
  renderEnhancedAuthoring(panel);
}

function syncRenderControls(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.renderSelect) return;
  const selection = renderSelectionState(panel);
  state.renderSelect.disabled = !selection;
  state.renderSelect.value = selection?.renderMode ?? ASSET_RENDER_MODES.pivotDepth;
}

function timelineSelectionState(panel) {
  const state = panel.assetAuthoringEnhancement;
  const instance = selectedInstance(state?.scene, state?.timelineSelection);
  if (!instance) return null;
  const timeline = normalizeInteractionTimeline(state.scene.assetProfiles?.[instance.profileKey]?.interactionTimeline);
  const collider = interactionColliderForInstance(state.scene, instance);
  const center = {
    x: (collider.left + collider.right) / 2,
    y: (collider.top + collider.bottom) / 2,
  };
  return {
    id: instance.id,
    profileKey: instance.profileKey,
    timeline,
    collider,
    marker: {
      x: center.x + timeline.positionOffset.x,
      y: center.y + timeline.positionOffset.y,
    },
  };
}

function applyTimelinePatch(panel, patch) {
  const selection = timelineSelectionState(panel);
  if (!selection) return;
  const interactionTimeline = normalizeInteractionTimeline({ ...selection.timeline, ...patch }, selection.timeline);
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, { interactionTimeline });
  const next = timelineSelectionState(panel);
  panel.setTimelineEditorState(next);
  syncTimelineControls(panel);
  renderEnhancedAuthoring(panel);
}

function applySelectedTimelineControls(panel) {
  const state = panel.assetAuthoringEnhancement;
  const selection = timelineSelectionState(panel);
  if (!selection) return;
  applyTimelinePatch(panel, {
    enabled: Boolean(state.timelineEnabled?.checked),
    walkDuringRelocation: Boolean(state.timelineWalk?.checked),
    enterMs: Number(state.timelineEnter?.value),
    exitMs: Number(state.timelineExit?.value),
    facing: state.timelineFacing?.value,
    screenOrientation: state.timelineScreenOrientation?.value,
  });
}

function syncTimelineControls(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.timelineEnabled) return;
  const selection = timelineSelectionState(panel);
  state.timelineEnabled.disabled = !selection;
  state.timelineEnabled.checked = Boolean(selection?.timeline.enabled);
  state.timelineWalk.disabled = !selection || !selection.timeline.enabled;
  state.timelineWalk.checked = Boolean(selection?.timeline.walkDuringRelocation);
  state.timelineEnter.disabled = !selection || !selection.timeline.enabled;
  state.timelineExit.disabled = !selection || !selection.timeline.enabled;
  state.timelineFacing.disabled = !selection || !selection.timeline.enabled;
  state.timelineScreenOrientation.disabled = !selection || !selection.timeline.enabled;
  state.timelineEnter.value = String(selection?.timeline.enterMs ?? 0);
  state.timelineExit.value = String(selection?.timeline.exitMs ?? 0);
  state.timelineFacing.value = selection?.timeline.facing ?? INTERACTION_TIMELINE_FACING_MODES.keepCurrent;
  state.timelineScreenOrientation.value = selection?.timeline.screenOrientation
    ?? INTERACTION_TIMELINE_SCREEN_ORIENTATIONS.original;
}

function interactionSelectionState(panel) {
  const state = panel.assetAuthoringEnhancement;
  if (!state?.interactionSelection) return null;
  const instance = authoringInstances(state.scene).find(({ id, profileKey }) => (
    id === state.interactionSelection.id && profileKey === state.interactionSelection.profileKey
  ));
  if (!instance) return null;
  const profile = state.scene.assetProfiles?.[instance.profileKey];
  const collider = interactionColliderForInstance(state.scene, instance);
  return {
    id: instance.id,
    profileKey: instance.profileKey,
    directions: [...(profile?.interactionDirections ?? INTERACTION_APPROACH_DIRECTIONS)],
    interactionPadding: normalizeInteractionPadding(profile?.interactionPadding),
    collider,
    entries: perimeterInteractionPointEntries(collider),
  };
}

function interactionColliderForInstance(scene, instance) {
  return scene.worldLayout?.getResourceCollider?.(instance.id)
    ?? scene.worldLayout?.getWorldObjectColliders?.().find(({ id }) => id === instance.id)?.rect
    ?? instance.bounds;
}

function toggleInteractionDirection(panel, direction) {
  const selection = interactionSelectionState(panel);
  if (!selection || !INTERACTION_APPROACH_DIRECTIONS.includes(direction)) {
    panel.setAuthoringStatus("Сначала выберите объект в режиме точек подхода", true);
    return;
  }
  const enabled = new Set(selection.directions);
  if (enabled.has(direction)) {
    if (enabled.size === 1) {
      panel.setAuthoringStatus("У объекта должна остаться хотя бы одна точка подхода", true);
      return;
    }
    enabled.delete(direction);
  } else {
    enabled.add(direction);
  }
  const directions = INTERACTION_APPROACH_DIRECTIONS.filter((candidate) => enabled.has(candidate));
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, { interactionDirections: directions });
  panel.assetAuthoringEnhancement.scene.interactionRuntime?.refresh?.();
  const next = interactionSelectionState(panel);
  panel.setInteractionEditorState(next);
  panel.setAuthoringStatus(`Направление ${direction}: ${directions.includes(direction) ? "разрешено" : "отключено"}`);
  renderEnhancedAuthoring(panel);
}

function syncDirectionButtons(panel, directions) {
  const enabled = new Set(directions);
  for (const button of panel.assetAuthoringEnhancement?.directionGrid?.querySelectorAll?.("button[data-direction]") ?? []) {
    const active = enabled.has(button.dataset.direction);
    button.dataset.enabled = String(active);
    button.setAttribute?.("aria-pressed", String(active));
  }
}

function applyProfilePatch(scene, profileKey, patch) {
  const current = scene.assetProfiles?.[profileKey];
  if (!current) return null;
  const next = Object.freeze({
    ...current,
    ...patch,
    visualCropInsets: normalizeVisualCropInsets(patch.visualCropInsets ?? current.visualCropInsets),
    interactionDirections: Object.freeze([...(patch.interactionDirections ?? current.interactionDirections ?? INTERACTION_APPROACH_DIRECTIONS)]),
    interactionPadding: normalizeInteractionPadding(patch.interactionPadding ?? current.interactionPadding),
    renderMode: normalizeAssetRenderMode(patch.renderMode ?? current.renderMode),
    interactionTimeline: normalizeInteractionTimeline(
      patch.interactionTimeline ?? current.interactionTimeline,
      current.interactionTimeline,
    ),
  });
  scene.assetProfiles = Object.freeze({ ...scene.assetProfiles, [profileKey]: next });
  return next;
}

function patchInteractionOwners(scene) {
  const owners = scene.worldLocationRuntime?.getOwners?.() ?? {};
  for (const owner of [owners.debrisRuntime, owners.facilityRuntime]) {
    if (!owner?.getInteractionDefinitions || owner[INTERACTION_OWNER_PATCH]) continue;
    const original = owner.getInteractionDefinitions.bind(owner);
    owner.getInteractionDefinitions = () => original().map((definition) => {
      const profileKey = profileKeyForInteraction(definition);
      const directions = scene.assetProfiles?.[profileKey]?.interactionDirections;
      return directions ? { ...definition, interactionDirections: directions } : definition;
    });
    owner[INTERACTION_OWNER_PATCH] = true;
  }
}

function profileKeyForInteraction(definition) {
  if (definition?.facilityType) return `facility:${definition.facilityType}`;
  if (definition?.profileId) return `resource:${definition.profileId}`;
  if (definition?.payload?.bedId || String(definition?.id ?? "").includes("bed")) return "furniture:bed";
  return null;
}

function renderEnhancedAuthoring(panel) {
  const state = panel.assetAuthoringEnhancement;
  const graphics = state?.graphics;
  if (!graphics) return;
  graphics.clear?.();
  if (state.scene.colliderDebugVisible) renderAssetDebugMarkers(state.scene, graphics);
  if (state.mode === "crop") {
    const selection = cropSelectionState(panel);
    if (!selection) return;
    graphics.lineStyle?.(1, 0xffffff, 0.45);
    graphics.strokeRect?.(
      selection.sourceWorldBounds.left,
      selection.sourceWorldBounds.top,
      selection.sourceWorldBounds.right - selection.sourceWorldBounds.left,
      selection.sourceWorldBounds.bottom - selection.sourceWorldBounds.top,
    );
    graphics.lineStyle?.(1, 0xff65d8, 0.95);
    graphics.strokeRect?.(
      selection.visibleWorldBounds.left,
      selection.visibleWorldBounds.top,
      selection.visibleWorldBounds.right - selection.visibleWorldBounds.left,
      selection.visibleWorldBounds.bottom - selection.visibleWorldBounds.top,
    );
    return;
  }
  if (state.mode === "interaction") {
    const selection = interactionSelectionState(panel);
    if (!selection) return;
    const enabled = new Set(selection.directions);
    const interactionBounds = paddedCollider(selection.collider, selection.interactionPadding);
    graphics.lineStyle?.(1, 0x58d7ff, 0.65);
    drawInteractionRange(graphics, interactionBounds, selection.interactionPadding);
    graphics.lineStyle?.(1, 0xffffff, 0.35);
    graphics.strokeRect?.(
      selection.collider.left,
      selection.collider.top,
      selection.collider.right - selection.collider.left,
      selection.collider.bottom - selection.collider.top,
    );
    for (const entry of selection.entries) {
      graphics.fillStyle?.(enabled.has(entry.direction) ? 0x63f59a : 0xff5f6d, 0.95);
      graphics.fillRect?.(Math.round(entry.point.x) - 1, Math.round(entry.point.y) - 1, 3, 3);
    }
    return;
  }
  if (state.mode === "interaction-point") {
    const selection = interactionPointSelectionState(panel);
    if (!selection?.marker) return;
    drawCross(graphics, selection.marker, 0xff4dff);
    return;
  }
  if (state.mode === "timeline") {
    const selection = timelineSelectionState(panel);
    if (!selection) return;
    graphics.lineStyle?.(1, 0xffffff, 0.35);
    graphics.strokeRect?.(
      selection.collider.left,
      selection.collider.top,
      selection.collider.right - selection.collider.left,
      selection.collider.bottom - selection.collider.top,
    );
    if (selection.timeline.enabled) drawCross(graphics, selection.marker, 0x58d7ff);
    return;
  }
  if (state.mode === "render") {
    const selection = renderSelectionState(panel);
    const instance = selectedInstance(state.scene, selection);
    const bounds = instance ? instanceWorldBounds(state.scene, instance) : null;
    if (!bounds) return;
    graphics.lineStyle?.(1, 0xffd166, 0.95);
    graphics.strokeRect?.(bounds.left, bounds.top, bounds.right - bounds.left, bounds.bottom - bounds.top);
  }
}

function applySelectedInteractionPadding(panel) {
  const selection = interactionSelectionState(panel);
  if (!selection) return;
  const interactionPadding = normalizeInteractionPadding(
    panel.assetAuthoringEnhancement?.interactionPadding?.value,
    selection.interactionPadding,
  );
  applyProfilePatch(panel.assetAuthoringEnhancement.scene, selection.profileKey, { interactionPadding });
  panel.assetAuthoringEnhancement.scene.interactionRuntime?.refresh?.();
  panel.setInteractionEditorState(interactionSelectionState(panel));
  syncInteractionControls(panel);
  renderEnhancedAuthoring(panel);
}

function syncInteractionControls(panel) {
  const input = panel.assetAuthoringEnhancement?.interactionPadding;
  if (!input) return;
  const selection = interactionSelectionState(panel);
  input.disabled = !selection;
  input.value = String(selection?.interactionPadding ?? 16);
}

function renderAssetDebugMarkers(scene, graphics) {
  for (const instance of authoringInstances(scene)) {
    const profile = scene.assetProfiles?.[instance.profileKey] ?? {};
    const collider = interactionColliderForInstance(scene, instance);
    const pivot = {
      x: instance.anchor.x + Number(profile.snapAnchorOffset?.x || 0),
      y: instance.anchor.y + Number(profile.snapAnchorOffset?.y || 0),
    };
    const interactionPoint = {
      x: (collider.left + collider.right) / 2 + Number(profile.interactionOffset?.x || 0),
      y: (collider.top + collider.bottom) / 2 + Number(profile.interactionOffset?.y || 0),
    };
    const interactionBounds = paddedCollider(collider, normalizeInteractionPadding(profile.interactionPadding));
    graphics.lineStyle?.(1, 0x58d7ff, 0.3);
    drawInteractionRange(graphics, interactionBounds, normalizeInteractionPadding(profile.interactionPadding));
    drawCross(graphics, pivot, 0xffff3b, 0.3, 1);
    drawCross(graphics, interactionPoint, 0xff4dff, 0.3, 2);
    const enabledDirections = new Set(profile.interactionDirections ?? INTERACTION_APPROACH_DIRECTIONS);
    for (const { direction, point } of perimeterInteractionPointEntries(collider)) {
      if (!enabledDirections.has(direction)) continue;
      graphics.fillStyle?.(0x63f59a, 0.3);
      graphics.fillRect?.(Math.round(point.x) - 1, Math.round(point.y) - 1, 3, 3);
    }
  }
}

function paddedCollider(collider, padding) {
  const value = normalizeInteractionPadding(padding);
  return {
    left: collider.left - value,
    right: collider.right + value,
    top: collider.top - value,
    bottom: collider.bottom + value,
  };
}

function drawInteractionRange(graphics, bounds, padding) {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (graphics.strokeRoundedRect) {
    graphics.strokeRoundedRect(bounds.left, bounds.top, width, height, normalizeInteractionPadding(padding));
    return;
  }
  graphics.strokeRect?.(bounds.left, bounds.top, width, height);
}

function drawCross(graphics, marker, color, alpha = 1, radius = 2) {
  const x = Math.round(marker.x);
  const y = Math.round(marker.y);
  graphics.fillStyle?.(color, alpha);
  graphics.fillRect?.(x - radius, y, radius * 2 + 1, 1);
  graphics.fillRect?.(x, y - radius, 1, radius * 2 + 1);
}

function constrainVisibleBounds(rect, bounds) {
  return {
    left: Math.max(bounds.left, Math.min(rect.left, bounds.right - 1)),
    right: Math.min(bounds.right, Math.max(rect.right, bounds.left + 1)),
    top: Math.max(bounds.top, Math.min(rect.top, bounds.bottom - 1)),
    bottom: Math.min(bounds.bottom, Math.max(rect.bottom, bounds.top + 1)),
  };
}

function contains(bounds, point) {
  return point.x >= bounds.left && point.x < bounds.right
    && point.y >= bounds.top && point.y < bounds.bottom;
}

function area(bounds) {
  return (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
}

export const ASSET_AUTHORING_PROFILE_VERSION = ASSET_PROFILES_VERSION;
