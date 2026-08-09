import { assetDepthFromRenderMode, WORLD_DEPTH_BASE } from "./buildWorldGeometry.js";
import {
  assetAuthoringColliderSelectionPoint,
  collectAssetAuthoringInstances,
  findAssetAuthoringInstanceAt,
} from "./assetAuthoringRegistry.js";
import { installAuthoringCanonExport } from "./authoringCanonExport.js";
import { canonicalVisualOffsetAtCurrentPivot } from "./assetProfileRelations.js";
import { getColliderResizeEdges } from "./colliderResize.js";
import {
  ASSET_RENDER_MODES,
  DEFAULT_ASSET_PROFILES,
  saveAssetProfiles,
} from "./assetProfiles.js";

const UNIVERSAL_AUTHORING_PATCH = Symbol("nestledBurrowUniversalPlaceableAuthoring");

function point(value = {}) {
  return {
    x: Math.round(Number(value.x) || 0),
    y: Math.round(Number(value.y) || 0),
  };
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

export function installUniversalPlaceableAuthoring(panel, scene) {
  const runtime = panel?.authoringRuntime;
  if (!runtime || !scene || runtime[UNIVERSAL_AUTHORING_PATCH]) return runtime ?? null;

  let pivotSelection = null;
  let visualSelection = null;
  let interactionSelection = null;
  let collisionSelection = null;
  let collisionCheckbox = null;
  const getOwners = () => scene.worldLocationRuntime?.getOwners?.() ?? {};

  function getInstances() {
    return collectAssetAuthoringInstances(scene);
  }

  function findAt(value) {
    return findAssetAuthoringInstanceAt(scene, value, { instances: getInstances() });
  }

  function remember(instance) {
    const state = panel.assetAuthoringEnhancement;
    if (state) state.selectedAsset = instance ? { id: instance.id, profileKey: instance.profileKey } : null;
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
    const renderMode = scene.assetProfiles?.[instance.profileKey]?.renderMode
      ?? (instance.depthMode === "fixed" ? ASSET_RENDER_MODES.belowCharacter : ASSET_RENDER_MODES.pivotDepth);
    const depth = assetDepthFromRenderMode({
      placementPosition: instance.anchor,
      pivotOffset,
      renderMode,
      fixedBelowDepth: instance.fixedDepth,
      stableId: instance.id,
    });
    return depth + index * 0.01;
  }

  function syncSpecialInstance(instance) {
    if (instance.presentationManagedByOwner) return;
    const visualOffset = profileOffset(scene, instance.profileKey, "visualOffset");
    const pivotOffset = profileOffset(scene, instance.profileKey, "snapAnchorOffset");
    instance.targets.forEach((target, index) => {
      if (instance.special) target.setPosition?.(
        instance.visualBasePosition.x + visualOffset.x,
        instance.visualBasePosition.y + visualOffset.y,
      );
      target.setDepth?.(depthFor(instance, pivotOffset, index));
    });
  }

  function syncSpecialInstances(profileKey = null) {
    for (const instance of getInstances()) {
      if (profileKey && instance.profileKey !== profileKey) continue;
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
    owners.worldBuildCoordinator?.applyWallAuthoringProfile?.(profileKey);
    return offset;
  }

  function applyPivotOffset(profileKey, value) {
    const offset = replaceProfilePoint(scene, profileKey, "snapAnchorOffset", value);
    if (!offset) return null;
    const owners = getOwners();
    owners.facilityRuntime?.syncKitchenVisuals?.();
    for (const instance of getInstances()) {
      if (instance.profileKey !== profileKey) continue;
      if (instance.presentationManagedByOwner) continue;
      instance.targets.forEach((target, index) => target.setDepth?.(depthFor(instance, offset, index)));
    }
    owners.worldBuildCoordinator?.applyWallAuthoringProfile?.(profileKey);
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
    remember(instance);
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
    remember(instance);
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
    remember(instance);
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

  const originalBeginColliderEditPointer = scene.beginColliderEditPointer?.bind(scene);
  let patchedBeginColliderEditPointer = null;
  if (originalBeginColliderEditPointer) {
    patchedBeginColliderEditPointer = (pointer) => {
      const worldPoint = point({ x: pointer.worldX ?? pointer.x, y: pointer.worldY ?? pointer.y });
      if (scene.colliderEditSelection?.draft
        && getColliderResizeEdges(worldPoint, scene.colliderEditSelection.draft)) {
        return originalBeginColliderEditPointer(pointer);
      }
      const instance = findAt(worldPoint);
      collisionSelection = instance ?? null;
      remember(instance);
      syncCollisionToggle();
      if (!instance) return originalBeginColliderEditPointer(pointer);
      const selectionPoint = assetAuthoringColliderSelectionPoint(scene, instance);
      return selectionPoint
        ? originalBeginColliderEditPointer({ ...pointer, worldX: selectionPoint.x, worldY: selectionPoint.y })
        : originalBeginColliderEditPointer(pointer);
    };
    scene.beginColliderEditPointer = patchedBeginColliderEditPointer;
  }

  const documentRef = panel.documentRef ?? globalThis.document;
  const collisionLabel = documentRef.createElement("label");
  collisionLabel.className = "collider-debug-wide-control";
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
    const colliderMode = panel.assetAuthoringEnhancement?.mode === "collider";
    collisionLabel.hidden = !colliderMode || !collisionSelection;
    collisionCheckbox.disabled = !collisionSelection;
    const explicit = collisionSelection?.getCollisionEnabled?.();
    const entry = scene.worldLayout?.getWorldObjectColliders?.()
      .find(({ id }) => id === collisionSelection?.id);
    collisionCheckbox.checked = explicit === undefined
      ? entry?.collisionEnabled !== false
      : Boolean(explicit);
  }

  collisionCheckbox.addEventListener("change", () => {
    if (!collisionSelection) return;
    let enabled = collisionSelection.setCollisionEnabled?.(collisionCheckbox.checked);
    if (enabled === undefined) {
      enabled = Boolean(collisionCheckbox.checked);
      const profile = scene.assetProfiles?.[collisionSelection.profileKey];
      if (profile) {
        scene.assetProfiles = Object.freeze({
          ...scene.assetProfiles,
          [collisionSelection.profileKey]: Object.freeze({ ...profile, collisionEnabled: enabled }),
        });
      }
      const entries = scene.worldLayout?.getWorldObjectColliders?.() ?? [];
      for (const entry of entries) {
        if (entry.groupKey !== collisionSelection.profileKey) continue;
        const { id, groupKey, rect, base, collisionEnabled: _previous, ...metadata } = entry;
        scene.worldLayout?.setWorldObjectCollider?.(id, base ?? rect, groupKey ?? collisionSelection.profileKey, {
          ...metadata,
          collisionEnabled: enabled,
        });
      }
    }
    collisionCheckbox.checked = enabled !== false;
    scene.interactionRuntime?.refresh?.();
    scene.renderColliderDebug?.();
  });
  syncCollisionToggle();
  panel.syncCollisionToggle = syncCollisionToggle;
  panel.setInteractionPointEditorState = (state) => {
    if (!panel.colliderEditorStatus) return;
    panel.colliderEditorStatus.textContent = state?.profileKey
      ? `${state.profileKey}\nточка ${state.offset.x}, ${state.offset.y} px\nстрелки: 1 px`
      : "Кликните по спрайту для редактирования точки взаимодействия";
  };

  const onPostUpdate = () => syncSpecialInstances();
  scene.events?.on?.("postupdate", onPostUpdate);
  const originalDestroy = runtime.destroy?.bind(runtime);
  const onSceneShutdown = () => runtime.destroy?.();
  let universalDestroyed = false;
  runtime.destroy = () => {
    if (universalDestroyed) return;
    universalDestroyed = true;
    scene.events?.off?.("postupdate", onPostUpdate);
    scene.events?.off?.("shutdown", onSceneShutdown);
    if (patchedBeginColliderEditPointer && scene.beginColliderEditPointer === patchedBeginColliderEditPointer) {
      scene.beginColliderEditPointer = originalBeginColliderEditPointer;
    }
    if (panel.syncCollisionToggle === syncCollisionToggle) panel.syncCollisionToggle = null;
    collisionLabel.remove?.();
    originalDestroy?.();
  };
  scene.events?.once?.("shutdown", onSceneShutdown);
  syncSpecialInstances();
  installAuthoringCanonExport(panel, scene);

  Object.defineProperty(runtime, UNIVERSAL_AUTHORING_PATCH, { value: true });
  return runtime;
}
