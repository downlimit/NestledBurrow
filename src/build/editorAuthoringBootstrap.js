import { MovementDebugPanel } from "../devtools/movementDebugPanel.js";
import { INTERACTION_APPROACH_DIRECTIONS } from "../interaction/interactionDirections.js";
import { perimeterInteractionPointEntries } from "../interaction/interactionApproach.js";
import {
  ASSET_PROFILES_VERSION,
  DEFAULT_ASSET_PROFILES,
  normalizeVisualCropInsets,
  saveAssetProfilesToProject,
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
    scene?.buildMode
      && scene?.worldBuildCoordinator?.getPlacedObjects
      && scene?.facilityRuntime
      && scene?.debrisRuntime
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

MovementDebugPanel.prototype.applyColliderDraftToProject = async function saveCanonicalAssetProfiles() {
  if (!this.authoringRuntime) await this.attachSceneRuntime();
  const state = this.assetAuthoringEnhancement;
  const hasSelection = Boolean(
    this.scene?.colliderEditSelection
      || this.authoringRuntime?.getPivotSelection?.()
      || this.authoringRuntime?.getVisualOffsetSelection?.()
      || state?.cropSelection
      || state?.interactionSelection,
  );
  if (!hasSelection) {
    this.setAuthoringStatus("Сначала выберите ассет", true);
    return;
  }

  if (this.colliderConfirmButton) this.colliderConfirmButton.disabled = true;
  this.setAuthoringStatus("Запись канонического профиля ассета…");
  try {
    this.scene?.confirmColliderDraft?.();
    await saveAssetProfilesToProject(this.scene?.assetProfiles ?? {}, {
      storage: this.storage,
      baseUrl: import.meta.env?.BASE_URL ?? "/",
    });
    this.setAuthoringStatus("Профили ассетов записаны в исходники проекта; браузерные оффсеты очищены");
  } catch (error) {
    console.warn("Asset profile project save failed", error);
    if (error?.localSaved) {
      this.setAuthoringStatus("Профиль сохранён в браузере. Статический веб-билд не может записать репозиторий.");
    } else {
      this.setAuthoringStatus("Ошибка сохранения профиля ассета", true);
    }
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
  if (this.colliderConfirmButton) this.colliderConfirmButton.textContent = {
    collider: "Сохранить коллайдер в проект",
    pivot: "Сохранить пивот в проект",
    "visual-offset": "Сохранить оффсет в проект",
    crop: "Сохранить обрезку в проект",
    interaction: "Сохранить точки подхода",
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
    ? `${state.profileKey}\nразрешено направлений: ${state.directions.length}/8\nкликните по маркеру или кнопке направления`
    : "Кликните по объекту для настройки точек подхода";
  syncDirectionButtons(this, state?.directions ?? []);
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
  renameCheckboxLabel(panel.colliderCheckbox, "Коллайдеры");
  renameCheckboxLabel(panel.buildGridCheckbox, "Строительная сетка");
  appendExistingLabel(visibility, panel.colliderCheckbox);
  appendExistingLabel(visibility, panel.buildGridCheckbox);
  section.append(visibilityTitle, visibility);

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
  scene.setColliderEditMode?.(mode === "collider");
  scene.setPivotEditMode?.(mode === "pivot");
  scene.setVisualOffsetEditMode?.(mode === "visual-offset");
  if (mode !== "crop") {
    state.cropSelection = null;
    state.cropDrag = null;
  }
  if (mode !== "interaction") state.interactionSelection = null;
  panel.setEditorMode(mode);
  if (mode === "crop") panel.setCropEditorState(cropSelectionState(panel));
  else if (mode === "interaction") panel.setInteractionEditorState(interactionSelectionState(panel));
  renderEnhancedAuthoring(panel);
}

function installAuthoringInput(panel, state) {
  const scene = state.scene;
  const input = scene.input;
  if (!input) return;
  const listeners = {
    down: (pointer) => handleEnhancedPointerDown(panel, pointer),
    move: (pointer) => handleEnhancedPointerMove(panel, pointer),
    up: () => { state.cropDrag = null; },
    key: (event) => handleEnhancedKeyDown(panel, event),
    update: () => {
      state.frame += 1;
      if (state.frame % 30 === 0) {
        patchInteractionOwners(scene);
        applyAllProfileCrops(scene);
      }
      if (state.mode && state.frame % 8 === 0) renderEnhancedAuthoring(panel);
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
  state.cropResetButton?.remove?.();
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
    state.interactionSelection = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
    panel.setInteractionEditorState(interactionSelectionState(panel));
    renderEnhancedAuthoring(panel);
  }
}

function handleEnhancedPointerMove(panel, pointer) {
  const state = panel.assetAuthoringEnhancement;
  if (state?.mode !== "crop" || !state.cropDrag || !pointer?.isDown) return;
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
  const owners = scene.worldLocationRuntime?.getOwners?.() ?? {};
  return [
    ...(owners.debrisRuntime?.getAuthoringInstances?.() ?? []),
    ...(owners.facilityRuntime?.getAuthoringInstances?.() ?? []),
  ].filter((instance) => scene.assetProfiles?.[instance.profileKey]);
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
  }
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
