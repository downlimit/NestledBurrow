import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { WELL_PROFILE } from "../resources/farmingConfig.js";
import { TAVERN_SIGN } from "../tavern/guestConfig.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";
import { installAuthoringCanonExport } from "./authoringCanonExport.js";
import { canonicalVisualOffsetAtCurrentPivot } from "./assetProfileRelations.js";
import { DEFAULT_ASSET_PROFILES } from "./assetProfiles.js";

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
  const getOwners = () => scene.worldLocationRuntime?.getOwners?.() ?? {};

  function getInstances() {
    const owners = getOwners();
    const instances = [
      ...runtimeInstances(owners),
      ...transitionInstances(scene),
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

  function syncSpecialInstance(instance) {
    const visualOffset = profileOffset(scene, instance.profileKey, "visualOffset");
    const pivotOffset = profileOffset(scene, instance.profileKey, "snapAnchorOffset");
    const depth = assetDepthFromPivot(instance.anchor, pivotOffset, 500, instance.id);
    instance.targets.forEach((target, index) => {
      target.setPosition?.(
        instance.visualBasePosition.x + visualOffset.x,
        instance.visualBasePosition.y + visualOffset.y,
      );
      target.setDepth?.(depth + index * 0.01);
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
      const depth = assetDepthFromPivot(instance.anchor, offset, 500, instance.id);
      instance.targets.forEach((target, index) => target.setDepth?.(depth + index * 0.01));
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

  const onPostUpdate = () => syncSpecialInstances();
  scene.events?.on?.("postupdate", onPostUpdate);
  scene.events?.once?.("shutdown", () => scene.events?.off?.("postupdate", onPostUpdate));
  syncSpecialInstances();
  installAuthoringCanonExport(panel, scene);

  Object.defineProperty(runtime, UNIVERSAL_AUTHORING_PATCH, { value: true });
  return runtime;
}
