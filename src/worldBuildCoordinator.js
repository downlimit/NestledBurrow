import { FARMING_INTERACTION_KINDS, FARMING_WELL_TEXTURE_KEY, WELL_PROFILE } from "./farmingConfig.js";
import { assetDepthFromPivot } from "./buildWorldGeometry.js";
import { TILE_SIZE } from "./worldConfig.js";

export function createWorldBuildCoordinator(scene, {
  farmState,
  worldLayout,
  hasFarmCell = () => false,
} = {}) {
  const wellVisuals = new Map();
  let nextWellId = maximumWellId(farmState.wells);
  let destroyed = false;

  function normalizedPoint(point) {
    return {
      x: Math.round(Number(point.x) / TILE_SIZE) * TILE_SIZE,
      y: Math.round(Number(point.y) / TILE_SIZE) * TILE_SIZE,
    };
  }

  function collisionAt(point) {
    return {
      left: point.x + WELL_PROFILE.collisionRect.left,
      top: point.y + WELL_PROFILE.collisionRect.top,
      right: point.x + WELL_PROFILE.collisionRect.right,
      bottom: point.y + WELL_PROFILE.collisionRect.bottom,
    };
  }

  function boundsAt(point) {
    return { left: point.x, top: point.y, right: point.x + TILE_SIZE, bottom: point.y + TILE_SIZE };
  }

  function isWellPlacementBlocked(point, ignoreId = null) {
    const next = normalizedPoint(point);
    if (!worldLayout.isFarmableTile(next) || hasFarmCell(next)) return true;
    const blocking = worldLayout.getBlockingColliders(collisionAt(next))
      .filter((entry) => entry.id !== ignoreId);
    return blocking.length > 0;
  }

  function createWellVisual(well) {
    const point = { x: well.x, y: well.y };
    const visual = scene.add.image(point.x, point.y, FARMING_WELL_TEXTURE_KEY)
      .setOrigin(0)
      .setDepth(assetDepthFromPivot(point, WELL_PROFILE.depthAnchorOffset, 500, well.id));
    wellVisuals.set(well.id, visual);
    worldLayout.setWorldObjectCollider(well.id, collisionAt(point), "farming:well", {
      depthAnchor: { x: point.x + WELL_PROFILE.depthAnchorOffset.x, y: point.y + WELL_PROFILE.depthAnchorOffset.y },
    });
    return visual;
  }

  function placeWell(point, forcedId = null) {
    const next = normalizedPoint(point);
    if (isWellPlacementBlocked(next)) return null;
    const id = forcedId ?? `farm-well-${++nextWellId}`;
    const well = { id, x: next.x, y: next.y };
    farmState.wells.push(well);
    createWellVisual(well);
    nextWellId = Math.max(nextWellId, maximumWellId([well]));
    return well;
  }

  function removeWell(id) {
    const index = farmState.wells.findIndex((well) => well.id === id);
    if (index < 0) return null;
    const [well] = farmState.wells.splice(index, 1);
    wellVisuals.get(id)?.destroy();
    wellVisuals.delete(id);
    worldLayout.clearWorldObjectCollider(id);
    return well;
  }

  function restoreWell(well) {
    return placeWell({ x: well.x, y: well.y }, well.id);
  }

  function getWellAt(point) {
    return [...farmState.wells].reverse().find((well) => contains(boundsAt(well), point)) ?? null;
  }

  for (const well of farmState.wells) createWellVisual(well);

  return {
    handles(item) { return item?.placement === "well"; },
    place(item, point) {
      if (item?.placement !== "well") return null;
      const well = placeWell(point);
      return well ? { status: "placed", id: well.id, definition: well } : { status: "blocked" };
    },
    isPlacementBlocked(item, point) {
      return item?.placement === "well" ? isWellPlacementBlocked(point) : null;
    },
    getMoveTargetAt(point) {
      const well = getWellAt(point);
      const visual = well ? wellVisuals.get(well.id) : null;
      return well && visual ? {
        kind: "well",
        definition: { ...well },
        profileKey: "farming:well",
        targets: [visual],
        bounds: boundsAt(well),
        placementPosition: { x: well.x, y: well.y },
        snapAnchorOffset: { ...WELL_PROFILE.depthAnchorOffset },
      } : null;
    },
    move(target, point) {
      if (target?.kind !== "well") return null;
      const previous = removeWell(target.definition.id);
      if (!previous) return null;
      const current = placeWell(point, previous.id);
      if (current) return { previous, current };
      restoreWell(previous);
      return null;
    },
    removeAt(point) {
      const well = getWellAt(point);
      return well ? removeWell(well.id) : null;
    },
    restore: restoreWell,
    getDemolitionTargetAt(point) {
      const well = getWellAt(point);
      const visual = well ? wellVisuals.get(well.id) : null;
      return well && visual ? {
        kind: "well",
        definition: { ...well },
        profileKey: "farming:well",
        targets: [visual],
        bounds: boundsAt(well),
        placementPosition: { x: well.x, y: well.y },
        snapAnchorOffset: { ...WELL_PROFILE.depthAnchorOffset },
      } : null;
    },
    getInteractionDefinitions(selectedItem) {
      if (selectedItem?.id !== "watering-can") return [];
      return farmState.wells.map((well) => ({
        id: `refill-${well.id}`,
        entityId: well.id,
        kind: FARMING_INTERACTION_KINDS.refill,
        position: { x: well.x + TILE_SIZE / 2, y: well.y + TILE_SIZE / 2 },
        radius: 28,
        priority: 24,
        requiresFacing: false,
        facingDotThreshold: -1,
        prompt: "hud:interaction.refillWateringCan",
        payload: { wellId: well.id },
      }));
    },
    getWellState: () => farmState.wells.map((well) => ({ ...well })),
    getVisualState(id) {
      const visual = wellVisuals.get(id);
      return visual ? { x: visual.x, y: visual.y, depth: visual.depth } : null;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const [id, visual] of wellVisuals) {
        visual.destroy();
        worldLayout.clearWorldObjectCollider(id);
      }
      wellVisuals.clear();
    },
  };
}

function maximumWellId(wells) {
  return wells.reduce((maximum, well) => {
    const match = /^farm-well-(\d+)$/.exec(String(well.id));
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
}

function contains(bounds, point) {
  return Number(point.x) >= bounds.left && Number(point.x) < bounds.right
    && Number(point.y) >= bounds.top && Number(point.y) < bounds.bottom;
}
