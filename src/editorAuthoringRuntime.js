import COLLIDER_DEFAULTS from "./colliderDefaults.js";
import STARTING_LAYOUT_DEFAULT from "./startingLayoutDefault.js";
import {
  mergeColliderOverrides,
} from "./colliderDebugOverrides.js";
import {
  applyStartingLayout,
  loadStartingLayout,
  saveStartingLayoutToProject,
} from "./startingLayout.js";
import { PLACEMENT_CELL_SIZE, RESOURCE_INTERACTION_KIND } from "./resourceConfig.js";
import { applyResourceWork, getResourceProfile } from "./resourceDomain.js";
import { TILE_SIZE } from "./worldConfig.js";
import { saveAssetProfiles } from "./assetProfiles.js";

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
    roomId: "yard",
    kind: RESOURCE_INTERACTION_KIND,
    profileId,
    cell: Object.freeze({
      x: Math.round(collider.left / PLACEMENT_CELL_SIZE),
      y: Math.round(collider.top / PLACEMENT_CELL_SIZE),
    }),
    position,
    radius: 36,
    priority: 1,
    requiresFacing: false,
    facingDotThreshold: -1,
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
  tuning = {},
} = {}) {
  const profile = getResourceProfile(definition.profileId);
  const node = ensurePlantedTreeNode(sessionState, definition.id);
  if (node.cleared) return { status: "already-cleared", mutated: false };
  const cost = Math.max(0, Number(energyPerHit) || 0);
  if (sessionState.gameplay.currentEnergy < cost) return { status: "insufficient-energy", mutated: false };
  const result = applyResourceWork(node, profile, {
    action: profile.preferredAction,
    damage,
    tuning,
  });
  if (!result.mutated) return result;
  sessionState.gameplay.currentEnergy -= cost;
  if (result.status === "cleared") sessionState.gameplay[profile.reward.resource] += profile.reward.amount;
  return {
    ...result,
    currentEnergy: sessionState.gameplay.currentEnergy,
    reward: result.status === "cleared" ? profile.reward : null,
  };
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

function createTreeSprites(scene, object) {
  if (object.sprites?.length) return object.sprites;
  const sprites = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const offset = scene.assetProfiles?.[`resource:${object.item.resourceProfileId ?? PLANTED_TREE_PROFILE_ID}`]?.visualOffset ?? { x: 0, y: 0 };
      sprites.push(scene.add.image(
        object.point.x + column * TILE_SIZE + offset.x,
        object.point.y + row * TILE_SIZE + offset.y,
        object.item.textureKey,
        row * 9 + column,
      ).setOrigin(0).setDepth(500 + object.point.y + 4 * TILE_SIZE));
    }
  }
  object.sprites = sprites;
  return sprites;
}

function destroyTreeSprites(object) {
  for (const sprite of object.sprites ?? []) sprite.destroy?.();
  object.sprites = [];
}

export function attachEditorAuthoringRuntime(scene, {
  storage = globalThis.localStorage,
  fetchImpl = globalThis.fetch,
  baseUrl = import.meta.env?.BASE_URL ?? "/",
  confirmColliderDraft = () => scene.confirmColliderDraft?.(),
} = {}) {
  if (!scene?.worldLayout) throw new Error("World scene is unavailable");
  const plants = new Map();
  const selectionBoundsById = new Map();
  let destroyed = false;
  let pivotSelection = null;

  scene.colliderOverrides = mergeColliderOverrides(COLLIDER_DEFAULTS, scene.colliderOverrides);
  for (const [groupKey, offsets] of Object.entries(scene.colliderOverrides)) {
    scene.worldLayout.setColliderOverride(groupKey, offsets);
  }

  function stateFor(id) {
    return ensurePlantedTreeNode(scene.sessionState, id);
  }

  function setPlantCollider(object, active) {
    scene.worldLayout.clearWorldObjectCollider(object.id);
    if (!active) return;
    scene.worldLayout.setWorldObjectCollider(
      object.id,
      object.colliderBounds,
      `resource:${object.item.resourceProfileId}`,
    );
  }

  function restorePlantVisual(object) {
    if (stateFor(object.id).cleared) {
      destroyTreeSprites(object);
      setPlantCollider(object, false);
      object.resourceCleared = true;
      return;
    }
    createTreeSprites(scene, object);
    setPlantCollider(object, true);
    object.resourceCleared = false;
  }

  function registerPlant(object) {
    if (!isPlantedTreeObject(object)) return null;
    object.kind = "plant";
    object.item = { ...object.item, resourceProfileId: PLANTED_TREE_PROFILE_ID, objectType: "plant" };
    object.collider = true;
    object.colliderGroup = `resource:${PLANTED_TREE_PROFILE_ID}`;
    object.resourceDefinition = createPlantedTreeDefinition(object);
    plants.set(object.id, object);
    selectionBoundsById.set(object.id, { ...object.bounds });
    restorePlantVisual(object);
    scene.interactionRuntime?.refresh?.();
    return object;
  }

  function profileOffset(profileKey) {
    const offset = scene.assetProfiles?.[profileKey]?.visualOffset;
    return { x: Number(offset?.x) || 0, y: Number(offset?.y) || 0 };
  }

  function plantAuthoringInstances() {
    return [...plants.values()].flatMap((object) => object.sprites?.length ? [{
      id: object.id,
      profileKey: `resource:${object.item.resourceProfileId}`,
      anchor: { ...object.point },
      bounds: { ...object.bounds },
      targets: object.sprites,
    }] : []);
  }

  function getAuthoringInstances() {
    return [
      ...(scene.debrisRuntime?.getAuthoringInstances?.() ?? []),
      ...(scene.facilityRuntime?.getAuthoringInstances?.() ?? []),
      ...plantAuthoringInstances(),
    ].filter((instance) => scene.assetProfiles?.[instance.profileKey]);
  }

  function applyPlantOffset(profileKey, offset) {
    for (const object of plants.values()) {
      if (`resource:${object.item.resourceProfileId}` !== profileKey) continue;
      for (let index = 0; index < (object.sprites?.length ?? 0); index += 1) {
        const sprite = object.sprites[index];
        const row = Math.floor(index / 3);
        const column = index % 3;
        sprite.setPosition?.(
          object.point.x + column * TILE_SIZE + offset.x,
          object.point.y + row * TILE_SIZE + offset.y,
        );
      }
    }
  }

  function applyProfileVisualOffset(profileKey, value) {
    const offset = { x: Math.round(Number(value?.x) || 0), y: Math.round(Number(value?.y) || 0) };
    const current = scene.assetProfiles?.[profileKey];
    if (!current) return null;
    scene.assetProfiles = Object.freeze({
      ...scene.assetProfiles,
      [profileKey]: Object.freeze({ ...current, visualOffset: Object.freeze(offset) }),
    });
    scene.debrisRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    scene.facilityRuntime?.applyAuthoringVisualOffset?.(profileKey, offset);
    applyPlantOffset(profileKey, offset);
    return offset;
  }

  function selectPivotAt(point) {
    const candidates = getAuthoringInstances()
      .map((instance) => {
        const offset = profileOffset(instance.profileKey);
        const bounds = {
          left: instance.bounds.left + offset.x,
          right: instance.bounds.right + offset.x,
          top: instance.bounds.top + offset.y,
          bottom: instance.bounds.bottom + offset.y,
        };
        return { instance, offset, bounds };
      })
      .filter(({ bounds }) => contains(bounds, point))
      .sort((a, b) => ((a.bounds.right - a.bounds.left) * (a.bounds.bottom - a.bounds.top))
        - ((b.bounds.right - b.bounds.left) * (b.bounds.bottom - b.bounds.top)));
    const selected = candidates[0];
    pivotSelection = selected ? {
      id: selected.instance.id,
      profileKey: selected.instance.profileKey,
      anchor: { ...selected.instance.anchor },
      offset: { ...selected.offset },
    } : null;
    return pivotSelection ? { ...pivotSelection, marker: {
      x: pivotSelection.anchor.x + pivotSelection.offset.x,
      y: pivotSelection.anchor.y + pivotSelection.offset.y,
    } } : null;
  }

  function setPivotOffset(value) {
    if (!pivotSelection) return null;
    const offset = applyProfileVisualOffset(pivotSelection.profileKey, value);
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
    if (removeState) delete scene.sessionState?.gameplay?.resourceNodes?.[object.id];
    scene.interactionRuntime?.refresh?.();
  }

  const originalPlaceBuildAsset = scene.placeBuildAsset?.bind(scene);
  if (originalPlaceBuildAsset) {
    scene.placeBuildAsset = (item, point, context) => {
      const result = originalPlaceBuildAsset(item, point, context);
      if (result?.status === "placed" && item?.resourceProfileId === PLANTED_TREE_PROFILE_ID) {
        registerPlant(scene.buildPlacedObjects.get(result.id));
      }
      return result;
    };
  }

  const originalRestoreBuildPlacedObject = scene.restoreBuildPlacedObject?.bind(scene);
  if (originalRestoreBuildPlacedObject) {
    scene.restoreBuildPlacedObject = (placed) => {
      const plant = isPlantedTreeObject(placed);
      const renderable = plant && placed.kind === "plant" ? { ...placed, kind: "tree" } : placed;
      const restored = originalRestoreBuildPlacedObject(renderable);
      if (restored && plant) registerPlant(scene.buildPlacedObjects.get(placed.id));
      return restored;
    };
  }

  const originalRemoveBuildPlacedObjectById = scene.removeBuildPlacedObjectById?.bind(scene);
  if (originalRemoveBuildPlacedObjectById) {
    scene.removeBuildPlacedObjectById = (id) => {
      const object = scene.buildPlacedObjects?.get?.(id);
      const removed = originalRemoveBuildPlacedObjectById(id);
      if (object) unregisterPlant(object);
      return removed;
    };
  }

  const originalDemolitionType = scene.getBuildObjectDemolitionType?.bind(scene);
  if (originalDemolitionType) {
    scene.getBuildObjectDemolitionType = (object) => isPlantedTreeObject(object) ? "plant" : originalDemolitionType(object);
  }

  const originalBeginColliderEditPointer = scene.beginColliderEditPointer?.bind(scene);
  if (originalBeginColliderEditPointer) {
    scene.beginColliderEditPointer = (pointer) => originalBeginColliderEditPointer(resolveColliderSelectionPointer(
      scene.worldLayout.getWorldObjectColliders(),
      selectionBoundsById,
      pointer,
    ));
  }

  const originalInteractionDefinitions = scene.debrisRuntime?.getInteractionDefinitions?.bind(scene.debrisRuntime);
  if (originalInteractionDefinitions) {
    scene.debrisRuntime.getInteractionDefinitions = () => [
      ...originalInteractionDefinitions(),
      ...[...plants.values()]
        .filter((object) => !stateFor(object.id).cleared)
        .map((object) => object.resourceDefinition),
    ];
  }

  const originalRebuildDebris = scene.debrisRuntime?.rebuild?.bind(scene.debrisRuntime);
  if (originalRebuildDebris) {
    scene.debrisRuntime.rebuild = () => {
      const result = originalRebuildDebris();
      for (const object of plants.values()) restorePlantVisual(object);
      scene.interactionRuntime?.refresh?.();
      return result;
    };
  }

  function animatePlantHit(object, result, onComplete) {
    const sprites = object.sprites ?? [];
    if (result.status === "cleared") {
      setPlantCollider(object, false);
      object.resourceCleared = true;
      if (!sprites.length || !scene.tweens?.add) {
        destroyTreeSprites(object);
        onComplete();
        return;
      }
      scene.tweens.add({
        targets: sprites,
        alpha: 0,
        scaleY: 0.55,
        duration: 160,
        ease: "Quad.easeOut",
        onComplete: () => { destroyTreeSprites(object); onComplete(); },
      });
      return;
    }
    if (!sprites.length || !scene.tweens?.add) return onComplete();
    const origins = sprites.map((sprite) => ({ sprite, x: sprite.x }));
    scene.tweens.add({
      targets: sprites,
      x: "+=1",
      duration: 60,
      yoyo: true,
      onComplete: () => {
        for (const origin of origins) origin.sprite.x = origin.x;
        onComplete();
      },
    });
  }

  const originalRunWorldObjectInteraction = scene.runWorldObjectInteraction?.bind(scene);
  if (originalRunWorldObjectInteraction) {
    scene.runWorldObjectInteraction = (candidate) => {
      const resourceId = candidate?.payload?.resourceId;
      const object = plants.get(resourceId);
      if (!object || candidate.kind !== RESOURCE_INTERACTION_KIND) return originalRunWorldObjectInteraction(candidate);
      const nowMs = globalThis.performance?.now?.() ?? Date.now();
      if (nowMs - scene.lastSuccessfulHitAtMs < scene.gameplayTuning.universalHitCooldownSeconds * 1000) {
        return { status: "cooldown", mutated: false };
      }
      const profile = getResourceProfile(object.resourceDefinition.profileId);
      const energyBefore = scene.sessionState.gameplay.currentEnergy;
      const result = applyPlantedTreeWork(scene.sessionState, object.resourceDefinition, {
        damage: scene.gameplayTuning.axeDamage,
        energyPerHit: scene.gameplayTuning.energyPerHit,
        tuning: scene.gameplayTuning,
      });
      if (result.mutated) {
        scene.lastSuccessfulHitAtMs = nowMs;
        scene.activeResourceProfileId = profile.id;
        scene.interactionHud?.triggerCooldownFeedback?.();
        scene.gameHud?.render?.();
        scene.applySuccessfulHitFeedback?.(profile.sfx, energyBefore);
        animatePlantHit(object, result, () => scene.interactionRuntime?.refresh?.());
        scene.saveSession?.();
      }
      return result;
    };
  }

  for (const object of scene.buildPlacedObjects?.values?.() ?? []) registerPlant(object);
  for (const profileKey of Object.keys(scene.assetProfiles ?? {})) {
    applyProfileVisualOffset(profileKey, profileOffset(profileKey));
  }

  return {
    restoreStartingLayout() {
      if (destroyed) return null;
      const layout = loadStartingLayout(storage, STARTING_LAYOUT_DEFAULT);
      return layout ? applyStartingLayout(scene, layout) : null;
    },
    saveStartingLayout() {
      if (destroyed) throw new Error("Authoring runtime is destroyed");
      return saveStartingLayoutToProject(scene, { storage, fetchImpl, baseUrl });
    },
    async applyColliderDraftToProject() {
      if (destroyed) throw new Error("Authoring runtime is destroyed");
      const result = confirmColliderDraft();
      if ((!result || result.status === "empty") && !pivotSelection) return result ?? { status: "empty" };
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
    getPivotSelection() {
      if (!pivotSelection) return null;
      return { ...pivotSelection, marker: {
        x: pivotSelection.anchor.x + pivotSelection.offset.x,
        y: pivotSelection.anchor.y + pivotSelection.offset.y,
      } };
    },
    clearPivotSelection() { pivotSelection = null; },
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
