import {
  createFacilityDefinition,
  FACILITIES,
  PLATED_DISH_ASSET,
} from "./facilityConfig.js";
import { TILE_SIZE } from "./worldConfig.js";
import { getKitchenFacilityPrompt } from "./cookingDomain.js";
import { clearCurrentWorldScene, setCurrentWorldScene } from "./worldSceneRegistry.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";

export function createFacilityRuntime(scene, { worldLayout, getKitchenState = () => null, getInventoryState = () => null, isServingDishReserved = () => false }) {
  setCurrentWorldScene(scene);
  const definitions = new Map(FACILITIES.map((facility) => [facility.id, facility]));
  const visuals = new Map();
  let activeFacilityId = null;
  let destroyed = false;
  let editorId = 0;
  let platedDishVisual = null;

  function trackEditorId(id) {
    const match = /^editor-.+-(\d+)$/.exec(id);
    if (match) editorId = Math.max(editorId, Number(match[1]));
  }

  function createVisual(facility, { validateFootprint = true } = {}) {
    const profileKey = `facility:${facility.facilityType}`;
    const baseCollider = boundsFor(facility);
    const effectiveCollider = worldLayout.getEffectiveCollider(baseCollider, profileKey);
    if ((validateFootprint && worldLayout.isBlockedBox(effectiveCollider))
      || worldLayout.isBlockedBox({
        left: facility.usePosition.x - 2,
        right: facility.usePosition.x + 2,
        top: facility.usePosition.y - 2,
        bottom: facility.usePosition.y + 2,
      })) return false;
    worldLayout.setWorldObjectCollider(facility.id, baseCollider, profileKey);
    const offset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? { x: facility.visual.width / 2, y: facility.visual.height };
    const image = scene.add.image(facility.visual.x + offset.x, facility.visual.y + offset.y, facility.visual.key)
      .setOrigin(0, 0)
      .setDepth(assetDepthFromPivot(facility.visual, pivotOffset, 500, facility.id));
    visuals.set(facility.id, image);
    return true;
  }

  function add(facilityType, point) {
    const tile = {
      x: Math.floor(point.x / TILE_SIZE),
      y: Math.floor(point.y / TILE_SIZE),
    };
    const definition = placeFacilityAt(createFacilityDefinition({
      id: `editor-${facilityType}-${++editorId}`,
      type: facilityType,
      tile,
      useTile: { x: tile.x + 2, y: tile.y + 1 },
      editable: true,
    }), point);
    if (!createVisual(definition)) return null;
    definitions.set(definition.id, definition);
    return definition;
  }

  function remove(id) {
    const definition = definitions.get(id);
    if (!definition || definition.editable === false) return false;
    if (activeFacilityId === id) activeFacilityId = null;
    visuals.get(id)?.destroy();
    visuals.delete(id);
    definitions.delete(id);
    worldLayout.clearWorldObjectCollider(id);
    return true;
  }

  function getDefinitionAt(point) {
    return [...definitions.values()]
      .reverse()
      .find((candidate) => contains(boundsFor(candidate), point)) ?? null;
  }

  function removeAt(point) {
    const definition = getDefinitionAt(point);
    return definition ? remove(definition.id) : false;
  }

  function restore(definition) {
    if (!definition || definitions.has(definition.id) || !createVisual(definition)) return false;
    definitions.set(definition.id, definition);
    trackEditorId(definition.id);
    return true;
  }

  function replace(definition) {
    if (!definition) return false;
    const previous = definitions.get(definition.id);
    if (previous) {
      if (activeFacilityId === previous.id) activeFacilityId = null;
      visuals.get(previous.id)?.destroy();
      visuals.delete(previous.id);
      definitions.delete(previous.id);
      worldLayout.clearWorldObjectCollider(previous.id);
    }
    if (restore(definition)) {
      syncKitchenVisuals();
      return true;
    }
    if (previous) {
      restore(previous);
      syncKitchenVisuals();
    }
    return false;
  }

  function move(id, point) {
    const previous = definitions.get(id);
    if (!previous) return null;
    const current = placeFacilityAt(previous, point);
    return replace(current) ? { previous, current } : null;
  }

  function getDemolitionTargetAt(point) {
    const definition = getDefinitionAt(point);
    if (!definition || definition.editable === false) return null;
    const visual = visuals.get(definition.id);
    return visual
      ? {
          targets: [visual],
          bounds: boundsFor(definition),
          kind: "facility",
          facilityType: definition.facilityType,
        }
      : null;
  }

  function getMoveTargetAt(point) {
    const definition = getDefinitionAt(point);
    const visual = definition ? visuals.get(definition.id) : null;
    return visual
      ? {
          targets: [visual],
          bounds: boundsFor(definition),
          kind: "facility",
          facilityType: definition.facilityType,
        }
      : null;
  }

  for (const facility of definitions.values()) {
    trackEditorId(facility.id);
    if (!createVisual(facility, { validateFootprint: false })) {
      throw new Error(`Facility ${facility.id} use position must remain walkable`);
    }
  }
  const servingTable = [...definitions.values()].find((facility) => facility.facilityType === "serving-table");
  if (servingTable) {
    const offset = scene.assetProfiles?.["facility:serving-table"]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.["facility:serving-table"]?.snapAnchorOffset ?? { x: servingTable.visual.width / 2, y: servingTable.visual.height };
    platedDishVisual = scene.add.image(
      servingTable.footprint.x + servingTable.footprint.width / 2 + offset.x,
      servingTable.footprint.y + 5 + offset.y,
      PLATED_DISH_ASSET.key,
    ).setOrigin(0.5, 0.5).setDepth(assetDepthFromPivot(servingTable.visual, pivotOffset, 501, `${servingTable.id}:dish`)).setVisible(false);
  }

  function syncKitchenVisuals() {
    const currentServingTable = [...definitions.values()].find((facility) => facility.facilityType === "serving-table");
    const offset = scene.assetProfiles?.["facility:serving-table"]?.visualOffset ?? { x: 0, y: 0 };
    const pivotOffset = scene.assetProfiles?.["facility:serving-table"]?.snapAnchorOffset
      ?? (currentServingTable ? { x: currentServingTable.visual.width / 2, y: currentServingTable.visual.height } : { x: 0, y: 0 });
    if (currentServingTable) platedDishVisual
      ?.setPosition?.(currentServingTable.footprint.x + currentServingTable.footprint.width / 2 + offset.x, currentServingTable.footprint.y + 5 + offset.y)
      ?.setDepth?.(assetDepthFromPivot(currentServingTable.visual, pivotOffset, 501, `${currentServingTable.id}:dish`));
    platedDishVisual?.setVisible?.(Boolean(getKitchenState()?.servingTableHasDish) && !isServingDishReserved());
  }
  syncKitchenVisuals();

  return {
    getInteractionDefinitions() {
      if (destroyed) return [];
      if (!activeFacilityId) {
        const kitchen = getKitchenState();
        return [...definitions.values()].map((facility) => {
          const prompt = kitchen ? getKitchenFacilityPrompt(facility.facilityType, kitchen, getInventoryState()) : null;
          return prompt ? { ...facility, prompt } : facility;
        });
      }
      const facility = definitions.get(activeFacilityId);
      return facility ? [{ ...facility, prompt: facility.stopPrompt }] : [];
    },
    getDefinition(id) {
      return definitions.get(id) ?? null;
    },
    getDefinitionByType(facilityType) {
      return [...definitions.values()].find((facility) => facility.facilityType === facilityType) ?? null;
    },
    getDefinitions() {
      return [...definitions.values()];
    },
    getAuthoringInstances() {
      return [...definitions.values()].flatMap((facility) => {
        const visual = visuals.get(facility.id);
        return visual ? [{
          id: facility.id,
          profileKey: `facility:${facility.facilityType}`,
          anchor: { x: facility.visual.x, y: facility.visual.y },
          bounds: boundsFor(facility),
          targets: [visual],
        }] : [];
      });
    },
    applyAuthoringVisualOffset(profileKey, offset) {
      for (const facility of definitions.values()) {
        if (`facility:${facility.facilityType}` !== profileKey) continue;
        visuals.get(facility.id)?.setPosition?.(facility.visual.x + offset.x, facility.visual.y + offset.y);
        if (facility.facilityType === "serving-table") platedDishVisual?.setPosition?.(
          facility.footprint.x + facility.footprint.width / 2 + offset.x,
          facility.footprint.y + 5 + offset.y,
        );
      }
    },
    syncKitchenVisuals,
    add,
    remove,
    removeAt,
    restore,
    replace,
    move,
    getDefinitionAt,
    getDemolitionTargetAt,
    getMoveTargetAt,
    toggle(facilityId, playerMotor) {
      const facility = definitions.get(facilityId);
      if (!facility || destroyed) return { status: "unknown-facility", mutated: false };
      if (["cutting-table", "gas-stove", "serving-table"].includes(facility.facilityType)) {
        return { status: "handled-by-cooking", mutated: false };
      }
      if (activeFacilityId === facilityId) {
        activeFacilityId = null;
        return { status: "stopped", mutated: false };
      }
      if (activeFacilityId) return { status: "busy", mutated: false };
      activeFacilityId = facilityId;
      playerMotor.movement.velocity.x = 0;
      playerMotor.movement.velocity.y = 0;
      return { status: "started", mutated: false, facilityType: facility.facilityType };
    },
    stop() {
      const stopped = activeFacilityId;
      activeFacilityId = null;
      return stopped;
    },
    getActiveType() {
      return activeFacilityId
        ? definitions.get(activeFacilityId)?.facilityType ?? null
        : null;
    },
    getActiveId() {
      return activeFacilityId;
    },
    getPresentationPose() {
      if (!activeFacilityId) return null;
      const facility = definitions.get(activeFacilityId);
      if (!facility?.presentationPose) return null;
      const profileKey = `facility:${facility.facilityType}`;
      const pivotOffset = scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? { x: facility.visual.width / 2, y: facility.visual.height };
      return { ...facility.presentationPose, depth: assetDepthFromPivot(facility.visual, pivotOffset, 501, `${facility.id}:pose`) };
    },
    isUsing() {
      return activeFacilityId !== null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearCurrentWorldScene(scene);
      activeFacilityId = null;
      for (const [id, image] of visuals) {
        image.destroy();
        worldLayout.clearWorldObjectCollider(id);
      }
      visuals.clear();
      platedDishVisual?.destroy?.();
      platedDishVisual = null;
      definitions.clear();
    },
  };
}

function boundsFor(facility) {
  return {
    left: facility.footprint.x,
    right: facility.footprint.x + facility.footprint.width,
    top: facility.footprint.y,
    bottom: facility.footprint.y + facility.footprint.height,
  };
}

function placeFacilityAt(facility, point) {
  const dx = Number(point.x) - facility.footprint.x;
  const dy = Number(point.y) - facility.footprint.y;
  if (dx === 0 && dy === 0) return facility;
  const moved = {
    ...facility,
    position: Object.freeze({ x: facility.position.x + dx, y: facility.position.y + dy }),
    usePosition: Object.freeze({ x: facility.usePosition.x + dx, y: facility.usePosition.y + dy }),
    footprint: Object.freeze({ ...facility.footprint, x: facility.footprint.x + dx, y: facility.footprint.y + dy }),
    visual: Object.freeze({ ...facility.visual, x: facility.visual.x + dx, y: facility.visual.y + dy }),
  };
  if (facility.presentationPose) {
    moved.presentationPose = Object.freeze({
      ...facility.presentationPose,
      x: facility.presentationPose.x + dx,
      y: facility.presentationPose.y + dy,
      depth: facility.presentationPose.depth + dy,
    });
  }
  return Object.freeze(moved);
}

function contains(bounds, point) {
  return point.x >= bounds.left
    && point.x < bounds.right
    && point.y >= bounds.top
    && point.y < bounds.bottom;
}
