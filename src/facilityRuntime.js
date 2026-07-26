import {
  createFacilityDefinition,
  FACILITIES,
  PLATED_DISH_ASSET,
} from "./facilityConfig.js";
import { TILE_SIZE } from "./worldConfig.js";
import { getKitchenFacilityPrompt } from "./cookingDomain.js";

export function createFacilityRuntime(scene, { worldLayout, getKitchenState = () => null, isServingDishReserved = () => false }) {
  const definitions = new Map(FACILITIES.map((facility) => [facility.id, facility]));
  const visuals = new Map();
  let activeFacilityId = null;
  let destroyed = false;
  let editorId = 0;
  let platedDishVisual = null;

  function createVisual(facility, { validateFootprint = true } = {}) {
    if ((validateFootprint && worldLayout.isBlockedBox(boundsFor(facility)))
      || worldLayout.isBlockedBox({
        left: facility.usePosition.x - 2,
        right: facility.usePosition.x + 2,
        top: facility.usePosition.y - 2,
        bottom: facility.usePosition.y + 2,
      })) return false;
    worldLayout.setWorldObjectCollider(facility.id, boundsFor(facility), `facility:${facility.facilityType}`);
    const image = scene.add.image(facility.visual.x, facility.visual.y, facility.visual.key)
      .setOrigin(0, 0)
      .setDepth(500 + facility.visual.y + facility.visual.height);
    visuals.set(facility.id, image);
    return true;
  }

  function add(facilityType, point) {
    const tile = {
      x: Math.floor(point.x / TILE_SIZE),
      y: Math.floor(point.y / TILE_SIZE),
    };
    const definition = createFacilityDefinition({
      id: `editor-${facilityType}-${++editorId}`,
      type: facilityType,
      tile,
      useTile: { x: tile.x + 2, y: tile.y + 1 },
      editable: true,
    });
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
    const oldTile = { x: previous.footprint.x / TILE_SIZE, y: previous.footprint.y / TILE_SIZE };
    const oldUseTile = {
      x: Math.floor(previous.usePosition.x / TILE_SIZE),
      y: Math.floor(previous.usePosition.y / TILE_SIZE),
    };
    const tile = { x: Math.floor(point.x / TILE_SIZE), y: Math.floor(point.y / TILE_SIZE) };
    const current = createFacilityDefinition({
      id: previous.id,
      type: previous.facilityType,
      tile,
      useTile: { x: tile.x + oldUseTile.x - oldTile.x, y: tile.y + oldUseTile.y - oldTile.y },
      editable: previous.editable,
    });
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
    if (!createVisual(facility, { validateFootprint: false })) {
      throw new Error(`Facility ${facility.id} use position must remain walkable`);
    }
  }
  const servingTable = [...definitions.values()].find((facility) => facility.facilityType === "serving-table");
  if (servingTable) {
    platedDishVisual = scene.add.image(
      servingTable.footprint.x + servingTable.footprint.width / 2,
      servingTable.footprint.y + 5,
      PLATED_DISH_ASSET.key,
    ).setOrigin(0.5, 0.5).setDepth(501 + servingTable.visual.y + servingTable.visual.height).setVisible(false);
  }

  function syncKitchenVisuals() {
    const currentServingTable = [...definitions.values()].find((facility) => facility.facilityType === "serving-table");
    if (currentServingTable) platedDishVisual
      ?.setPosition?.(currentServingTable.footprint.x + currentServingTable.footprint.width / 2, currentServingTable.footprint.y + 5)
      ?.setDepth?.(501 + currentServingTable.visual.y + currentServingTable.visual.height);
    platedDishVisual?.setVisible?.(Boolean(getKitchenState()?.servingTableHasDish) && !isServingDishReserved());
  }
  syncKitchenVisuals();

  return {
    getInteractionDefinitions() {
      if (destroyed) return [];
      if (!activeFacilityId) {
        const kitchen = getKitchenState();
        return [...definitions.values()].map((facility) => {
          const prompt = kitchen ? getKitchenFacilityPrompt(facility.facilityType, kitchen) : null;
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
      return activeFacilityId
        ? definitions.get(activeFacilityId)?.presentationPose ?? null
        : null;
    },
    isUsing() {
      return activeFacilityId !== null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
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

function contains(bounds, point) {
  return point.x >= bounds.left
    && point.x < bounds.right
    && point.y >= bounds.top
    && point.y < bounds.bottom;
}
