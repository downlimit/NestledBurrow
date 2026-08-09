import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { WELL_PROFILE } from "../resources/farmingConfig.js";
import { TAVERN_SIGN } from "../tavern/guestConfig.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";
import { installAuthoringCanonExport } from "./authoringCanonExport.js";
import { canonicalVisualOffsetAtCurrentPivot } from "./assetProfileRelations.js";
import { DEFAULT_ASSET_PROFILES, saveAssetProfiles } from "./assetProfiles.js";

const UNIVERSAL_AUTHORING_PATCH = Symbol("nestledBurrowUniversalPlaceableAuthoring");

function point(value = {}) {
  return {
    x: Math.round(Number(value.x) || 0),
    y: Math.round(Number(value.y) || 0),
  };
}

function contains(bounds, value) {
  return Boolean(bounds)
    && Number(value?.x) >= bounds.left
    && Number(value?.x) < bounds.right
    && Number(value?.y) >= bounds.top
    && Number(value?.y) < bounds.bottom;
}

function shiftedBounds(bounds, offset) {
  return {
    left: bounds.left + offset.x,
    right: bounds.right + offset.x,
    top: bounds.top + offset.y,
    bottom: bounds.bottom + offset.y,
  };
}

function profileOffset(scene, profileKey, field) {
  return point(scene.assetProfiles?.[profileKey]?.[field]);
}

function replaceProfilePoint(scene, profileKey, field, value) {
  const current = scene.assetProfiles?.[profileKey];
  if (!current) return null;
  const next = Object.freeze(point(value));
  scene.assetProfiles = Object.freeze({
    ...scene.assetProfiles,
    [profileKey]: Object.freeze({ ...current, [field]: next }),
  });
  return next;
}

function runtimeInstances(owners) {
  return [
    ...(owners.debrisRuntime?.getAuthoringInstances?.() ?? []),
    ...(owners.facilityRuntime?.getAuthoringInstances?.() ?? []),
  ].map((instance) => ({
    ...instance,
    visualBasePosition: instance.visualBasePosition ?? instance.anchor,
  }));
}

function transitionInstances(scene) {
  return (scene.worldPresentationRuntime?.getTransitionAuthoringInstances?.() ?? []).map((instance) => ({
    ...instance,
    visualBasePosition: instance.visualBasePosition ?? instance.anchor,
    special: true,
  }));
}

function wildAtollInstances(owners) {
  return (owners.wildAtollRuntime?.getAuthoringInstances?.() ?? []).map((instance) => ({
    ...instance,
    visualBasePosition: instance.visualBasePosition ?? instance.anchor,
    special: true,
  }));
}

function wellInstances(owners) {
  const runtime = owners.worldBuildCoordinator?.wellOwner;
  if (!runtime?.getWellState || !runtime?.getMoveTargetAt) return [];
  return runtime.getWellState().flatMap((well) => {
    const target = runtime.getMoveTargetAt({ x: well.x + 0.5, y: well.y + 0.5 });
    return target?.targets?.length ? [{
      id: well.id,
      profileKey: "farming:well",
      anchor: { x: well.x, y: well.y },
      bounds: target.authoringBounds ?? target.bounds ?? {
        left: well.x,
        right: well.x + WELL_PROFILE.width,
        top: well.y,
        bottom: well.y + WELL_PROFILE.height,
      },
      visualBasePosition: { x: well.x, y: well.y },
      targets: target.targets,
      special: true,
    }] : [];
  });
}

function tavernSignInstances(owners) {
  const runtime = owners.tavernSignRuntime;
  const state = runtime?.getState?.();
  if (!state?.present || !runtime?.getBuildMoveTargetAt) return [];
  const target = runtime.getBuildMoveTargetAt(state.position);
  if (!target?.targets?.length) return [];
  return [{
    id: TAVERN_SIGN.id,
    profileKey: "facility:tavern-sign",
    anchor: { ...state.position },
    bounds: target.authoringBounds ?? target.bounds,
    visualBasePosition: { ...state.position },
    targets: target.targets,
    special: true,
  }];
}

function trainingDummyInstances(owners) {
  const runtime = owners.meleeRuntime;
  const state = runtime?.getState?.()?.dummy;
  if (!state?.position || !runtime?.getBuildMoveTargetAt) return [];
  const target = runtime.getBuildMoveTargetAt({
    x: state.position.x + TRAINING_DUMMY.asset.width / 2,
    y: state.position.y + TRAINING_DUMMY.asset.height / 2,
  });
  if (!target?.targets?.length) return [];
  return [{
    id: TRAINING_DUMMY.id,
    profileKey: "melee:training-dummy",
    anchor: { ...state.position },
    bounds: target.authoringBounds ?? target.bounds ?? {
      left: state.position.x,
      right: state.position.x + TRAINING_DUMMY.asset.width,
      top: state.position.y,
      bottom: state.position.y + TRAINING_DUMMY.asset.height,
    },
    visualBasePosition: { ...state.position },
    targets: target.targets,
    special: true,
  }];
}

export function installUniversalPlaceableAuthoring(panel, scene) {
  const runtime = panel?.authoringRuntime;
  if (!runtime || !scene || runtime[UNIVERSAL_AUTHORING_PATCH]) return runtime ?? null;

  let pivotSelection = null;
  let visualSelection = null;
  let interactionSelection = null;
  let interactionDrag = null;
  let interactionEditEnabled = false;
  let collisionSelection = null;
  let collisionCheckbox = null;
  const getOwners = () => scene.worldLocationRuntime?.getOwners?.() ?? {};

  function getInstances() {
    const owners = getOwners();
    const instances = [
      ...runtimeInstances(owners),
      ...transitionInstances(scene),
      ...wildAtollInstances(owners),
      ...wellInstances(owners),
      ...tavernSignInstances(owners),
      ...trainingDummyInstances(owners),
    ].filter((instance) => scene.assetProfiles?.[instance.profileKey]);
    return [...new Map(instances.map((instance) => [`${instance.profileKey}:${instance.id}`, instance])).values()];
  }

  function findAt(value) {
    return getInstances()
      .map((instance) => {
        const offset = profileOffset(scene, instance.profileKey, "visualOffset");
        return { instance, bounds: shiftedBounds(instance.bounds, offset) };
      })
      .filter(({ bounds }) => contains(bounds, value))
      .sort((left, right) => {
        const a = left.bounds;
        const b = right.bounds;
        return ((a.right - a.left) * (a.bottom - a.top))
          - ((b.right - b.left) * (b.bottom - b.top));
      })[0]?.instance ?? null;
  }

  function colliderFor(instance) {
    return scene.worldLayout?.getWorldObjectColliders?.()
      .find(({ id }) => id === instance.id)?.rect ?? instance.bounds;
  }

  function colliderCenter(instance) {
    const collider = colliderFor(instance);
    return {
      x: (collider.left + collider.right) / 2,
      y: (collider.top + collider.bottom) / 2,
    };
  }

  function depthFor(instance, pivotOffset, index = 0) {
    const depth = instance.depthMode === "fixed"
      ? Number(instance.fixedDepth ?? 0)
      : assetDepthFromPivot(instance.anchor, pivotOffset, 500, instance.id);
    return depth + index * 0.01;
  }

  function syncSpecialInstance(instance) {
    const visualOffset = profileOffset(scene, instance.profileKey, "visualOffset");
    const pivotOffset = profileOffset(scene, instance.profileKey, "snapAnchorOffset");
    instance.targets.forEach((target, index) => {
      target.setPosition?.(
        instance.visualBasePosition.x + visualOffset.x,
        instance.visualBasePosition.y + visualOffset.y,
      );
      target.setDepth?.(depthFor(instance, pivotOffset, index));
    });
  }

  function syncSpecialInstances(profileKey = null) {
    for (const instance of getInstances()) {
      if (!instance.special || (profileKey && instance.profileKey !== profileKey)) continue;
      syncSpecialInstance(instance);
    }
    scene.worldPresentationRuntime?.applyTransitionAuthoringProfile?.(profileKey);
  }

  function applyVisualOffset(profileKey, value) {
    const offset = replaceProfilePoint(scene, profileKey, "visualOffset", value);
    if (!offset) return null;
    const owners = getOwners();
    owners.debrisRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    owners.facilityRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    syncSpecialInstances(profileKey);
    return offset;
  }

  function applyPivotOffset(profileKey, value) {
    const offset = replaceProfilePoint(scene, profileKey, "snapAnchorOffset", value);
    if (!offset) return null;
    const owners = getOwners();
    owners.facilityRuntime?.syncKitchenVisuals?.();
    for (const instance of getInstances()) {
      if (instance.profileKey !== profileKey) continue;
      instance.targets.forEach((target, index) => target.setDepth?.(depthFor(instance, offset, index)));
    }
    scene.worldPresentationRuntime?.applyTransitionAuthoringProfile?.(profileKey);
    return offset;
  }

  function applyInteractionOffset(profileKey, value) {
    const offset = replaceProfilePoint(scene, profileKey, "interactionOffset", value);
    if (!offset) return null;
    scene.interactionRuntime?.refresh?.();
    return offset;
  }

  function pivotState() {
    if (!pivotSelection) return null;
    const offset = profileOffset(scene, pivotSelection.profileKey, "snapAnchorOffset");
    return {
      ...pivotSelection,
      offset,
      marker: {
        x: pivotSelection.anchor.x + offset.x,
        y: pivotSelection.anchor.y + offset.y,
      },
    };
  }

  function visualState() {
    if (!visualSelection) return null;
    const offset = profileOffset(scene, visualSelection.profileKey, "visualOffset");
    return {
      ...visualSelection,
      offset,
      displayBounds: shiftedBounds(visualSelection.bounds, offset),
    };
  }

  function interactionState() {
    if (!interactionSelection) return null;
    const offset = profileOffset(scene, interactionSelection.profileKey, "interactionOffset");
    const center = colliderCenter(interactionSelection);
    return {
      ...interactionSelection,
      offset,
      marker: {
        x: center.x + offset.x,
        y: center.y + offset.y,
      },
    };
  }

  runtime.selectPivotAt = (value) => {
    const instance = findAt(value);
    pivotSelection = instance ? {
      id: instance.id,
      profileKey: instance.profileKey,
      anchor: { ...instance.anchor },
    } : null;
    return pivotState();
  };
  runtime.setPivotOffset = (value) => {
    if (!pivotSelection) return null;
    applyPivotOffset(pivotSelection.profileKey, value);
    return pivotState();
  };
  runtime.nudgePivot = (dx, dy) => {
    if (!pivotSelection) return null;
    const current = profileOffset(scene, pivotSelection.profileKey, "snapAnchorOffset");
    return runtime.setPivotOffset({ x: current.x + dx, y: current.y + dy });
  };
  runtime.alignPivotToCollider = (axis) => {
    if (!pivotSelection || !["x", "y"].includes(axis)) return null;
    const collider = colliderFor(pivotSelection);
    if (!collider) return null;
    const current = profileOffset(scene, pivotSelection.profileKey, "snapAnchorOffset");
    const edgeA = axis === "x" ? "left" : "top";
    const edgeB = axis === "x" ? "right" : "bottom";
    return runtime.setPivotOffset({
      ...current,
      [axis]: (collider[edgeA] + collider[edgeB]) / 2 - pivotSelection.anchor[axis],
    });
  };
  runtime.getPivotSelection = pivotState;
  runtime.clearPivotSelection = () => { pivotSelection = null; };

  runtime.selectVisualOffsetAt = (value) => {
    const instance = findAt(value);
    visualSelection = instance ? {
      id: instance.id,
      profileKey: instance.profileKey,
      anchor: { ...instance.anchor },
      bounds: { ...instance.bounds },
    } : null;
    return visualState();
  };
  runtime.setVisualOffset = (value) => {
    if (!visualSelection) return null;
    applyVisualOffset(visualSelection.profileKey, value);
    return visualState();
  };
  runtime.nudgeVisualOffset = (dx, dy) => {
    if (!visualSelection) return null;
    const current = profileOffset(scene, visualSelection.profileKey, "visualOffset");
    return runtime.setVisualOffset({ x: current.x + dx, y: current.y + dy });
  };
  runtime.getVisualOffsetSelection = visualState;
  runtime.resetVisualOffset = () => {
    if (!visualSelection) return null;
    const profileKey = visualSelection.profileKey;
    return runtime.setVisualOffset(canonicalVisualOffsetAtCurrentPivot(
      scene.assetProfiles?.[profileKey],
      DEFAULT_ASSET_PROFILES[profileKey],
    ));
  };
  runtime.clearVisualOffsetSelection = () => { visualSelection = null; };

  runtime.selectInteractionPointAt = (value) => {
    const instance = findAt(value);
    interactionSelection = instance ? {
      id: instance.id,
      profileKey: instance.profileKey,
      anchor: { ...instance.anchor },
      bounds: { ...instance.bounds },
    } : null;
    return interactionState();
  };
  runtime.setInteractionOffset = (value) => {
    if (!interactionSelection) return null;
    applyInteractionOffset(interactionSelection.profileKey, value);
    return interactionState();
  };
  runtime.nudgeInteractionOffset = (dx, dy) => {
    if (!interactionSelection) return null;
    const current = profileOffset(scene, interactionSelection.profileKey, "interactionOffset");
    return runtime.setInteractionOffset({ x: current.x + dx, y: current.y + dy });
  };
  runtime.getInteractionPointSelection = interactionState;
  runtime.clearInteractionPointSelection = () => { interactionSelection = null; };

  const originalApplyProfile = runtime.applyColliderDraftToProject?.bind(runtime);
  runtime.applyColliderDraftToProject = async () => {
    const hasProfileSelection = Boolean(pivotSelection || visualSelection || interactionSelection);
    const result = await originalApplyProfile?.() ?? { status: "empty" };
    if (!hasProfileSelection || result.status !== "empty") return result;
    saveAssetProfiles(scene.assetProfiles, panel.storage ?? globalThis.localStorage);
    return { ...result, status: "saved-locally" };
  };

  function colliderSelectionPoint(instance) {
    const target = colliderFor(instance);
    if (!target) return null;
    const insetX = Math.min(1, Math.max(0, (target.right - target.left) / 4));
    const insetY = Math.min(1, Math.max(0, (target.bottom - target.top) / 4));
    const candidates = [
      colliderCenter(instance),
      { x: target.left + insetX, y: (target.top + target.bottom) / 2 },
      { x: target.right - insetX, y: (target.top + target.bottom) / 2 },
      { x: (target.left + target.right) / 2, y: target.top + insetY },
      { x: (target.left + target.right) / 2, y: target.bottom - insetY },
    ];
    const others = (scene.worldLayout?.getWorldObjectColliders?.() ?? [])
      .filter(({ id }) => id !== instance.id)
      .map(({ rect }) => rect);
    return candidates.find((candidate) => !others.some((rect) => contains(rect, candidate))) ?? candidates[0];
  }

  const originalBeginColliderEditPointer = scene.beginColliderEditPointer?.bind(scene);
  let patchedBeginColliderEditPointer = null;
  if (originalBeginColliderEditPointer) {
    patchedBeginColliderEditPointer = (pointer) => {
      const worldPoint = point({ x: pointer.worldX ?? pointer.x, y: pointer.worldY ?? pointer.y });
      const instance = findAt(worldPoint);
      collisionSelection = instance?.fixedWorld ? instance : null;
      syncCollisionToggle();
      if (!instance) return originalBeginColliderEditPointer(pointer);
      const selectionPoint = colliderSelectionPoint(instance);
      return selectionPoint
        ? originalBeginColliderEditPointer({ ...pointer, worldX: selectionPoint.x, worldY: selectionPoint.y })
        : originalBeginColliderEditPointer(pointer);
    };
    scene.beginColliderEditPointer = patchedBeginColliderEditPointer;
  }

  const interactionGraphics = scene.add.graphics().setDepth(8975).setVisible(false);
  const documentRef = panel.documentRef ?? globalThis.document;
  const collisionLabel = documentRef.createElement("label");
  const collisionName = documentRef.createElement("span");
  collisionName.textContent = "Коллизия включена";
  collisionCheckbox = documentRef.createElement("input");
  collisionCheckbox.type = "checkbox";
  collisionLabel.append(collisionName, collisionCheckbox);
  panel.colliderEditor?.insertBefore?.(collisionLabel, panel.colliderConfirmButton ?? null);
  if (!collisionLabel.parentNode) panel.colliderEditor?.append?.(collisionLabel);
  panel.fixedWorldCollisionCheckbox = collisionCheckbox;

  function syncCollisionToggle() {
    if (!collisionCheckbox) return;
    collisionLabel.hidden = !collisionSelection;
    collisionCheckbox.disabled = !collisionSelection;
    collisionCheckbox.checked = Boolean(collisionSelection?.getCollisionEnabled?.());
  }

  collisionCheckbox.addEventListener("change", () => {
    if (!collisionSelection) return;
    const enabled = collisionSelection.setCollisionEnabled?.(collisionCheckbox.checked);
    collisionCheckbox.checked = enabled !== false;
    scene.interactionRuntime?.refresh?.();
  });
  syncCollisionToggle();
  const interactionLabel = documentRef.createElement("label");
  const interactionName = documentRef.createElement("span");
  interactionName.textContent = "Редактировать точку взаимодействия";
  const interactionCheckbox = documentRef.createElement("input");
  interactionCheckbox.type = "checkbox";
  interactionLabel.append(interactionName, interactionCheckbox);
  panel.panel?.insertBefore?.(interactionLabel, panel.authoringStatus ?? null);
  if (!interactionLabel.parentNode) panel.panel?.append?.(interactionLabel);
  panel.interactionPointEditCheckbox = interactionCheckbox;

  const originalSetEditorMode = panel.setEditorMode?.bind(panel);
  panel.setEditorMode = (mode) => {
    originalSetEditorMode?.(mode);
    if (mode === "interaction-point" && panel.colliderConfirmButton) {
      panel.colliderConfirmButton.textContent = "Сохранить точку взаимодействия";
    }
  };
  panel.setInteractionPointEditorState = (state) => {
    if (!panel.colliderEditorStatus) return;
    panel.colliderEditorStatus.textContent = state?.profileKey
      ? `${state.profileKey}\nточка ${state.offset.x}, ${state.offset.y} px\nстрелки: 1 px`
      : "Кликните по объекту для редактуры точки взаимодействия";
  };

  function renderInteractionPoint() {
    interactionGraphics.clear();
    interactionGraphics.setVisible(interactionEditEnabled);
    if (!interactionEditEnabled) return;
    const marker = interactionState()?.marker;
    if (!marker) return;
    const x = Math.round(marker.x);
    const y = Math.round(marker.y);
    interactionGraphics.fillStyle(0xff4dff, 1);
    interactionGraphics.fillRect(x - 2, y, 5, 1);
    interactionGraphics.fillRect(x, y - 2, 1, 5);
  }

  function disableOtherModes() {
    const modes = [
      [panel.colliderEditCheckbox, () => scene.setColliderEditMode?.(false)],
      [panel.pivotEditCheckbox, () => scene.setPivotEditMode?.(false)],
      [panel.visualOffsetEditCheckbox, () => scene.setVisualOffsetEditMode?.(false)],
    ];
    for (const [checkbox, disable] of modes) {
      if (!checkbox?.checked) continue;
      checkbox.checked = false;
      disable();
    }
  }

  function setInteractionEditMode(active) {
    interactionEditEnabled = Boolean(active);
    scene.interactionPointEditEnabled = interactionEditEnabled;
    interactionDrag = null;
    if (interactionEditEnabled) {
      disableOtherModes();
      panel.setEditorMode?.("interaction-point");
      panel.setInteractionPointEditorState?.(null);
    } else {
      interactionSelection = null;
      panel.setEditorMode?.(null);
      panel.setInteractionPointEditorState?.(null);
    }
    renderInteractionPoint();
  }

  interactionCheckbox.addEventListener("change", () => setInteractionEditMode(interactionCheckbox.checked));
  const otherCheckboxes = [panel.colliderEditCheckbox, panel.pivotEditCheckbox, panel.visualOffsetEditCheckbox].filter(Boolean);
  const disableInteractionFromOtherMode = (event) => {
    if (!event.currentTarget?.checked || !interactionEditEnabled) return;
    interactionCheckbox.checked = false;
    setInteractionEditMode(false);
  };
  otherCheckboxes.forEach((checkbox) => checkbox.addEventListener("change", disableInteractionFromOtherMode));

  const onPointerDown = (pointer) => {
    if (!interactionEditEnabled || scene.buildMode?.isActive?.()) return;
    const worldPoint = point({ x: pointer.worldX ?? pointer.x, y: pointer.worldY ?? pointer.y });
    const selection = runtime.selectInteractionPointAt(worldPoint);
    panel.setInteractionPointEditorState?.(selection);
    interactionDrag = selection ? { startPoint: worldPoint, startOffset: { ...selection.offset } } : null;
    renderInteractionPoint();
  };
  const onPointerMove = (pointer) => {
    if (!interactionEditEnabled || !interactionDrag || !pointer.isDown) return;
    const worldPoint = point({ x: pointer.worldX ?? pointer.x, y: pointer.worldY ?? pointer.y });
    const selection = runtime.setInteractionOffset({
      x: interactionDrag.startOffset.x + worldPoint.x - interactionDrag.startPoint.x,
      y: interactionDrag.startOffset.y + worldPoint.y - interactionDrag.startPoint.y,
    });
    panel.setInteractionPointEditorState?.(selection);
    renderInteractionPoint();
  };
  const onPointerUp = () => { interactionDrag = null; };
  const onKeyDown = (event) => {
    if (!interactionEditEnabled) return;
    const delta = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event?.key];
    if (!delta) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    const selection = runtime.nudgeInteractionOffset(delta.x, delta.y);
    panel.setInteractionPointEditorState?.(selection);
    renderInteractionPoint();
  };
  scene.input?.on?.("pointerdown", onPointerDown);
  scene.input?.on?.("pointermove", onPointerMove);
  scene.input?.on?.("pointerup", onPointerUp);
  scene.input?.keyboard?.on?.("keydown", onKeyDown);

  const onPostUpdate = () => syncSpecialInstances();
  scene.events?.on?.("postupdate", onPostUpdate);
  const originalDestroy = runtime.destroy?.bind(runtime);
  const onSceneShutdown = () => runtime.destroy?.();
  let universalDestroyed = false;
  runtime.destroy = () => {
    if (universalDestroyed) return;
    universalDestroyed = true;
    scene.input?.off?.("pointerdown", onPointerDown);
    scene.input?.off?.("pointermove", onPointerMove);
    scene.input?.off?.("pointerup", onPointerUp);
    scene.input?.keyboard?.off?.("keydown", onKeyDown);
    scene.events?.off?.("postupdate", onPostUpdate);
    scene.events?.off?.("shutdown", onSceneShutdown);
    otherCheckboxes.forEach((checkbox) => checkbox.removeEventListener("change", disableInteractionFromOtherMode));
    if (patchedBeginColliderEditPointer && scene.beginColliderEditPointer === patchedBeginColliderEditPointer) {
      scene.beginColliderEditPointer = originalBeginColliderEditPointer;
    }
    interactionLabel.remove?.();
    collisionLabel.remove?.();
    interactionGraphics.destroy?.();
    scene.interactionPointEditEnabled = false;
    originalDestroy?.();
  };
  scene.events?.once?.("shutdown", onSceneShutdown);
  syncSpecialInstances();
  installAuthoringCanonExport(panel, scene);

  Object.defineProperty(runtime, UNIVERSAL_AUTHORING_PATCH, { value: true });
  return runtime;
}
