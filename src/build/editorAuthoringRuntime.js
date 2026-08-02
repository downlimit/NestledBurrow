import COLLIDER_DEFAULTS from "./colliderDefaults.js";
import STARTING_LAYOUT_DEFAULT from "./startingLayoutDefault.js";
import {
  mergeColliderOverrides,
} from "./colliderDebugOverrides.js";
import {
  applyStartingLayout,
  loadStartingLayout,
  saveStartingLayoutToProject,
  STARTER_TREE_OBJECTS,
} from "./startingLayout.js";
import { EXTRACTABLE_TARGETING_GROUP, PLACEMENT_CELL_SIZE, RESOURCE_INTERACTION_KIND } from "../resources/resourceConfig.js";
import { getResourceProfile, resourceActionForTool } from "../resources/resourceDomain.js";
import { hitResourceDefinition } from "../session/gameSessionState.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";
import { DEFAULT_ASSET_PROFILES, saveAssetProfiles } from "./assetProfiles.js";

export const PLANTED_TREE_PROFILE_ID = "tree-planted";

function contains(bounds, point) {
  return point.x >= bounds.left
    && point.x < bounds.right
    && point.y >= bounds.top
    && point.y < bounds.bottom;
}

function clonePoint(point) {
  return { x: Number(point.x), y: Number(point.y) };
}

export function createPlantedTreeDefinition(object) {
  const profileId = object?.item?.resourceProfileId ?? PLANTED_TREE_PROFILE_ID;
  const profile = getResourceProfile(profileId);
  const collider = object?.colliderBounds;
  if (!object?.id || !collider) throw new Error("Planted tree requires an ID and collider bounds");
  const position = Object.freeze({
    x: (collider.left + collider.right) / 2,
    y: (collider.top + collider.bottom) / 2,
  });
  return Object.freeze({
    id: object.id,
    entityId: object.id,
    worldId: "village",
    roomId: "yard",
    kind: RESOURCE_INTERACTION_KIND,
    profileId,
    visualPosition: Object.freeze({ ...object.point }),
    visualBounds: Object.freeze({ ...object.bounds }),
    colliderBounds: Object.freeze({ ...collider }),
    cell: Object.freeze({
      x: Math.round(collider.left / PLACEMENT_CELL_SIZE),
      y: Math.round(collider.top / PLACEMENT_CELL_SIZE),
    }),
    position,
    radius: 36,
    priority: 1,
    requiresFacing: false,
    facingDotThreshold: -1,
    targetingMode: "facing-first",
    targetingGroup: EXTRACTABLE_TARGETING_GROUP,
    prompt: profile.prompt,
    payload: Object.freeze({ resourceId: object.id }),
  });
}

export function ensurePlantedTreeNode(sessionState, resourceId) {
  const nodes = sessionState?.gameplay?.resourceNodes;
  if (!nodes) throw new Error("Gameplay resource state is unavailable");
  if (!nodes[resourceId]) nodes[resourceId] = { cleared: false, progress: 0 };
  return nodes[resourceId];
}

export function applyPlantedTreeWork(sessionState, definition, {
  damage = 1,
  energyPerHit = 0,
  toolId = getResourceProfile(definition.profileId).requiredTool,
  tuning = {},
} = {}) {
  const profile = getResourceProfile(definition.profileId);
  const action = resourceActionForTool(profile, toolId);
  if (!action) return { status: "wrong-tool", mutated: false };
  ensurePlantedTreeNode(sessionState, definition.id);
  return hitResourceDefinition(sessionState, definition, {
    action,
    damage,
    energyPerHit,
    tuning,
  });
}

export function resolveColliderSelectionPointer(entries, selectionBoundsById, pointer) {
  const point = { x: Number(pointer.worldX ?? pointer.x), y: Number(pointer.worldY ?? pointer.y) };
  if (entries.some(({ rect }) => contains(rect, point))) return pointer;
  const entry = entries
    .filter(({ id }) => contains(selectionBoundsById.get(id) ?? { left: 0, right: 0, top: 0, bottom: 0 }, point))
    .sort((left, right) => {
      const a = selectionBoundsById.get(left.id);
      const b = selectionBoundsById.get(right.id);
      return ((a.right - a.left) * (a.bottom - a.top)) - ((b.right - b.left) * (b.bottom - b.top));
    })[0];
  if (!entry) return pointer;
  return {
    ...pointer,
    worldX: (entry.rect.left + entry.rect.right) / 2,
    worldY: (entry.rect.top + entry.rect.bottom) / 2,
  };
}

function isPlantedTreeObject(object) {
  return Boolean(object)
    && (object.kind === "plant"
      || object.kind === "tree"
      || object.item?.resourceProfileId === PLANTED_TREE_PROFILE_ID);
}

export function attachEditorAuthoringRuntime(scene, {
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  baseUrl = import.meta.env?.BASE_URL ?? "/",
  confirmColliderDraft = () => scene.confirmColliderDraft?.(),
} = {}) {
  if (!scene?.worldLayout) throw new Error("World scene is unavailable");
  const getLocationOwners = () => scene.worldLocationRuntime?.getOwners?.() ?? {};
  const buildCoordinator = getLocationOwners().worldBuildCoordinator;
  if (!buildCoordinator?.getPlacedObjects || !buildCoordinator?.placeBuildAsset) {
    throw new Error("World build coordinator is unavailable");
  }
  const plants = new Map();
  const selectionBoundsById = new Map();
  let destroyed = false;
  let pivotSelection = null;
  let visualOffsetSelection = null;

  scene.colliderOverrides = mergeColliderOverrides(COLLIDER_DEFAULTS, scene.colliderOverrides);
  for (const [groupKey, offsets] of Object.entries(scene.colliderOverrides)) {
    scene.worldLayout.setColliderOverride(groupKey, offsets);
  }

  function stateFor(id) {
    return ensurePlantedTreeNode(scene.sessionState, id);
  }

  function restorePlantVisual(object) {
    getLocationOwners().debrisRuntime?.registerResource?.(object.resourceDefinition, {
      onVisualChange: (visual) => { object.sprites = visual ? [visual] : []; },
    });
    object.resourceCleared = stateFor(object.id).cleared;
  }

  function registerPlant(object) {
    if (!isPlantedTreeObject(object)) return null;
    const ownedVisual = getLocationOwners().debrisRuntime?.getResourceVisual?.(object.id);
    for (const sprite of object.sprites ?? []) if (sprite !== ownedVisual) sprite.destroy?.();
    scene.worldLayout.clearWorldObjectCollider(object.id);
    object.sprites = [];
    object.kind = "plant";
    object.item = { ...object.item, worldId: "village", resourceProfileId: PLANTED_TREE_PROFILE_ID, objectType: "plant" };
    object.collider = true;
    object.colliderGroup = `resource:${PLANTED_TREE_PROFILE_ID}`;
    object.resourceDefinition = createPlantedTreeDefinition(object);
    plants.set(object.id, object);
    selectionBoundsById.set(object.id, { ...object.bounds });
    restorePlantVisual(object);
    scene.interactionRuntime?.refresh?.();
    return object;
  }

  function profileVisualOffset(profileKey) {
    const offset = scene.assetProfiles?.[profileKey]?.visualOffset;
    return { x: Number(offset?.x) || 0, y: Number(offset?.y) || 0 };
  }

  function profileSnapAnchorOffset(profileKey) {
    const offset = scene.assetProfiles?.[profileKey]?.snapAnchorOffset;
    return { x: Number(offset?.x) || 0, y: Number(offset?.y) || 0 };
  }

  function getAuthoringInstances() {
    return [
      ...(getLocationOwners().debrisRuntime?.getAuthoringInstances?.() ?? []),
      ...(getLocationOwners().facilityRuntime?.getAuthoringInstances?.() ?? []),
    ].filter((instance) => scene.assetProfiles?.[instance.profileKey]);
  }

  function findAuthoringInstanceAt(point) {
    return getAuthoringInstances()
      .map((instance) => {
        const visualOffset = profileVisualOffset(instance.profileKey);
        const bounds = {
          left: instance.bounds.left + visualOffset.x,
          right: instance.bounds.right + visualOffset.x,
          top: instance.bounds.top + visualOffset.y,
          bottom: instance.bounds.bottom + visualOffset.y,
        };
        return { instance, bounds };
      })
      .filter(({ bounds }) => contains(bounds, point))
      .sort((a, b) => ((a.bounds.right - a.bounds.left) * (a.bounds.bottom - a.bounds.top))
        - ((b.bounds.right - b.bounds.left) * (b.bounds.bottom - b.bounds.top)))[0]?.instance ?? null;
  }

  function applyProfileVisualOffset(profileKey, value) {
    const offset = { x: Math.round(Number(value?.x) || 0), y: Math.round(Number(value?.y) || 0) };
    const current = scene.assetProfiles?.[profileKey];
    if (!current) return null;
    scene.assetProfiles = Object.freeze({
      ...scene.assetProfiles,
      [profileKey]: Object.freeze({ ...current, visualOffset: Object.freeze(offset) }),
    });
    getLocationOwners().debrisRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    getLocationOwners().facilityRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    return offset;
  }

  function applyProfileSnapAnchorOffset(profileKey, value) {
    const offset = { x: Math.round(Number(value?.x) || 0), y: Math.round(Number(value?.y) || 0) };
    const current = scene.assetProfiles?.[profileKey];
    if (!current) return null;
    scene.assetProfiles = Object.freeze({
      ...scene.assetProfiles,
      [profileKey]: Object.freeze({ ...current, snapAnchorOffset: Object.freeze(offset) }),
    });
    for (const instance of getAuthoringInstances()) {
      if (instance.profileKey !== profileKey) continue;
      const depth = assetDepthFromPivot(instance.anchor, offset, 500, instance.id);
      for (const target of instance.targets) target.setDepth?.(depth);
    }
    getLocationOwners().facilityRuntime?.syncKitchenVisuals?.();
    return offset;
  }

  function selectPivotAt(point) {
    const selected = findAuthoringInstanceAt(point);
    pivotSelection = selected ? {
      id: selected.id,
      profileKey: selected.profileKey,
      anchor: { ...selected.anchor },
      offset: profileSnapAnchorOffset(selected.profileKey),
    } : null;
    return pivotSelection ? { ...pivotSelection, marker: {
      x: pivotSelection.anchor.x + pivotSelection.offset.x,
      y: pivotSelection.anchor.y + pivotSelection.offset.y,
    } } : null;
  }

  function setPivotOffset(value) {
    if (!pivotSelection) return null;
    const offset = applyProfileSnapAnchorOffset(pivotSelection.profileKey, value);
    pivotSelection = { ...pivotSelection, offset };
    return { ...pivotSelection, marker: {
      x: pivotSelection.anchor.x + offset.x,
      y: pivotSelection.anchor.y + offset.y,
    } };
  }

  function unregisterPlant(object, { removeState = true } = {}) {
    if (!isPlantedTreeObject(object)) return;
    plants.delete(object.id);
    selectionBoundsById.delete(object.id);
    getLocationOwners().debrisRuntime?.unregisterResource?.(object.id, { removeState });
    scene.interactionRuntime?.refresh?.();
  }

  const originalPlaceBuildAsset = buildCoordinator.placeBuildAsset?.bind(buildCoordinator);
  if (originalPlaceBuildAsset) {
    buildCoordinator.placeBuildAsset = (item, point, context) => {
      const result = originalPlaceBuildAsset(item, point, context);
      if (result?.status === "placed" && item?.resourceProfileId === PLANTED_TREE_PROFILE_ID) {
        registerPlant(buildCoordinator.getPlacedObject(result.id));
      }
      return result;
    };
  }

  const originalRestoreBuildPlacedObject = buildCoordinator.restoreBuildPlacedObject?.bind(buildCoordinator);
  if (originalRestoreBuildPlacedObject) {
    buildCoordinator.restoreBuildPlacedObject = (placed) => {
      const plant = isPlantedTreeObject(placed);
      const renderable = plant && placed.kind === "plant" ? { ...placed, kind: "tree" } : placed;
      const restored = originalRestoreBuildPlacedObject(renderable);
      if (restored && plant) registerPlant(buildCoordinator.getPlacedObject(placed.id));
      return restored;
    };
  }

  const originalRemoveBuildPlacedObjectById = buildCoordinator.removeBuildPlacedObjectById?.bind(buildCoordinator);
  if (originalRemoveBuildPlacedObjectById) {
    buildCoordinator.removeBuildPlacedObjectById = (id) => {
      const object = buildCoordinator.getPlacedObject(id);
      const removed = originalRemoveBuildPlacedObjectById(id);
      if (object) unregisterPlant(object);
      return removed;
    };
  }

  const originalDemolitionType = buildCoordinator.getBuildObjectDemolitionType?.bind(buildCoordinator);
  if (originalDemolitionType) {
    buildCoordinator.getBuildObjectDemolitionType = (object) => (
      isPlantedTreeObject(object) ? "plant" : originalDemolitionType(object)
    );
  }

  const originalBeginColliderEditPointer = scene.beginColliderEditPointer?.bind(scene);
  if (originalBeginColliderEditPointer) {
    scene.beginColliderEditPointer = (pointer) => originalBeginColliderEditPointer(resolveColliderSelectionPointer(
      scene.worldLayout.getWorldObjectColliders(),
      selectionBoundsById,
      pointer,
    ));
  }

  for (const object of buildCoordinator.getPlacedObjects()) registerPlant(object);
  for (const profileKey of Object.keys(scene.assetProfiles ?? {})) {
    applyProfileVisualOffset(profileKey, profileVisualOffset(profileKey));
  }

  function visualOffsetSelectionState() {
    if (!visualOffsetSelection) return null;
    const offset = profileVisualOffset(visualOffsetSelection.profileKey);
    return {
      ...visualOffsetSelection,
      offset,
      displayBounds: {
        left: visualOffsetSelection.bounds.left + offset.x,
        right: visualOffsetSelection.bounds.right + offset.x,
        top: visualOffsetSelection.bounds.top + offset.y,
        bottom: visualOffsetSelection.bounds.bottom + offset.y,
      },
    };
  }

  function selectVisualOffsetAt(point) {
    const selected = findAuthoringInstanceAt(point);
    visualOffsetSelection = selected ? {
      id: selected.id,
      profileKey: selected.profileKey,
      anchor: { ...selected.anchor },
      bounds: { ...selected.bounds },
    } : null;
    return visualOffsetSelectionState();
  }

  function setVisualOffset(value) {
    if (!visualOffsetSelection) return null;
    applyProfileVisualOffset(visualOffsetSelection.profileKey, value);
    return visualOffsetSelectionState();
  }

  return {
    restoreStartingLayout() {
      if (destroyed) return null;
      const layout = loadStartingLayout(storage, STARTING_LAYOUT_DEFAULT);
      if (layout) return applyStartingLayout(scene, layout);
      for (const object of STARTER_TREE_OBJECTS) {
        if (buildCoordinator.getPlacedObject(object.id)) continue;
        if (!buildCoordinator.restoreBuildPlacedObject(JSON.parse(JSON.stringify(object)))) {
          throw new Error(`Failed to restore starter plant ${object.id}`);
        }
      }
      return null;
    },
    saveStartingLayout() {
      if (destroyed) throw new Error("Authoring runtime is destroyed");
      return saveStartingLayoutToProject(scene, { storage, fetchImpl, baseUrl });
    },
    async applyColliderDraftToProject() {
      if (destroyed) throw new Error("Authoring runtime is destroyed");
      const result = confirmColliderDraft();
      if ((!result || result.status === "empty") && !pivotSelection && !visualOffsetSelection) return result ?? { status: "empty" };
      saveAssetProfiles(scene.assetProfiles, storage);
      // The in-game authoring action is deliberately browser-local. Writing a
      // source module makes Vite reload the whole game and invalidates the
      // active authoring session. The development endpoint remains available
      // for an explicit source-export flow, while this action updates every
      // live instance of the selected profile without a restart.
      return { ...result, status: "saved-locally" };
    },
    selectPivotAt,
    setPivotOffset,
    nudgePivot(dx, dy) {
      if (!pivotSelection) return null;
      return setPivotOffset({ x: pivotSelection.offset.x + dx, y: pivotSelection.offset.y + dy });
    },
    alignPivotToCollider(axis) {
      if (!pivotSelection || !["x", "y"].includes(axis)) return null;
      const collider = scene.worldLayout.getWorldObjectColliders()
        .find((entry) => entry.id === pivotSelection.id)?.rect;
      if (!collider) return null;
      const centeredOffset = {
        ...pivotSelection.offset,
        [axis]: ((collider[axis === "x" ? "left" : "top"] + collider[axis === "x" ? "right" : "bottom"]) / 2)
          - pivotSelection.anchor[axis],
      };
      return setPivotOffset(centeredOffset);
    },
    getPivotSelection() {
      if (!pivotSelection) return null;
      return { ...pivotSelection, marker: {
        x: pivotSelection.anchor.x + pivotSelection.offset.x,
        y: pivotSelection.anchor.y + pivotSelection.offset.y,
      } };
    },
    clearPivotSelection() { pivotSelection = null; },
    selectVisualOffsetAt,
    setVisualOffset,
    nudgeVisualOffset(dx, dy) {
      if (!visualOffsetSelection) return null;
      const offset = profileVisualOffset(visualOffsetSelection.profileKey);
      return setVisualOffset({ x: offset.x + dx, y: offset.y + dy });
    },
    getVisualOffsetSelection: visualOffsetSelectionState,
    resetVisualOffset() {
      if (!visualOffsetSelection) return null;
      return setVisualOffset(DEFAULT_ASSET_PROFILES[visualOffsetSelection.profileKey]?.visualOffset ?? { x: 0, y: 0 });
    },
    clearVisualOffsetSelection() { visualOffsetSelection = null; },
    getPlantDefinitions() {
      return [...plants.values()].map((object) => object.resourceDefinition);
    },
    destroy() {
      destroyed = true;
      plants.clear();
      selectionBoundsById.clear();
    },
  };
}
