import { drawBed } from "../resources/debrisRuntime.js";
import { createResourceDefinition, PLACEMENT_CELL_SIZE } from "../resources/resourceConfig.js";
import { getResourceProfile } from "../resources/resourceDomain.js";
import { drawResourceVisual } from "../resources/resourceVisuals.js";
import { WELL_PROFILE } from "../resources/farmingConfig.js";
import { FACILITY_ASSETS } from "../facilities/facilityConfig.js";
import { drawFacility } from "../facilities/facilityPreviewVisuals.js";
import { TILE_SIZE } from "../world/worldConfig.js";
import { PLACEABLE_BUILD_OWNER_IDS } from "./placeableBuildProtocol.js";
import {
  contains,
  defaultResourceAnchor,
  effectiveCollider,
  isBlocked,
  midpointAnchor,
  registeredCollider,
  resourceColliderAt,
  resourceVisualBoundsAt,
  shiftRect,
  unionRect,
} from "./placeableBuildGeometry.js";

export function createDefaultPlaceableBuildOwners(scene, owners, coordinator) {
  return [
    createWellAdapter(scene, coordinator),
    createFacilityAdapter(scene, owners.facilityRuntime),
    createBedAdapter(scene, owners.debrisRuntime),
    createResourceAdapter(scene, owners.debrisRuntime),
  ].filter(Boolean);
}

function createBedAdapter(scene, runtime) {
  if (!runtime?.getBedDefinitions || !runtime?.getBedBounds) return null;
  const profileKey = "furniture:bed";

  function targetFor(definition) {
    const footprint = runtime.getBedBounds(definition.id);
    if (!footprint) return null;
    const profile = scene.assetProfiles?.[profileKey] ?? {};
    const visualBounds = shiftRect(footprint, profile.visualOffset);
    const collider = runtime.getBedRuntimeGeometry?.(definition.id)?.collider
      ?? registeredCollider(scene, definition.id, footprint, profileKey);
    const instance = runtime.getAuthoringInstances?.().find(({ id }) => id === definition.id);
    const targets = instance?.targets ?? [];
    if (!targets.length) return null;
    return {
      id: definition.id,
      kind: "bed",
      demolitionType: "bed",
      definition,
      profileKey,
      placementPosition: { x: footprint.left, y: footprint.top },
      snapAnchorOffset: profile.snapAnchorOffset ?? { x: TILE_SIZE / 2, y: TILE_SIZE / 2 },
      bounds: unionRect(visualBounds, collider),
      targets,
    };
  }

  return {
    id: PLACEABLE_BUILD_OWNER_IDS.bed,
    matchesItem: (item) => item?.placement === "bed",
    getTargetAt(point) {
      return [...runtime.getBedDefinitions()].reverse()
        .map(targetFor)
        .find((target) => target && contains(target.bounds, point)) ?? null;
    },
    getPlacementAnchorOffset: () => midpointAnchor(scene, profileKey, {
      left: 0, right: TILE_SIZE, top: 0, bottom: TILE_SIZE,
    }),
    isPlacementBlocked(_item, point, ignoreId = null) {
      const base = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
      return isBlocked(scene, effectiveCollider(scene, base, profileKey), ignoreId);
    },
    place(_item, point) {
      const definition = runtime.addBed(point);
      return definition ? { id: definition.id, definition } : null;
    },
    move(target, point) { return runtime.moveBed(target.id ?? target.definition?.id, point); },
    remove(target) {
      const definition = target.definition ?? runtime.getBedDefinitions().find(({ id }) => id === target.id);
      return definition && runtime.removeBed(definition.id) ? definition : null;
    },
    restore(definition) {
      return runtime.replaceBed?.(definition) ?? runtime.restoreBed(definition);
    },
    renderPreview(_item, point, { blocked = false, demolition = false } = {}) {
      const offset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
      const graphics = scene.add.graphics()
        .setPosition(point.x + offset.x, point.y + offset.y)
        .setDepth(8988)
        .setAlpha(demolition ? 0.68 : 0.58);
      drawBed(graphics, blocked ? 0xff5b66 : 0x7dff9a);
      return graphics;
    },
    afterMutation: () => scene.interactionRuntime?.refresh?.(),
  };
}

function createFacilityAdapter(scene, runtime) {
  if (!runtime?.getDefinitions || !runtime?.getDefinition) return null;

  function targetFor(definition) {
    if (definition?.editable === false) return null;
    const profileKey = `facility:${definition.facilityType}`;
    const geometry = runtime.getFacilityRuntimeGeometry?.(definition.id);
    const footprint = geometry?.footprint ?? {
      left: definition.footprint.x,
      right: definition.footprint.x + definition.footprint.width,
      top: definition.footprint.y,
      bottom: definition.footprint.y + definition.footprint.height,
    };
    const visualBounds = geometry ? {
      left: geometry.visualOrigin.x,
      right: geometry.visualOrigin.x + geometry.visualSize.width,
      top: geometry.visualOrigin.y,
      bottom: geometry.visualOrigin.y + geometry.visualSize.height,
    } : footprint;
    const collider = geometry?.collider ?? registeredCollider(scene, definition.id, footprint, profileKey);
    const instance = runtime.getAuthoringInstances?.().find(({ id }) => id === definition.id);
    const targets = instance?.targets ?? [];
    if (!targets.length) return null;
    return {
      id: definition.id,
      kind: "facility",
      demolitionType: "facility",
      facilityType: definition.facilityType,
      definition,
      profileKey,
      placementPosition: { x: definition.footprint.x, y: definition.footprint.y },
      snapAnchorOffset: scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? { x: 0, y: 0 },
      bounds: unionRect(visualBounds, collider),
      targets,
    };
  }

  return {
    id: PLACEABLE_BUILD_OWNER_IDS.facility,
    matchesItem: (item) => item?.placement === "facility",
    getTargetAt(point) {
      return [...runtime.getDefinitions()].reverse()
        .map(targetFor)
        .find((target) => target && contains(target.bounds, point)) ?? null;
    },
    getPlacementAnchorOffset(item) {
      const asset = FACILITY_ASSETS[item.facilityType];
      if (!asset) return { x: 0, y: 0 };
      return midpointAnchor(scene, `facility:${item.facilityType}`, {
        left: 0, right: asset.width, top: 0, bottom: asset.height,
      });
    },
    isPlacementBlocked(item, point, ignoreId = null) {
      const facilityType = item.facilityType ?? item.definition?.facilityType;
      const asset = FACILITY_ASSETS[facilityType];
      if (!asset) return true;
      const profileKey = `facility:${facilityType}`;
      const base = { left: point.x, right: point.x + asset.width, top: point.y, bottom: point.y + asset.height };
      return isBlocked(scene, effectiveCollider(scene, base, profileKey), ignoreId);
    },
    place(item, point) {
      const definition = runtime.add(item.facilityType, point);
      return definition ? { id: definition.id, definition } : null;
    },
    move(target, point) { return runtime.move(target.id ?? target.definition?.id, point); },
    remove(target) {
      const definition = target.definition ?? runtime.getDefinition(target.id);
      return definition && runtime.remove(definition.id) ? definition : null;
    },
    restore(definition) { return runtime.replace?.(definition) ?? runtime.restore(definition); },
    renderPreview(item, point, { blocked = false, demolition = false } = {}) {
      const facilityType = item.facilityType ?? item.definition?.facilityType;
      const profileKey = `facility:${facilityType}`;
      const offset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
      const graphics = scene.add.graphics()
        .setPosition(point.x + offset.x, point.y + offset.y)
        .setDepth(8988)
        .setAlpha(demolition ? 0.68 : 0.58);
      drawFacility(graphics, facilityType, blocked ? 0xff5b66 : 0x7dff9a);
      return graphics;
    },
    afterMutation() {
      runtime.syncKitchenVisuals?.();
      scene.interactionRuntime?.refresh?.();
    },
  };
}

function createResourceAdapter(scene, runtime) {
  if (!runtime?.getResourceDefinitions || !runtime?.registerResource || !runtime?.unregisterResource) return null;
  let nextId = maximumEditorResourceId(runtime.getResourceDefinitions());

  function pointFor(definition) {
    return {
      x: definition.cell.x * PLACEMENT_CELL_SIZE,
      y: definition.cell.y * PLACEMENT_CELL_SIZE,
    };
  }

  function targetFor(definition) {
    if (!runtime.isPresent?.(definition.id)) return null;
    const point = pointFor(definition);
    const profileKey = `resource:${definition.profileId}`;
    const profile = getResourceProfile(definition.profileId);
    const visualBounds = shiftRect(resourceVisualBoundsAt(point, profile), scene.assetProfiles?.[profileKey]?.visualOffset);
    const collider = registeredCollider(scene, definition.id, resourceColliderAt(point, profile), profileKey);
    const instance = runtime.getAuthoringInstances?.().find(({ id }) => id === definition.id);
    const visual = runtime.getResourceVisual?.(definition.id);
    const targets = instance?.targets ?? (visual ? [visual] : []);
    if (!targets.length) return null;
    return {
      id: definition.id,
      kind: "resource",
      demolitionType: "resource",
      definition,
      profileKey,
      resourceProfileId: definition.profileId,
      placementPosition: point,
      snapAnchorOffset: scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? defaultResourceAnchor(profile),
      bounds: unionRect(visualBounds, collider),
      targets,
    };
  }

  function definitionAt(profileId, point, base = null, forcedId = null) {
    const sibling = runtime.getResourceDefinitions()[0];
    const worldId = base?.worldId ?? sibling?.worldId ?? scene.worldLocationRuntime?.activeDefinition?.id ?? "village";
    const roomId = base?.roomId ?? sibling?.roomId ?? worldId;
    return createResourceDefinition({
      id: forcedId ?? `editor-resource-${++nextId}`,
      profileId,
      cell: {
        x: Math.round(point.x / PLACEMENT_CELL_SIZE),
        y: Math.round(point.y / PLACEMENT_CELL_SIZE),
      },
      worldId,
      roomId,
      radius: base?.radius,
      priority: base?.priority,
      requiresFacing: base?.requiresFacing,
      facingDotThreshold: base?.facingDotThreshold,
      targetingMode: base?.targetingMode,
      targetingGroup: base?.targetingGroup,
    });
  }

  function snapshot(definition) {
    const state = scene.sessionState?.gameplay?.resourceNodes?.[definition.id];
    return { definition, state: state ? { ...state } : null };
  }

  const adapter = {
    id: PLACEABLE_BUILD_OWNER_IDS.resource,
    matchesItem: (item) => Boolean(item?.resourceProfileId),
    getTargetAt(point) {
      return [...runtime.getResourceDefinitions()].reverse()
        .map(targetFor)
        .find((target) => target && contains(target.bounds, point)) ?? null;
    },
    getPlacementAnchorOffset(item) {
      const profile = getResourceProfile(item.resourceProfileId);
      const profileKey = `resource:${profile.id}`;
      return midpointAnchor(scene, profileKey, resourceColliderAt({ x: 0, y: 0 }, profile), defaultResourceAnchor(profile));
    },
    isPlacementBlocked(item, point, ignoreId = null) {
      const profileId = item.resourceProfileId ?? item.definition?.profileId;
      if (!profileId) return true;
      const profileKey = `resource:${profileId}`;
      const collider = effectiveCollider(scene, resourceColliderAt(point, getResourceProfile(profileId)), profileKey);
      return isBlocked(scene, collider, ignoreId);
    },
    place(item, point) {
      if (adapter.isPlacementBlocked(item, point, null)) return null;
      const definition = definitionAt(item.resourceProfileId, point);
      runtime.registerResource(definition);
      return { id: definition.id, definition };
    },
    move(target, point) {
      const previous = target.definition ?? runtime.getResourceDefinition(target.id);
      if (!previous || adapter.isPlacementBlocked(target, point, previous.id)) return null;
      const previousSnapshot = snapshot(previous);
      runtime.unregisterResource(previous.id, { removeState: false });
      const current = definitionAt(previous.profileId, point, previous, previous.id);
      runtime.registerResource(current);
      return { previous: previousSnapshot, current: snapshot(current) };
    },
    remove(target) {
      const definition = target.definition ?? runtime.getResourceDefinition(target.id);
      if (!definition) return null;
      const removed = snapshot(definition);
      runtime.unregisterResource(definition.id, { removeState: true });
      return removed;
    },
    restore(value) {
      const restored = value?.definition ?? value;
      if (!restored?.id) return false;
      runtime.unregisterResource(restored.id, { removeState: true });
      if (value?.state && scene.sessionState?.gameplay?.resourceNodes) {
        scene.sessionState.gameplay.resourceNodes[restored.id] = { ...value.state };
      }
      runtime.registerResource(restored);
      return true;
    },
    renderPreview(item, point, { blocked = false, demolition = false } = {}) {
      const profileId = item.resourceProfileId ?? item.definition?.profileId;
      const profile = getResourceProfile(profileId);
      const profileKey = `resource:${profileId}`;
      const offset = scene.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
      const graphics = scene.add.graphics()
        .setPosition(point.x + offset.x, point.y + offset.y)
        .setDepth(8988)
        .setAlpha(demolition ? 0.68 : 0.58);
      drawResourceVisual(graphics, profile, 0, { colorOverride: blocked ? 0xff5b66 : 0x7dff9a });
      return graphics;
    },
    afterMutation: () => scene.interactionRuntime?.refresh?.(),
  };
  return adapter;
}

function createWellAdapter(scene, coordinator) {
  const runtime = coordinator.wellOwner;
  if (!runtime?.getMoveTargetAt || !runtime?.place) return null;
  return {
    id: PLACEABLE_BUILD_OWNER_IDS.well,
    matchesItem: (item) => item?.placement === "well",
    getTargetAt: (point) => runtime.getMoveTargetAt(point),
    getPlacementAnchorOffset: () => ({ ...WELL_PROFILE.depthAnchorOffset }),
    isPlacementBlocked(item, point, ignoreId = null) {
      return runtime.isPlacementBlocked(item?.placement ? item : { placement: "well" }, point, ignoreId);
    },
    place(item, point) {
      const result = runtime.place(item, point);
      return result?.status === "placed" ? { id: result.id, definition: result.definition } : null;
    },
    move: (target, point) => runtime.move(target, point),
    remove(target) { return runtime.removeAt(target.definition ?? target); },
    restore(definition) {
      const current = runtime.getWellState?.().find(({ id }) => id === definition?.id);
      if (current) runtime.removeAt(current);
      return runtime.restore(definition);
    },
    afterMutation() {
      scene.interactionRuntime?.refresh?.();
      coordinator.persistGameplay?.();
    },
  };
}

function maximumEditorResourceId(definitions) {
  return definitions.reduce((maximum, definition) => {
    const match = /^editor-resource-(\d+)$/.exec(String(definition.id));
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
}
