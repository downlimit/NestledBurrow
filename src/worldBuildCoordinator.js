import { createBuildModeRuntime } from "./buildModeRuntime.js";
import {
  BUILD_CARPET_FRAME_BY_MASK,
  BUILD_SURFACE_CUSTOM_MASKS,
  BUILD_SURFACE_FRAME_BY_MASK,
  getBuildWallColumnDepthOffset,
  getBuildWallColumnOffset,
  getBuildVerticalWallFrame,
  getBuildVerticalWallOffset,
  getBuildWallFrames,
} from "./buildAssetCatalog.js";
import {
  WALL_COLLIDER_GROUPS,
  assetDepthFromPivot,
  hasIncidentWall,
  isWallPlacementBlocked,
  placementMidpointOffset,
  wallColliderGroup,
  worldDepthFromAnchorY,
} from "./buildWorldGeometry.js";
import { drawBed } from "./debrisRuntime.js";
import { FACILITY_ASSETS } from "./facilityConfig.js";
import { drawFacility } from "./facilityPreviewVisuals.js";
import { FARMING_INTERACTION_KINDS, FARMING_WELL_TEXTURE_KEY, WELL_PROFILE } from "./farmingConfig.js";
import { TAVERN_SIGN_BUILD_KIND } from "./guestConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { drawResourceVisual } from "./resourceVisuals.js";
import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
} from "./worldConfig.js";

export function createWellPresentation(scene, point, {
  depth = 0,
  tint = null,
  alpha = 1,
} = {}) {
  const visual = scene.add.image(point.x, point.y, FARMING_WELL_TEXTURE_KEY)
    .setOrigin(0)
    .setDepth(depth)
    .setAlpha(alpha);
  if (tint !== null) visual.setTint(tint);
  return visual;
}

function createWellOwner(scene, {
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
    const visual = createWellPresentation(scene, point, {
      depth: assetDepthFromPivot(point, WELL_PROFILE.depthAnchorOffset, 500, well.id),
    });
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

  function editableWellAt(point) {
    const well = getWellAt(point);
    return well?.fixed ? null : well;
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
      const well = editableWellAt(point);
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
      const well = editableWellAt(point);
      return well ? removeWell(well.id) : null;
    },
    restore: restoreWell,
    getDemolitionTargetAt(point) {
      const well = editableWellAt(point);
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
      return farmState.wells.map((well) => ({
        id: `refill-${well.id}`,
        entityId: well.id,
        kind: FARMING_INTERACTION_KINDS.refill,
        position: { x: well.x + TILE_SIZE / 2, y: well.y + TILE_SIZE / 2 },
        radius: 28,
        priority: 24,
        requiresFacing: false,
        facingDotThreshold: -1,
        prompt: selectedItem?.id === "water-bucket"
          ? "hud:interaction.refillWaterBucket"
          : "hud:interaction.waterBucketRequired",
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

export function createWorldBuildCoordinator(dependencies) {
  return new WorldBuildCoordinator(dependencies).mount();
}

class WorldBuildCoordinator {
  constructor({
    renderingHost,
    localization,
    worldLayout,
    assetProfiles,
    farmState,
    groundSprites,
    floorSprites,
    wallSprites,
    facilityRuntime,
    debrisRuntime,
    tavernSignRuntime,
    meleeRuntime,
    hasFarmCell = () => false,
    getPlayerFootBox = () => null,
    addCanonicalTile,
    createCanonicalWallEntry,
    playEffect = () => {},
    refreshInteractions = () => {},
    persistGameplay = () => {},
    isActivationAllowed = () => true,
    getBuildGridEnabled = () => false,
    onModeChange = () => {},
  }) {
    if (!renderingHost || !worldLayout) throw new Error("WorldBuildCoordinator requires renderingHost and worldLayout");
    this.renderingHost = renderingHost;
    this.localization = localization;
    this.worldLayout = worldLayout;
    this.getAssetProfiles = assetProfiles;
    this.farmState = farmState;
    this.groundSprites = groundSprites;
    this.floorSprites = floorSprites;
    this.wallSprites = wallSprites;
    this.facilityRuntime = facilityRuntime;
    this.debrisRuntime = debrisRuntime;
    this.tavernSignRuntime = tavernSignRuntime;
    this.meleeRuntime = meleeRuntime;
    this.hasFarmCell = hasFarmCell;
    this.getPlayerFootBox = getPlayerFootBox;
    this.addTile = addCanonicalTile;
    this.createCanonicalWallEntry = createCanonicalWallEntry;
    this.playEffect = playEffect;
    this.refreshInteractions = refreshInteractions;
    this.persistGameplay = persistGameplay;
    this.isActivationAllowed = isActivationAllowed;
    this.getBuildGridEnabled = getBuildGridEnabled;
    this.onModeChange = onModeChange;
    this.buildMode = null;
    this.wellOwner = null;
    this.destroyed = false;
  }

  get assetProfiles() {
    return this.getAssetProfiles?.() ?? {};
  }

  mount() {
    this.reset();
    this.wellOwner = createWellOwner(this.renderingHost, {
      farmState: this.farmState,
      worldLayout: this.worldLayout,
      hasFarmCell: this.hasFarmCell,
    });
    this.buildMode = createBuildModeRuntime(this.renderingHost, {
      localization: this.localization,
      worldBounds: this.worldLayout.bounds,
      onPlace: (item, point, context) => this.applyBuildPlacement(item, point, context),
      onDemolish: (point, onlyType) => this.applyBuildDemolition(point, onlyType),
      onMoveStart: (point) => {
        const target = this.getBuildMoveTarget(point);
        return target ? { status: "picked", target } : { status: "ignored" };
      },
      onMove: (target, point) => this.applyBuildMove(target, point),
      onMovePreview: (target, point) => this.renderBuildMovePreview(target, point),
      onMoveHover: (point) => this.renderBuildMoveHover(point),
      onPreview: (item, points) => this.renderBuildPreview(item, points),
      onPreviewClear: () => this.clearBuildPreview(),
      onDemolitionPreview: (point) => this.renderBuildDemolitionHighlight(point),
      onActionBegin: () => this.beginBuildAction(),
      onActionEnd: () => this.endBuildAction(),
      onUndo: () => this.undoBuildAction(),
      getPlacementAnchorOffset: (item) => this.getBuildPlacementAnchorOffset(item),
      isActivationAllowed: this.isActivationAllowed,
      onModeChange: this.onModeChange,
    });
    const syncBuildGridVisibility = () => this.buildMode?.setGridEnabled?.(this.getBuildGridEnabled());
    syncBuildGridVisibility();
    globalThis.queueMicrotask?.(syncBuildGridVisibility);
    return this;
  }

  reset() {
    this.buildMode?.setActive?.(false);
    this.clearTransientVisuals();
    this.buildPlacedObjects = new Map();
    this.buildWallEdges = new Map();
    this.buildWallNodes = new Map();
    this.buildWallJunctions = new Map();
    this.buildGroundCells = new Map();
    this.buildSurfaceVisuals = new Map();
    this.buildFloorCells = new Map();
    this.buildCarpetCells = new Map();
    this.buildCarpetVisuals = new Map();
    this.buildPreviewObjects = [];
    this.buildDemolitionHighlight = null;
    this.buildUndoStack = [];
    this.activeBuildAction = null;
    this.canonicalPathCells = new Map(
      [...this.groundSprites].filter(([, entry]) => this.isPathFrame(entry.tile.frame)),
    );
    const canonicalWallPoints = this.worldLayout.wallEdges.map((edge) => ({
      x: edge.x,
      y: edge.y,
      orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
      edgeId: edge.id,
    }));
    for (const point of canonicalWallPoints) this.buildWallEdges.set(this.buildWallEdgeKey(point), point.edgeId);
    for (const point of canonicalWallPoints) this.refreshBuildWallJunctions(point);
    this.ensureBuildSurfaceTextures();
    this.nextBuildObjectId = 0;
  }

  clearTransientVisuals() {
    if (this.buildPreviewObjects) this.clearBuildPreview();
    for (const object of this.buildPlacedObjects?.values?.() ?? []) {
      for (const sprite of object.sprites ?? []) sprite.destroy?.();
      if (object.collider) this.worldLayout?.clearWorldObjectCollider?.(object.id);
    }
    for (const sprite of this.buildSurfaceVisuals?.values?.() ?? []) sprite.destroy?.();
    for (const sprite of this.buildCarpetVisuals?.values?.() ?? []) sprite.destroy?.();
    for (const sprites of this.buildWallJunctions?.values?.() ?? []) {
      for (const sprite of sprites) sprite.destroy?.();
    }
  }

  getBuildModeRuntime() { return this.buildMode; }
  getPlacedObject(id) { return this.buildPlacedObjects.get(id) ?? null; }
  getPlacedObjects() { return [...this.buildPlacedObjects.values()]; }
  getNextBuildObjectId() { return this.nextBuildObjectId; }
  setNextBuildObjectId(value) { this.nextBuildObjectId = Math.max(this.nextBuildObjectId, Number(value) || 0); }
  getCellKey(point) { return this.buildCellKey(point); }
  place(item, point, context = {}) { return this.placeBuildAsset(item, point, context); }
  handles(item) { return this.wellOwner?.handles?.(item) ?? false; }
  isPlacementBlocked(item, point) { return this.isBuildObjectPlacementBlocked(item, point); }
  getMoveTargetAt(point) { return this.getBuildMoveTarget(point); }
  getDemolitionTargetAt(point) { return this.getBuildDemolitionPreviewTarget(point); }
  removeAt(point) { return this.wellOwner?.removeAt?.(point) ?? null; }
  restore(definition) { return this.wellOwner?.restore?.(definition) ?? null; }
  getInteractionDefinitions(selectedItem) { return this.wellOwner?.getInteractionDefinitions?.(selectedItem) ?? []; }
  getWellState() { return this.wellOwner?.getWellState?.() ?? []; }
  getVisualState(id) { return this.wellOwner?.getVisualState?.(id) ?? null; }

  beginBuildAction() {
    this.activeBuildAction = [];
  }

  recordBuildUndo(undo) {
    if (typeof undo === "function" && this.activeBuildAction) this.activeBuildAction.push(undo);
  }

  endBuildAction() {
    if (this.activeBuildAction?.length) {
      this.buildUndoStack.push(this.activeBuildAction);
      if (this.buildUndoStack.length > 100) this.buildUndoStack.shift();
    }
    this.activeBuildAction = null;
  }

  applyBuildPlacement(item, point, context) {
    const result = this.placeBuildAsset(item, point, context); if (result?.status === "placed") this.playEffect?.("build-place");
    if (result?.undo) {
      this.recordBuildUndo(result.undo);
    } else if (result?.status === "placed" && result.id) {
      if (item.placement === "well") {
        this.recordBuildUndo(() => {
          this.wellOwner?.removeAt?.(result.definition);
          this.refreshInteractions?.();
          this.persistGameplay?.();
        });
      } else if (item.placement === "facility") {
        this.recordBuildUndo(() => this.facilityRuntime?.remove?.(result.id));
      } else if (item.placement === "bed") {
        this.recordBuildUndo(() => this.debrisRuntime?.removeBed?.(result.id));
      } else {
        this.recordBuildUndo(() => this.removeBuildPlacedObjectById(result.id));
      }
    }
    return result;
  }

  applyBuildDemolition(point, onlyType) {
    const result = this.demolishBuildObject(point, onlyType); if (result?.status === "removed") this.playEffect?.("build-remove");
    this.recordBuildUndo(result?.undo);
    return result;
  }

  getBuildMoveTarget(point) {
    const hitPoint = { x: Number(point.rawX ?? point.x), y: Number(point.rawY ?? point.y) };
    const coordinated = this.wellOwner?.getMoveTargetAt?.(hitPoint);
    if (coordinated) return coordinated;
    const sign = this.tavernSignRuntime?.getBuildMoveTargetAt?.(hitPoint);
    if (sign) return sign;
    const dummy = this.meleeRuntime?.getBuildMoveTargetAt?.(hitPoint);
    if (dummy) return dummy;
    const facility = this.facilityRuntime?.getDefinitionAt?.(hitPoint);
    if (facility) {
      const profileKey = `facility:${facility.facilityType}`;
      return {
        kind: "facility",
        definition: facility,
        profileKey,
        placementPosition: { x: facility.footprint.x, y: facility.footprint.y },
        snapAnchorOffset: this.assetProfiles?.[profileKey]?.snapAnchorOffset ?? { x: 0, y: 0 },
      };
    }
    const bed = this.debrisRuntime?.getBedDefinitionAt?.(hitPoint);
    const bounds = bed ? this.debrisRuntime?.getBedBounds?.(bed.id) : null;
    return bed && bounds ? {
      kind: "bed",
      definition: bed,
      profileKey: "furniture:bed",
      placementPosition: { x: bounds.left, y: bounds.top },
      snapAnchorOffset: this.assetProfiles?.["furniture:bed"]?.snapAnchorOffset ?? { x: 0, y: 0 },
    } : null;
  }

  getBuildPlacementAnchorOffset(item) {
    if (item?.placement === "well") return { ...WELL_PROFILE.depthAnchorOffset };
    const profileKey = item?.placement === "facility"
      ? `facility:${item.facilityType}`
      : item?.placement === "bed"
        ? "furniture:bed"
        : item?.resourceProfileId ? `resource:${item.resourceProfileId}` : null;
    if (!profileKey) return { x: 0, y: 0 };
    const placementPosition = { x: 0, y: 0 };
    const baseCollider = item.placement === "facility"
      ? { left: 0, right: FACILITY_ASSETS[item.facilityType].width, top: 0, bottom: FACILITY_ASSETS[item.facilityType].height }
      : item.placement === "bed"
        ? { left: 0, right: TILE_SIZE, top: 0, bottom: TILE_SIZE }
        : { left: TILE_SIZE, right: TILE_SIZE * 2, top: TILE_SIZE * 3, bottom: TILE_SIZE * 4 };
    const effectiveCollider = this.worldLayout.getEffectiveCollider(baseCollider, profileKey);
    return placementMidpointOffset({
      placementPosition,
      pivotOffset: this.assetProfiles?.[profileKey]?.snapAnchorOffset ?? { x: 0, y: 0 },
      effectiveCollider,
    });
  }

  applyBuildMove(target, point) {
    if (!target?.definition) return { status: "ignored" };
    const result = target.kind === "well"
      ? this.wellOwner?.move?.(target, point)
      : target.kind === TAVERN_SIGN_BUILD_KIND
      ? this.tavernSignRuntime?.moveBuildTarget?.(point)
      : target.kind === "facility"
      ? this.facilityRuntime?.move?.(target.definition.id, point)
      : target.kind === "bed" ? this.debrisRuntime?.moveBed?.(target.definition.id, point)
      : target.kind === "training-dummy" ? this.meleeRuntime?.moveBuildTarget?.(point) : null;
    if (!result) return { status: "blocked" };
    this.recordBuildUndo(() => {
      if (target.kind === "well") {
        this.wellOwner?.removeAt?.(result.current);
        this.wellOwner?.restore?.(result.previous);
        this.persistGameplay?.();
      } else if (target.kind === TAVERN_SIGN_BUILD_KIND) this.tavernSignRuntime?.restoreBuildTarget?.(result.previous);
      else if (target.kind === "facility") this.facilityRuntime?.replace?.(result.previous);
      else if (target.kind === "training-dummy") this.meleeRuntime?.restoreBuildTarget?.(result.previous);
      else this.debrisRuntime?.replaceBed?.(result.previous);
      this.facilityRuntime?.syncKitchenVisuals?.();
      this.refreshInteractions?.();
    });
    this.facilityRuntime?.syncKitchenVisuals?.();
    this.refreshInteractions?.();
    if (target.kind === "well") this.persistGameplay?.();
    return { status: "moved" };
  }

  renderBuildMovePreview(target, point) {
    this.clearBuildPreview();
    if (!target?.definition) return;
    if (target.kind === TAVERN_SIGN_BUILD_KIND) { this.buildPreviewObjects.push(this.tavernSignRuntime.renderBuildPreview(point)); return; }
    if (target.kind === "training-dummy") { this.buildPreviewObjects.push(this.meleeRuntime.renderBuildPreview(point)); return; }
    if (target.kind === "well") {
      this.buildPreviewObjects.push(createWellPresentation(this.renderingHost, point, {
        depth: 8988,
        tint: this.wellOwner?.isPlacementBlocked?.({ placement: "well" }, point) ? 0xff5364 : 0x7dff9a,
        alpha: 0.52,
      }));
      return;
    }
    const visualOffset = this.assetProfiles?.[target.profileKey]?.visualOffset ?? { x: 0, y: 0 };
    const graphics = this.renderingHost.add.graphics().setPosition(point.x + visualOffset.x, point.y + visualOffset.y).setDepth(8988).setAlpha(0.58);
    if (target.kind === "bed") drawBed(graphics, 0x7dff9a);
    else drawFacility(graphics, target.definition.facilityType, 0x7dff9a);
    this.buildPreviewObjects.push(graphics);
  }

  renderBuildMoveHover(point) {
    this.clearBuildPreview();
    const hitPoint = { x: Number(point.rawX ?? point.x), y: Number(point.rawY ?? point.y) };
    const target = this.wellOwner?.getMoveTargetAt?.(hitPoint)
      ?? this.tavernSignRuntime?.getBuildMoveTargetAt?.(hitPoint)
      ?? this.meleeRuntime?.getBuildMoveTargetAt?.(hitPoint)
      ?? this.facilityRuntime?.getMoveTargetAt?.(hitPoint)
      ?? this.debrisRuntime?.getBedDemolitionTargetAt?.(hitPoint);
    if (!target) return false;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    for (const { target: object } of targets) {
      object.setTint?.(0x68ff8c);
      object.setAlpha?.(0.82);
    }
    this.buildDemolitionHighlight = { targets, overlay: null };
    return true;
  }

  undoBuildAction() {
    const action = this.buildUndoStack.pop();
    if (!action) return { status: "empty" };
    this.clearBuildPreview();
    for (const undo of [...action].reverse()) undo();
    this.refreshInteractions?.();
    return { status: "undone" };
  }

  clearBuildPreview() {
    for (const object of this.buildPreviewObjects) object.destroy();
    this.buildPreviewObjects = [];
    if (!this.buildDemolitionHighlight) return;
    for (const { target, alpha } of this.buildDemolitionHighlight.targets) {
      target.clearTint?.();
      target.setAlpha?.(alpha);
    }
    this.buildDemolitionHighlight.overlay?.destroy();
    this.buildDemolitionHighlight = null;
  }

  addBuildPreviewImage(x, y, textureKey, frame, depth = 8988, tint = null) {
    const sprite = this.renderingHost.add.image(x, y, textureKey, frame)
      .setOrigin(0)
      .setDepth(depth)
      .setAlpha(0.52);
    if (tint !== null) sprite.setTint(tint);
    this.buildPreviewObjects.push(sprite);
    return sprite;
  }

  isBuildObjectPlacementBlocked(item, point) {
    const coordinated = this.wellOwner?.isPlacementBlocked?.(item, point);
    if (coordinated !== null && coordinated !== undefined) return coordinated;
    let collider = null;
    let profileKey = null;
    if (item?.placement === "facility") {
      const asset = FACILITY_ASSETS[item.facilityType];
      collider = asset ? {
        left: point.x,
        right: point.x + asset.width,
        top: point.y,
        bottom: point.y + asset.height,
      } : null;
      profileKey = `facility:${item.facilityType}`;
    } else if (item?.placement === "bed") {
      collider = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
      profileKey = "furniture:bed";
    } else if (item?.placement === "tree") {
      collider = {
        left: point.x + TILE_SIZE,
        right: point.x + 2 * TILE_SIZE,
        top: point.y + 3 * TILE_SIZE,
        bottom: point.y + 4 * TILE_SIZE,
      };
      profileKey = `resource:${item.resourceProfileId}`;
    }
    return Boolean(collider && this.worldLayout.isBlockedBox(this.worldLayout.getEffectiveCollider(collider, profileKey)));
  }

  renderBuildPreview(item, points) {
    this.clearBuildPreview();
    if (!item || !points?.length) return;
    const uniquePoints = [...new Map(points.map((point) => [this.buildCellKey(point), point])).values()];
    if (item.placement === "wall") {
      this.renderBuildWallPreview(uniquePoints);
      return;
    }
    if (item.placement === "carpet") {
      this.renderBuildCarpetPreview(uniquePoints);
      return;
    }
    if (item.placement === "tile") {
      for (const point of uniquePoints) {
        for (const offset of [
          [-TILE_SIZE, -TILE_SIZE],
          [0, -TILE_SIZE],
          [-TILE_SIZE, 0],
          [0, 0],
        ]) {
          this.addBuildPreviewImage(point.x + offset[0], point.y + offset[1], item.textureKey, item.frame);
        }
      }
      return;
    }
    if (item.placement === "bed" || item.placement === "facility") {
      for (const point of uniquePoints) {
        const profileKey = item.placement === "bed" ? "furniture:bed" : `facility:${item.facilityType}`;
        const visualOffset = this.assetProfiles?.[profileKey]?.visualOffset ?? { x: 0, y: 0 };
        const tint = this.isBuildObjectPlacementBlocked(item, point) ? 0xff5364 : null;
        const graphics = this.renderingHost.add.graphics().setPosition(point.x + visualOffset.x, point.y + visualOffset.y).setDepth(8988).setAlpha(0.52);
        if (item.placement === "bed") drawBed(graphics, tint);
        else drawFacility(graphics, item.facilityType, tint);
        this.buildPreviewObjects.push(graphics);
      }
      return;
    }
    if (item.placement === "well") {
      for (const point of uniquePoints) {
        this.buildPreviewObjects.push(createWellPresentation(this.renderingHost, point, {
          depth: 8988,
          tint: this.isBuildObjectPlacementBlocked(item, point) ? 0xff5364 : null,
          alpha: 0.52,
        }));
      }
      return;
    }
    for (const point of uniquePoints) {
      if (item.placement === "tree") {
        const visualOffset = this.assetProfiles?.[`resource:${item.resourceProfileId}`]?.visualOffset ?? { x: 0, y: 0 };
        const tint = this.isBuildObjectPlacementBlocked(item, point) ? 0xff5364 : null;
        const graphics = this.renderingHost.add.graphics()
          .setPosition(point.x + visualOffset.x, point.y + visualOffset.y)
          .setDepth(8988)
          .setAlpha(0.52);
        drawResourceVisual(graphics, getResourceProfile(item.resourceProfileId), 0, { colorOverride: tint });
        this.buildPreviewObjects.push(graphics);
      } else if (item.textureKey) {
        this.addBuildPreviewImage(point.x, point.y, item.textureKey, item.frame);
      }
    }
  }

  renderBuildWallPreview(points) {
    if (points.length === 1) {
      this.addBuildPreviewImage(
        points[0].x - TILE_SIZE / 2,
        points[0].y - TILE_SIZE,
        HOUSE_TEXTURE_KEY,
        HOUSE_FRAMES.sideLeft,
      );
      return;
    }
    const horizontal = points.every((point) => point.y === points[0].y);
    const ordered = [...points].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const first = ordered[index];
      const second = ordered[index + 1];
      if (horizontal) {
        this.addBuildPreviewImage(first.x, first.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottom);
      } else {
        this.addBuildPreviewImage(
          first.x - TILE_SIZE / 2,
          Math.min(first.y, second.y) + getBuildVerticalWallOffset(),
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.wallRightCap,
        );
      }
    }
    if (!horizontal) {
      const top = ordered[0];
      const bottom = ordered.at(-1);
      const topIncidents = this.getBuildWallIncidents(top);
      const bottomIncidents = this.getBuildWallIncidents(bottom);
      if (!topIncidents.north && !topIncidents.east && !topIncidents.west) {
        this.addBuildPreviewImage(
          top.x - TILE_SIZE / 2,
          top.y - TILE_SIZE,
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.sideLeft,
          8987,
        );
      }
      if (!bottomIncidents.south && !bottomIncidents.east && !bottomIncidents.west) {
        this.addBuildPreviewImage(
          bottom.x - TILE_SIZE / 2,
          bottom.y - TILE_SIZE,
          HOUSE_TEXTURE_KEY,
          HOUSE_FRAMES.sideLeft,
          8989,
        );
      }
      return;
    }
    const left = ordered[0];
    const right = ordered.at(-1);
    if (!this.hasBuildWallVertex(left)) {
      this.addBuildPreviewImage(left.x - TILE_SIZE / 2, left.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottomLeft);
    }
    if (!this.hasBuildWallVertex(right)) {
      this.addBuildPreviewImage(right.x - TILE_SIZE / 2, right.y - TILE_SIZE, HOUSE_TEXTURE_KEY, HOUSE_FRAMES.bottomRight);
    }
  }

  renderBuildCarpetPreview(points) {
    const occupied = new Set(this.buildCarpetCells.keys());
    for (const point of points) occupied.add(this.buildCellKey(point));
    const visualTiles = new Map();
    for (const point of points) {
      for (const tile of [
        { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
        { x: point.x, y: point.y - TILE_SIZE },
        { x: point.x - TILE_SIZE, y: point.y },
        { x: point.x, y: point.y },
      ]) visualTiles.set(this.buildCellKey(tile), tile);
    }
    for (const tile of visualTiles.values()) {
      const samples = [
        [1, tile.x, tile.y],
        [2, tile.x + TILE_SIZE, tile.y],
        [4, tile.x, tile.y + TILE_SIZE],
        [8, tile.x + TILE_SIZE, tile.y + TILE_SIZE],
      ];
      const mask = samples.reduce((value, [bit, x, y]) => (
        occupied.has(this.buildCellKey({ x, y })) ? value | bit : value
      ), 0);
      if (mask) this.addBuildPreviewImage(tile.x, tile.y, HOUSE_TEXTURE_KEY, BUILD_CARPET_FRAME_BY_MASK[mask]);
    }
  }

  renderBuildDemolitionHighlight(point) {
    this.clearBuildPreview();
    const target = this.getBuildDemolitionPreviewTarget(point);
    if (!target) return;
    const targets = target.targets.map((object) => ({ target: object, alpha: object.alpha ?? 1 }));
    let tintable = false;
    for (const { target: object } of targets) {
      if (object.setTint) {
        object.setTint(0xff6b72);
        tintable = true;
      }
      object.setAlpha?.(0.78);
    }
    let overlay = null;
    if (!tintable && (target.kind === "facility" || target.kind === "bed")) {
      overlay = this.renderingHost.add.graphics()
        .setPosition(target.bounds.left, target.bounds.top)
        .setDepth(8989)
        .setAlpha(0.68);
      if (target.kind === "bed") drawBed(overlay, 0xff5b66);
      else drawFacility(overlay, target.facilityType, 0xff5b66);
    }
    this.buildDemolitionHighlight = { targets, overlay };
  }

  getBuildDemolitionPreviewTarget(point) {
    const hitPoint = {
      x: Number(point.rawX ?? point.x),
      y: Number(point.rawY ?? point.y),
    };
    const coordinated = this.wellOwner?.getDemolitionTargetAt?.(hitPoint);
    if (coordinated) return coordinated;
    const facility = this.facilityRuntime?.getDemolitionTargetAt?.(hitPoint);
    if (facility) return facility;
    const bed = this.debrisRuntime?.getBedDemolitionTargetAt?.(hitPoint);
    if (bed) return bed;
    const placed = [...this.buildPlacedObjects.values()]
      .reverse()
      .find((object) => this.isPointInWorldBounds(hitPoint, object.bounds));
    if (placed) return { targets: placed.sprites, bounds: placed.bounds };
    const floor = this.floorSprites.get(this.buildCellKey({ x: point.x, y: point.y }));
    if (floor) {
      return {
        targets: [floor.sprite],
        bounds: { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE },
      };
    }
    const wall = [...this.wallSprites.values()]
      .reverse()
      .find(({ tile }) => this.isPointInWorldBounds(hitPoint, {
        left: tile.worldX,
        right: tile.worldX + TILE_SIZE,
        top: tile.worldY,
        bottom: tile.worldY + TILE_SIZE,
      }));
    return wall
      ? {
        targets: [wall.sprite, ...wall.extraSprites],
        bounds: {
          left: wall.tile.worldX,
          right: wall.tile.worldX + TILE_SIZE,
          top: wall.tile.worldY,
          bottom: wall.tile.worldY + TILE_SIZE,
        },
      }
      : null;
  }

  placeBuildAsset(item, point, context = {}) {
    if (this.wellOwner?.handles?.(item)) {
      const result = this.wellOwner.place(item, point);
      this.refreshInteractions?.();
      if (result?.status === "placed") this.persistGameplay?.();
      return result;
    }
    if (item.placement === "facility") {
      const definition = this.facilityRuntime?.add?.(item.facilityType, point);
      this.refreshInteractions?.();
      return { status: definition ? "placed" : "blocked", id: definition?.id };
    }
    if (item.placement === "bed") {
      const definition = this.debrisRuntime?.addBed?.(point);
      this.refreshInteractions?.();
      return { status: definition ? "placed" : "blocked", id: definition?.id };
    }
    if (item.placement === "wall") return this.placeBuildWall(item, point, context);
    if (item.placement === "tile") return this.placeBuildGround(item, point);
    if (item.placement === "floor") return this.placeBuildFloor(item, point);
    if (item.placement === "carpet") return this.placeBuildCarpet(item, point);

    const id = `editor-world-${++this.nextBuildObjectId}`;
    const sprites = [];
    let bounds = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
    let collider = null;
    let colliderGroup = null;
    if (item.placement === "tree") {
      const profileKey = `resource:${item.resourceProfileId}`;
      bounds = { left: point.x, right: point.x + 3 * TILE_SIZE, top: point.y, bottom: point.y + 4 * TILE_SIZE };
      collider = { left: point.x + TILE_SIZE, right: point.x + 2 * TILE_SIZE, top: point.y + 3 * TILE_SIZE, bottom: point.y + 4 * TILE_SIZE };
      colliderGroup = profileKey;
    } else {
      sprites.push(this.renderingHost.add.image(point.x, point.y, item.textureKey, item.frame).setOrigin(0).setDepth(1));
    }
    if (collider && this.worldLayout.isBlockedBox(this.worldLayout.getEffectiveCollider(collider, colliderGroup))) {
      for (const sprite of sprites) sprite.destroy();
      return { status: "blocked" };
    }
    colliderGroup ??= collider ? `build:${item.placement ?? item.id}` : null;
    if (collider) this.worldLayout.setWorldObjectCollider(id, collider, colliderGroup);
    this.buildPlacedObjects.set(id, {
      id,
      kind: item.placement ?? "placed",
      item: { ...item },
      point: { ...point },
      sprites,
      bounds,
      collider: Boolean(collider),
      colliderBounds: collider ? { ...collider } : null,
      colliderGroup,
    });
    return { status: "placed", id };
  }

  placeBuildFloor(item, point) {
    const cell = this.buildCellKey(point);
    if (this.buildFloorCells.has(cell)) return { status: "blocked" };
    const id = `editor-floor-${++this.nextBuildObjectId}`;
    const bounds = { left: point.x, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE };
    const sprite = this.renderingHost.add.image(point.x, point.y, item.textureKey, item.frame).setOrigin(0).setDepth(20);
    this.buildPlacedObjects.set(id, {
      id,
      kind: "floor",
      item: { ...item },
      point: { ...point },
      sprites: [sprite],
      bounds,
      collider: false,
    });
    this.buildFloorCells.set(cell, id);
    return { status: "placed", id };
  }

  placeBuildCarpet(item, point) {
    const cell = this.buildCellKey(point);
    if (this.buildCarpetCells.has(cell)) return { status: "blocked" };
    const id = `editor-carpet-${++this.nextBuildObjectId}`;
    this.buildPlacedObjects.set(id, {
      id,
      kind: "carpet",
      item: { ...item },
      point: { ...point },
      sprites: [],
      bounds: {
        left: point.x - TILE_SIZE / 2,
        right: point.x + TILE_SIZE / 2,
        top: point.y - TILE_SIZE / 2,
        bottom: point.y + TILE_SIZE / 2,
      },
      collider: false,
    });
    this.buildCarpetCells.set(cell, id);
    this.refreshBuildCarpet(point);
    return { status: "placed", id };
  }

  placeBuildGround(item, point) {
    const cell = this.buildCellKey(point);
    const previousId = this.buildGroundCells.get(cell);
    const previous = previousId ? this.buildPlacedObjects.get(previousId) : null;
    if (previous) {
      this.buildPlacedObjects.delete(previous.id);
      this.buildGroundCells.delete(cell);
    }
    const id = `editor-ground-${++this.nextBuildObjectId}`;
    const bounds = {
      left: point.x - TILE_SIZE / 2,
      right: point.x + TILE_SIZE / 2,
      top: point.y - TILE_SIZE / 2,
      bottom: point.y + TILE_SIZE / 2,
    };
    this.buildPlacedObjects.set(id, {
      id,
      kind: "ground",
      item: { ...item },
      material: item.id,
      point: { ...point },
      sprites: [],
      bounds,
      collider: false,
    });
    this.buildGroundCells.set(cell, id);
    this.refreshBuildSurface(point);
    return {
      status: "placed",
      id,
      undo: () => {
        this.removeBuildPlacedObjectById(id);
        if (previous) this.restoreBuildPlacedObject(previous);
      },
    };
  }

  placeBuildWall(item, point, context = {}) {
    if (context.gesture === "drag" && context.previousPoint) {
      const edge = this.getBuildWallEdgeBetweenVertices(context.previousPoint, point);
      if (!edge || this.buildWallEdges.has(this.buildWallEdgeKey(edge))) return { status: "exists" };
      const { collider } = this.getBuildWallEdgeGeometry(edge);
      if (isWallPlacementBlocked({
        edge,
        collider,
        colliders: this.worldLayout.getBlockingColliders(collider),
        tileSize: TILE_SIZE,
      }) || this.doesPlayerOverlapBox(collider)) {
        return { status: "blocked" };
      }
      const id = this.addBuildWallEdge(item, edge);
      if (!id) return { status: "exists" };
      for (const vertex of this.getBuildWallVertices(edge)) {
        this.refreshBuildWallJunction(vertex);
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
      return { status: "placed", id };
    }

    const key = this.buildCellKey(point);
    if (this.buildWallNodes.has(key)) return { status: "exists" };
    const nodeCollider = {
      left: point.x - 2,
      right: point.x + 2,
      top: point.y - 2,
      bottom: point.y + 2,
    };
    if (hasIncidentWall(this.getBuildWallIncidents(point))
      || this.worldLayout.isBlockedBox(nodeCollider)
      || this.doesPlayerOverlapBox(nodeCollider)) {
      return { status: "blocked" };
    }
    const id = `editor-wall-node-${++this.nextBuildObjectId}`;
    this.worldLayout.setWorldObjectCollider(id, nodeCollider, WALL_COLLIDER_GROUPS.node, { wallNode: { x: point.x, y: point.y } });
    this.buildPlacedObjects.set(id, {
      id,
      kind: "wall-node",
      item: { ...item },
      point: { x: point.x, y: point.y },
      sprites: [],
      bounds: {
        left: point.x - TILE_SIZE / 2,
        right: point.x + TILE_SIZE / 2,
        top: point.y - TILE_SIZE,
        bottom: point.y,
      },
      collider: true,
      colliderBounds: nodeCollider,
      colliderGroup: WALL_COLLIDER_GROUPS.node,
      textureKey: item.textureKey,
    });
    this.buildWallNodes.set(key, id);
    this.refreshBuildWallJunction(point);
    this.refreshBuildWallEdgesAtVertex(point);
    return { status: "placed", id };
  }

  getBuildWallEdgeBetweenVertices(first, second) {
    if (first.x === second.x && Math.abs(first.y - second.y) === TILE_SIZE) {
      return { x: first.x, y: Math.min(first.y, second.y), orientation: "vertical" };
    }
    if (first.y === second.y && Math.abs(first.x - second.x) === TILE_SIZE) {
      return { x: Math.min(first.x, second.x), y: first.y, orientation: "horizontal" };
    }
    return null;
  }

  addBuildWallEdge(item, point) {
    const edge = this.buildWallEdgeKey(point);
    if (this.buildWallEdges.has(edge)) return null;
    const { bounds, baseCollider, groupKey } = this.getBuildWallEdgeGeometry(point);
    const id = `editor-wall-${++this.nextBuildObjectId}`;
    this.worldLayout.setWorldObjectCollider(id, baseCollider, groupKey, { wallEdge: { ...point } });
    this.buildPlacedObjects.set(id, {
      id,
      kind: "wall",
      item: { ...item },
      point: { ...point },
      sprites: [],
      bounds,
      collider: true,
      colliderBounds: baseCollider,
      colliderGroup: groupKey,
      textureKey: item.textureKey,
    });
    this.buildWallEdges.set(edge, id);
    this.refreshBuildWallEdgeVisual(point);
    return id;
  }

  getBuildWallEdgeFrames(point) {
    if (point.orientation === "vertical") {
      const top = this.getBuildWallIncidents({ x: point.x, y: point.y });
      const bottom = this.getBuildWallIncidents({ x: point.x, y: point.y + TILE_SIZE });
      const joinsEast = top.east || bottom.east;
      const joinsWest = top.west || bottom.west;
      return [getBuildVerticalWallFrame({ joinsEast, joinsWest })];
    }
    const left = this.getBuildWallIncidents({ x: point.x, y: point.y });
    const right = this.getBuildWallIncidents({ x: point.x + TILE_SIZE, y: point.y });
    const leftCap = !left.west;
    const rightCap = !right.east;
    const frames = [HOUSE_FRAMES.bottom];
    if (leftCap) frames.push(HOUSE_FRAMES.bottomLeft);
    if (rightCap) frames.push(HOUSE_FRAMES.bottomRight);
    return frames;
  }

  createBuildWallEdgeSprites(point, textureKey, frames) {
    const vertical = point.orientation === "vertical";
    return frames.map((frame) => this.renderingHost.add.image(
      vertical
        ? point.x - TILE_SIZE / 2
        : frame === HOUSE_FRAMES.bottomLeft
          ? point.x - TILE_SIZE / 2
          : frame === HOUSE_FRAMES.bottomRight
            ? point.x + TILE_SIZE / 2
            : point.x,
      vertical ? point.y + getBuildVerticalWallOffset() : point.y - TILE_SIZE,
      textureKey,
      frame,
    )
      .setOrigin(0)
      .setDepth(worldDepthFromAnchorY(
        point.y + (vertical ? TILE_SIZE : 0),
        `${this.buildWallEdgeKey(point)}:${frame}`,
      )));
  }

  refreshBuildWallEdgeVisual(point) {
    const id = this.buildWallEdges.get(this.buildWallEdgeKey(point));
    if (!id) return;
    const frames = this.getBuildWallEdgeFrames(point);
    const placed = this.buildPlacedObjects.get(id);
    if (placed) {
      for (const sprite of placed.sprites) sprite.destroy();
      placed.sprites = this.createBuildWallEdgeSprites(point, placed.textureKey, frames);
      return;
    }
    const canonical = [...this.wallSprites.values()]
      .find((entry) => entry.tile.edgeIds.includes(id));
    if (!canonical) return;
    canonical.sprite.destroy();
    for (const sprite of canonical.extraSprites) sprite.destroy();
    const sprites = this.createBuildWallEdgeSprites(point, HOUSE_TEXTURE_KEY, frames);
    canonical.sprite = sprites[0];
    canonical.extraSprites = sprites.slice(1);
  }

  refreshBuildWallEdgesAtVertex(vertex) {
    for (const edge of [
      { x: vertex.x - TILE_SIZE, y: vertex.y, orientation: "horizontal" },
      { x: vertex.x, y: vertex.y, orientation: "horizontal" },
    ]) {
      this.refreshBuildWallEdgeVisual(edge);
    }
  }

  getBuildWallEdgeGeometry(point) {
    const vertical = point.orientation === "vertical";
    const bounds = vertical
      ? { left: point.x - TILE_SIZE, right: point.x + TILE_SIZE, top: point.y, bottom: point.y + TILE_SIZE }
      : { left: point.x - TILE_SIZE / 2, right: point.x + TILE_SIZE * 1.5, top: point.y - TILE_SIZE, bottom: point.y };
    const baseCollider = vertical
      ? { left: point.x - 2, right: point.x + 2, top: point.y, bottom: point.y + TILE_SIZE }
      : { left: point.x, right: point.x + TILE_SIZE, top: point.y - 2, bottom: point.y + 2 };
    const groupKey = wallColliderGroup(point.orientation);
    const collider = this.worldLayout.getEffectiveCollider(baseCollider, groupKey);
    return { vertical, bounds, baseCollider, collider, groupKey };
  }

  getAdjacentBuildWallEdges(point) {
    return [
      {
        neighbor: { x: point.x, y: point.y - TILE_SIZE },
        edge: { x: point.x, y: point.y - TILE_SIZE, orientation: "vertical" },
      },
      {
        neighbor: { x: point.x + TILE_SIZE, y: point.y },
        edge: { x: point.x, y: point.y, orientation: "horizontal" },
      },
      {
        neighbor: { x: point.x, y: point.y + TILE_SIZE },
        edge: { x: point.x, y: point.y, orientation: "vertical" },
      },
      {
        neighbor: { x: point.x - TILE_SIZE, y: point.y },
        edge: { x: point.x - TILE_SIZE, y: point.y, orientation: "horizontal" },
      },
    ];
  }

  hasBuildWallVertex(point) {
    if (this.buildWallNodes.has(this.buildCellKey(point))) return true;
    return Object.values(this.getBuildWallIncidents(point)).some(Boolean);
  }

  doesPlayerOverlapBox(box) {
    const foot = this.getPlayerFootBox?.();
    if (!foot) return false;
    return foot.left < box.right
      && foot.right > box.left
      && foot.top < box.bottom
      && foot.bottom > box.top;
  }

  refreshBuildWallJunctions(edge) {
    for (const vertex of this.getBuildWallVertices(edge)) this.refreshBuildWallJunction(vertex);
  }

  refreshBuildWallJunction(vertex) {
    const key = this.buildCellKey(vertex);
    const previous = this.buildWallJunctions.get(key);
    if (previous) {
      for (const sprite of previous) sprite.destroy();
      this.buildWallJunctions.delete(key);
    }
    const incidents = this.getBuildWallIncidents(vertex);
    const explicit = this.buildWallNodes.has(key);
    const frames = getBuildWallFrames({ ...incidents, explicit });
    if (!frames.length) return;
    const verticalTerminus = incidents.north !== incidents.south && !incidents.east && !incidents.west;
    const anchorY = vertex.y + getBuildWallColumnDepthOffset({
      verticalTerminus,
      explicit,
      isBottom: incidents.north,
    });
    const spriteY = vertex.y + getBuildWallColumnOffset({ verticalTerminus, explicit });
    const sprites = frames.map((frame) => this.renderingHost.add.image(
      vertex.x - TILE_SIZE / 2,
      spriteY,
      HOUSE_TEXTURE_KEY,
      frame,
    ).setOrigin(0).setDepth(worldDepthFromAnchorY(anchorY, `${key}:${frame}`)));
    this.buildWallJunctions.set(key, sprites);
  }

  getBuildWallVertices(edge) {
    return edge.orientation === "vertical"
      ? [{ x: edge.x, y: edge.y }, { x: edge.x, y: edge.y + TILE_SIZE }]
      : [{ x: edge.x, y: edge.y }, { x: edge.x + TILE_SIZE, y: edge.y }];
  }

  getBuildWallIncidents(vertex) {
    const has = (orientation, x, y) => this.buildWallEdges.has(`${orientation}:${x},${y}`);
    return {
      north: has("vertical", vertex.x, vertex.y - TILE_SIZE),
      east: has("horizontal", vertex.x, vertex.y),
      south: has("vertical", vertex.x, vertex.y),
      west: has("horizontal", vertex.x - TILE_SIZE, vertex.y),
    };
  }

  buildWallEdgeKey(edge) {
    return `${edge.orientation}:${edge.x},${edge.y}`;
  }

  refreshBuildCarpet(point) {
    const visualTiles = [
      { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
      { x: point.x, y: point.y - TILE_SIZE },
      { x: point.x - TILE_SIZE, y: point.y },
      { x: point.x, y: point.y },
    ];
    for (const tile of visualTiles) {
      const key = this.buildCellKey(tile);
      this.buildCarpetVisuals.get(key)?.destroy();
      this.buildCarpetVisuals.delete(key);
      const mask = this.getBuildCarpetMask(tile);
      if (!mask) continue;
      const sprite = this.renderingHost.add.image(
        tile.x,
        tile.y,
        HOUSE_TEXTURE_KEY,
        BUILD_CARPET_FRAME_BY_MASK[mask],
      ).setOrigin(0).setDepth(25);
      this.buildCarpetVisuals.set(key, sprite);
    }
  }

  getBuildCarpetMask(tile) {
    return [
      { bit: 1, x: tile.x, y: tile.y },
      { bit: 2, x: tile.x + TILE_SIZE, y: tile.y },
      { bit: 4, x: tile.x, y: tile.y + TILE_SIZE },
      { bit: 8, x: tile.x + TILE_SIZE, y: tile.y + TILE_SIZE },
    ].reduce((mask, sample) => (
      this.buildCarpetCells.has(this.buildCellKey(sample)) ? mask | sample.bit : mask
    ), 0);
  }

  refreshBuildSurface(point) {
    const visualTiles = [
      { x: point.x - TILE_SIZE, y: point.y - TILE_SIZE },
      { x: point.x, y: point.y - TILE_SIZE },
      { x: point.x - TILE_SIZE, y: point.y },
      { x: point.x, y: point.y },
    ];
    for (const tile of visualTiles) {
      const key = this.buildCellKey(tile);
      this.buildSurfaceVisuals.get(key)?.destroy();
      const mask = this.getBuildSurfaceMask(tile);
      const customKey = `build-surface-mask-${mask}`;
      const sprite = BUILD_SURFACE_CUSTOM_MASKS.includes(mask)
        ? this.renderingHost.add.image(tile.x, tile.y, customKey)
        : this.renderingHost.add.image(tile.x, tile.y, OUTDOOR_TEXTURE_KEY, BUILD_SURFACE_FRAME_BY_MASK[mask]);
      sprite.setOrigin(0).setDepth(1);
      this.buildSurfaceVisuals.set(key, sprite);
    }
  }

  getBuildSurfaceMask(tile) {
    return [
      { bit: 1, x: tile.x, y: tile.y },
      { bit: 2, x: tile.x + TILE_SIZE, y: tile.y },
      { bit: 4, x: tile.x, y: tile.y + TILE_SIZE },
      { bit: 8, x: tile.x + TILE_SIZE, y: tile.y + TILE_SIZE },
    ].reduce((mask, sample) => (
      this.getBuildSurfaceMaterial(sample) === "path" ? mask | sample.bit : mask
    ), 0);
  }

  getBuildSurfaceMaterial(point) {
    const cell = this.buildCellKey(point);
    const buildId = this.buildGroundCells.get(cell);
    if (buildId) return this.buildPlacedObjects.get(buildId)?.material ?? "grass";
    return this.canonicalPathCells.has(cell) ? "path" : "grass";
  }

  ensureBuildSurfaceTextures() {
    const source = this.renderingHost.textures.get(OUTDOOR_TEXTURE_KEY).getSourceImage();
    const sourceColumns = Math.floor(source.width / TILE_SIZE);
    const drawFrame = (context, frame, cropX = 0, cropY = 0, size = TILE_SIZE) => {
      const sourceX = (frame % sourceColumns) * TILE_SIZE + cropX;
      const sourceY = Math.floor(frame / sourceColumns) * TILE_SIZE + cropY;
      context.drawImage(source, sourceX, sourceY, size, size, cropX, cropY, size, size);
    };
    const framePixels = (frame) => {
      const canvas = document.createElement("canvas");
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      const context = canvas.getContext("2d");
      const sourceX = (frame % sourceColumns) * TILE_SIZE;
      const sourceY = Math.floor(frame / sourceColumns) * TILE_SIZE;
      context.drawImage(source, sourceX, sourceY, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE);
      return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
    };
    const grassPixels = framePixels(OUTDOOR_FRAMES.grass);
    const half = TILE_SIZE / 2;
    const fringe = TILE_SIZE / 4;
    const diagonalPathCorners = {
      6: [
        { frame: OUTDOOR_FRAMES.pathBottom[0], x: half, y: 0 },
        { frame: OUTDOOR_FRAMES.pathTop[2], x: 0, y: half },
      ],
      9: [
        { frame: OUTDOOR_FRAMES.pathBottom[2], x: 0, y: 0 },
        { frame: OUTDOOR_FRAMES.pathTop[0], x: half, y: half },
      ],
    };
    const applyCorner = (output, corner) => {
      const pixels = framePixels(corner.frame);
      const east = corner.x === half;
      const south = corner.y === half;
      for (let y = 0; y < TILE_SIZE; y += 1) {
        for (let x = 0; x < TILE_SIZE; x += 1) {
          const inCoreX = east ? x >= half : x < half;
          const inCoreY = south ? y >= half : y < half;
          const inFringeX = east ? x >= half - fringe : x < half + fringe;
          const inFringeY = south ? y >= half - fringe : y < half + fringe;
          const index = (y * TILE_SIZE + x) * 4;
          const difference = Math.abs(pixels.data[index] - grassPixels.data[index])
            + Math.abs(pixels.data[index + 1] - grassPixels.data[index + 1])
            + Math.abs(pixels.data[index + 2] - grassPixels.data[index + 2]);
          if ((inCoreX && inCoreY) || (inFringeX && inFringeY && difference > 18)) {
            output.data[index] = pixels.data[index];
            output.data[index + 1] = pixels.data[index + 1];
            output.data[index + 2] = pixels.data[index + 2];
            output.data[index + 3] = pixels.data[index + 3];
          }
        }
      }
    };
    for (const mask of BUILD_SURFACE_CUSTOM_MASKS) {
      const key = `build-surface-mask-${mask}`;
      if (this.renderingHost.textures.exists(key)) continue;
      const texture = this.renderingHost.textures.createCanvas(key, TILE_SIZE, TILE_SIZE);
      const context = texture.getContext();
      context.imageSmoothingEnabled = false;
      drawFrame(context, OUTDOOR_FRAMES.grass);
      const output = context.getImageData(0, 0, TILE_SIZE, TILE_SIZE);
      for (const corner of diagonalPathCorners[mask]) {
        applyCorner(output, corner);
      }
      context.putImageData(output, 0, 0);
      texture.refresh();
    }
  }

  isPathFrame(frame) {
    return [
      ...OUTDOOR_FRAMES.pathTop,
      ...OUTDOOR_FRAMES.pathMiddle,
      ...OUTDOOR_FRAMES.pathBottom,
    ].includes(frame);
  }

  buildCellKey(point) {
    return `${point.x},${point.y}`;
  }

  removeBuildPlacedObjectById(id) {
    const placed = this.buildPlacedObjects.get(id);
    if (!placed) return null;
    for (const sprite of placed.sprites) sprite.destroy();
    if (placed.collider) this.worldLayout.clearWorldObjectCollider(placed.id);
    this.buildPlacedObjects.delete(placed.id);
    if (placed.kind === "wall") {
      this.buildWallEdges.delete(this.buildWallEdgeKey(placed.point));
      this.refreshBuildWallJunctions(placed.point);
      for (const vertex of this.getBuildWallVertices(placed.point)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
    }
    if (placed.kind === "wall-node") {
      this.buildWallNodes.delete(this.buildCellKey(placed.point));
      this.refreshBuildWallJunction(placed.point);
    }
    if (placed.kind === "ground") {
      this.buildGroundCells.delete(this.buildCellKey(placed.point));
      this.refreshBuildSurface(placed.point);
    }
    if (placed.kind === "carpet") {
      this.buildCarpetCells.delete(this.buildCellKey(placed.point));
      this.refreshBuildCarpet(placed.point);
    }
    if (placed.kind === "floor") this.buildFloorCells.delete(this.buildCellKey(placed.point));
    return placed;
  }

  restoreBuildPlacedObject(placed) {
    if (!placed || this.buildPlacedObjects.has(placed.id)) return false;
    const restored = { ...placed, sprites: [] };
    if (restored.kind === "wall") restored.colliderGroup = wallColliderGroup(restored.point.orientation);
    if (restored.kind === "wall-node") restored.colliderGroup = WALL_COLLIDER_GROUPS.node;
    this.buildPlacedObjects.set(restored.id, restored);
    if (restored.collider && restored.colliderBounds) {
      const metadata = restored.kind === "wall"
        ? { wallEdge: { ...restored.point } }
        : restored.kind === "wall-node" ? { wallNode: { ...restored.point } } : null;
      this.worldLayout.setWorldObjectCollider(restored.id, restored.colliderBounds, restored.colliderGroup ?? restored.id, metadata);
    }
    if (restored.kind === "wall") {
      this.buildWallEdges.set(this.buildWallEdgeKey(restored.point), restored.id);
      this.refreshBuildWallEdgeVisual(restored.point);
      this.refreshBuildWallJunctions(restored.point);
      for (const vertex of this.getBuildWallVertices(restored.point)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
      return true;
    }
    if (restored.kind === "wall-node") {
      this.buildWallNodes.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildWallJunction(restored.point);
      this.refreshBuildWallEdgesAtVertex(restored.point);
      return true;
    }
    if (restored.kind === "ground") {
      this.buildGroundCells.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildSurface(restored.point);
      return true;
    }
    if (restored.kind === "carpet") {
      this.buildCarpetCells.set(this.buildCellKey(restored.point), restored.id);
      this.refreshBuildCarpet(restored.point);
      return true;
    }
    if (restored.kind === "floor") {
      const sprite = this.renderingHost.add.image(
        restored.point.x,
        restored.point.y,
        restored.item.textureKey,
        restored.item.frame,
      ).setOrigin(0).setDepth(20);
      restored.sprites = [sprite];
      this.buildFloorCells.set(this.buildCellKey(restored.point), restored.id);
      return true;
    }
    if (restored.kind === "tree") return true;
    restored.sprites = [this.renderingHost.add.image(
      restored.point.x,
      restored.point.y,
      restored.item.textureKey,
      restored.item.frame,
    ).setOrigin(0).setDepth(1)];
    return true;
  }

  demolishBuildObject(point, onlyType = null) {
    const hitPoint = {
      x: Number(point.rawX ?? point.x),
      y: Number(point.rawY ?? point.y),
    };
    const well = (!onlyType || onlyType === "well")
      ? this.wellOwner?.removeAt?.(hitPoint)
      : null;
    if (well) {
      this.refreshInteractions?.();
      this.persistGameplay?.();
      return {
        status: "removed",
        type: "well",
        undo: () => {
          this.wellOwner?.restore?.(well);
          this.refreshInteractions?.();
          this.persistGameplay?.();
        },
      };
    }
    const facility = (!onlyType || onlyType === "facility")
      ? this.facilityRuntime?.getDefinitionAt?.(hitPoint)
      : null;
    if (facility && this.facilityRuntime?.remove?.(facility.id)) {
      this.refreshInteractions?.();
      return {
        status: "removed",
        type: "facility",
        undo: () => this.facilityRuntime?.restore?.(facility),
      };
    }
    const bed = (!onlyType || onlyType === "bed")
      ? this.debrisRuntime?.getBedDefinitionAt?.(hitPoint)
      : null;
    if (bed && this.debrisRuntime?.removeBed?.(bed.id)) {
      this.refreshInteractions?.();
      return {
        status: "removed",
        type: "bed",
        undo: () => this.debrisRuntime?.restoreBed?.(bed),
      };
    }
    const placed = [...this.buildPlacedObjects.values()]
      .reverse()
      .find((object) => (
        (!onlyType || onlyType === this.getBuildObjectDemolitionType(object))
        && this.isPointInWorldBounds(hitPoint, object.bounds)
      ));
    if (placed) {
      const removed = this.removeBuildPlacedObjectById(placed.id);
      return {
        status: "removed",
        type: this.getBuildObjectDemolitionType(placed),
        undo: () => this.restoreBuildPlacedObject(removed),
      };
    }
    const floorCell = this.buildCellKey({ x: point.x, y: point.y });
    const floor = this.floorSprites.get(floorCell);
    if ((!onlyType || onlyType === "floor") && floor) {
      floor.sprite.destroy();
      this.floorSprites.delete(floorCell);
      return {
        status: "removed",
        type: "floor",
        undo: () => {
          if (this.floorSprites.has(floorCell)) return;
          const sprite = this.addTile(floor.tile, HOUSE_TEXTURE_KEY, 20);
          this.floorSprites.set(floorCell, { sprite, tile: floor.tile });
        },
      };
    }
    const wall = [...this.wallSprites.values()]
      .reverse()
      .find(({ tile }) => this.isPointInWorldBounds(hitPoint, {
        left: tile.worldX,
        right: tile.worldX + TILE_SIZE,
        top: tile.worldY,
        bottom: tile.worldY + TILE_SIZE,
      }));
    if (onlyType && onlyType !== "wall") return { status: "empty" };
    if (!wall) return { status: "empty" };
    const edgeIds = new Set(wall.tile.edgeIds);
    const removedEntries = [];
    for (const [id, entry] of [...this.wallSprites]) {
      if (!entry.tile.edgeIds.some((edgeId) => edgeIds.has(edgeId))) continue;
      entry.sprite.destroy();
      for (const sprite of entry.extraSprites) sprite.destroy();
      this.wallSprites.delete(id);
      removedEntries.push({ id, tile: entry.tile });
      for (const edgeId of entry.tile.edgeIds) edgeIds.add(edgeId);
    }
    const removedPoints = this.worldLayout.wallEdges
      .filter((edge) => edgeIds.has(edge.id))
      .map((edge) => ({
        x: edge.x,
        y: edge.y,
        orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
        edgeId: edge.id,
      }));
    for (const removedPoint of removedPoints) {
      this.buildWallEdges.delete(this.buildWallEdgeKey(removedPoint));
    }
    this.worldLayout.removeWallEdges([...edgeIds]);
    for (const removedPoint of removedPoints) {
      this.refreshBuildWallJunctions(removedPoint);
      for (const vertex of this.getBuildWallVertices(removedPoint)) {
        this.refreshBuildWallEdgesAtVertex(vertex);
      }
    }
    return {
      status: "removed",
      type: "wall",
      undo: () => {
        this.worldLayout.restoreWallEdges([...edgeIds]);
        for (const { id, tile } of removedEntries) {
          if (!this.wallSprites.has(id)) this.wallSprites.set(id, this.createCanonicalWallEntry(tile));
        }
        for (const removedPoint of removedPoints) {
          this.buildWallEdges.set(this.buildWallEdgeKey(removedPoint), removedPoint.edgeId);
          this.refreshBuildWallJunctions(removedPoint);
        }
      },
    };
  }

  getBuildObjectDemolitionType(object) {
    if (object.kind === "wall-node") return "wall";
    if (["wall", "ground", "floor", "carpet"].includes(object.kind)) return object.kind;
    if (object.kind === "tree") return "tree";
    return "placed";
  }

  isPointInWorldBounds(point, bounds) {
    return point.x >= bounds.left
      && point.x < bounds.right
      && point.y >= bounds.top
      && point.y < bounds.bottom;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.buildMode?.destroy?.();
    this.buildMode = null;
    this.wellOwner?.destroy?.();
    this.wellOwner = null;
    this.clearTransientVisuals();
    this.buildPlacedObjects?.clear?.();
    this.buildSurfaceVisuals?.clear?.();
    this.buildCarpetVisuals?.clear?.();
    this.buildWallJunctions?.clear?.();
    this.buildUndoStack = [];
    this.activeBuildAction = null;
  }
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
