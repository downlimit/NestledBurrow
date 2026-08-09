import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { WELL_PROFILE } from "../resources/farmingConfig.js";
import { TAVERN_SIGN } from "../tavern/guestConfig.js";

export const ASSET_AUTHORING_INSTANCE_TYPE = "asset-instance-v1";
export const ASSET_INTERACTION_ROLES = Object.freeze({
  primary: "primary",
  support: "support",
});

export const ASSET_AUTHORING_CAPABILITIES = Object.freeze({
  collider: true,
  pivot: true,
  visualOffset: true,
  crop: true,
  approachDirections: true,
  interactionPoint: true,
  renderMode: true,
  timeline: true,
});

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be finite`);
  return number;
}

function normalizePoint(value, label) {
  return Object.freeze({
    x: finite(value?.x, `${label}.x`),
    y: finite(value?.y, `${label}.y`),
  });
}

function normalizeBounds(value, label) {
  const bounds = Object.freeze({
    left: finite(value?.left, `${label}.left`),
    right: finite(value?.right, `${label}.right`),
    top: finite(value?.top, `${label}.top`),
    bottom: finite(value?.bottom, `${label}.bottom`),
  });
  if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
    throw new Error(`${label} must have positive area`);
  }
  return bounds;
}

export function createAssetAuthoringInstance(value) {
  if (!value || typeof value !== "object") throw new Error("Authoring instance must be an object");
  if (typeof value.id !== "string" || !value.id) throw new Error("Authoring instance requires a stable ID");
  if (typeof value.profileKey !== "string" || !value.profileKey) {
    throw new Error(`Authoring instance ${value.id} requires a profile key`);
  }
  const targets = Object.freeze([...(value.targets ?? [])].filter(Boolean));
  if (targets.length === 0) throw new Error(`Authoring instance ${value.id} requires a render target`);
  const capabilities = Object.freeze({
    ...ASSET_AUTHORING_CAPABILITIES,
    ...(value.authoringCapabilities ?? {}),
    collisionToggle: typeof value.setCollisionEnabled === "function",
  });
  const anchor = normalizePoint(value.anchor, `Authoring instance ${value.id} anchor`);
  return Object.freeze({
    ...value,
    authoringType: ASSET_AUTHORING_INSTANCE_TYPE,
    authoringCapabilities: capabilities,
    anchor,
    bounds: normalizeBounds(value.bounds, `Authoring instance ${value.id} bounds`),
    visualBasePosition: normalizePoint(value.visualBasePosition ?? anchor, `Authoring instance ${value.id} visual base`),
    targets,
  });
}

export function resolvePrimaryAssetInteractionInstance(instances = [], preferred = null) {
  if (!preferred) return null;
  if (preferred.interactionRole !== ASSET_INTERACTION_ROLES.support) return preferred;
  if (!preferred.moveGroupId) return preferred;
  return instances.find((candidate) => (
    candidate?.moveGroupId === preferred.moveGroupId
      && candidate.interactionRole === ASSET_INTERACTION_ROLES.primary
  )) ?? preferred;
}

function runtimeInstances(owners) {
  return [
    ...(owners.debrisRuntime?.getAuthoringInstances?.() ?? []),
    ...(owners.facilityRuntime?.getAuthoringInstances?.() ?? []),
    ...(owners.worldBuildCoordinator?.getWallAuthoringInstances?.() ?? []),
  ];
}

function transitionInstances(scene) {
  return scene.worldPresentationRuntime?.getTransitionAuthoringInstances?.() ?? [];
}

function wildAtollInstances(owners) {
  return owners.wildAtollRuntime?.getAuthoringInstances?.() ?? [];
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
  return target?.targets?.length ? [{
    id: TAVERN_SIGN.id,
    profileKey: "facility:tavern-sign",
    anchor: { ...state.position },
    bounds: target.authoringBounds ?? target.bounds,
    visualBasePosition: { ...state.position },
    targets: target.targets,
    special: true,
  }] : [];
}

function trainingDummyInstances(owners) {
  const runtime = owners.meleeRuntime;
  const state = runtime?.getState?.()?.dummy;
  if (!state?.position || !runtime?.getBuildMoveTargetAt) return [];
  const target = runtime.getBuildMoveTargetAt({
    x: state.position.x + TRAINING_DUMMY.asset.width / 2,
    y: state.position.y + TRAINING_DUMMY.asset.height / 2,
  });
  return target?.targets?.length ? [{
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
  }] : [];
}

export function collectAssetAuthoringInstances(scene) {
  const owners = scene?.worldLocationRuntime?.getOwners?.() ?? {};
  const instances = [
    ...runtimeInstances(owners),
    ...transitionInstances(scene),
    ...wildAtollInstances(owners),
    ...wellInstances(owners),
    ...tavernSignInstances(owners),
    ...trainingDummyInstances(owners),
  ].filter((instance) => scene?.assetProfiles?.[instance?.profileKey]);
  return Object.freeze([...new Map(instances.map((instance) => {
    const normalized = createAssetAuthoringInstance(instance);
    return [`${normalized.profileKey}:${normalized.id}`, normalized];
  })).values()]);
}

export function authoringInstanceVisualBounds(scene, instance) {
  const offset = scene?.assetProfiles?.[instance.profileKey]?.visualOffset ?? { x: 0, y: 0 };
  return Object.freeze({
    left: instance.bounds.left + Number(offset.x || 0),
    right: instance.bounds.right + Number(offset.x || 0),
    top: instance.bounds.top + Number(offset.y || 0),
    bottom: instance.bounds.bottom + Number(offset.y || 0),
  });
}

export function findAssetAuthoringInstanceAt(scene, point, {
  capability = null,
  instances = collectAssetAuthoringInstances(scene),
} = {}) {
  return instances
    .flatMap((instance) => {
      if (capability && instance.authoringCapabilities?.[capability] !== true) return [];
      const bounds = authoringInstanceVisualBounds(scene, instance);
      return contains(bounds, point) ? [{ instance, bounds }] : [];
    })
    .sort((left, right) => area(left.bounds) - area(right.bounds))[0]?.instance ?? null;
}

export function assetAuthoringColliderSelectionPoint(scene, instance) {
  if (!instance) return null;
  const target = scene?.worldLayout?.getWorldObjectColliders?.()
    .find(({ id }) => id === instance.id)?.rect ?? instance.bounds;
  if (!target) return null;
  const insetX = Math.min(1, Math.max(0, (target.right - target.left) / 4));
  const insetY = Math.min(1, Math.max(0, (target.bottom - target.top) / 4));
  const candidates = [
    {
      x: (target.left + target.right) / 2,
      y: (target.top + target.bottom) / 2,
    },
    { x: target.left + insetX, y: (target.top + target.bottom) / 2 },
    { x: target.right - insetX, y: (target.top + target.bottom) / 2 },
    { x: (target.left + target.right) / 2, y: target.top + insetY },
    { x: (target.left + target.right) / 2, y: target.bottom - insetY },
  ];
  const others = (scene?.worldLayout?.getWorldObjectColliders?.() ?? [])
    .filter(({ id }) => id !== instance.id)
    .map(({ rect }) => rect);
  return candidates.find((candidate) => !others.some((rect) => contains(rect, candidate))) ?? candidates[0];
}

function contains(bounds, point) {
  return Number(point?.x) >= bounds.left && Number(point?.x) < bounds.right
    && Number(point?.y) >= bounds.top && Number(point?.y) < bounds.bottom;
}

function area(bounds) {
  return (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
}
