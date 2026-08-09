import assert from "node:assert/strict";
import {
  ASSET_PROFILES_STORAGE_KEY,
  ASSET_PROFILES_VERSION,
  DEFAULT_ASSET_PROFILES,
  normalizeAssetProfiles,
  saveAssetProfiles,
} from "../src/build/assetProfiles.js";
import { AUTHORING_BACKUP_VERSION, normalizeAuthoringBackup } from "../src/build/authoringBackup.js";
import {
  WALL_COLLIDER_GROUPS,
  applyColliderOffsets,
  assetDepthFromPivot,
  createPlacementDragState,
  hasIncidentWall,
  isWallPlacementBlocked,
  migrateDirectionalWallOverrides,
  placementMidpointOffset,
  resolvePlacementDrag,
  snapPlacementPoint,
} from "../src/build/buildWorldGeometry.js";
import { createFacilityRuntime } from "../src/facilities/facilityRuntime.js";
import { attachEditorAuthoringRuntime } from "../src/build/editorAuthoringRuntime.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import { TILE_SIZE } from "../src/world/worldConfig.js";

const legacyWall = { left: -1, right: 2, top: 3, bottom: -4 };
const migratedWalls = migrateDirectionalWallOverrides({
  [WALL_COLLIDER_GROUPS.legacy]: legacyWall,
  [WALL_COLLIDER_GROUPS.horizontal]: { left: 7, right: 0, top: 0, bottom: 0 },
});
assert.deepEqual(migratedWalls[WALL_COLLIDER_GROUPS.horizontal], { left: 7, right: 0, top: 0, bottom: 0 });
assert.deepEqual(migratedWalls[WALL_COLLIDER_GROUPS.vertical], legacyWall);
assert.equal(migratedWalls[WALL_COLLIDER_GROUPS.legacy], undefined, "legacy wall overrides migrate into independent directional groups");

const layout = createWorldLayout();
const horizontalWall = layout.getWorldObjectColliders().find((entry) => entry.groupKey === WALL_COLLIDER_GROUPS.horizontal);
const verticalWall = layout.getWorldObjectColliders().find((entry) => entry.groupKey === WALL_COLLIDER_GROUPS.vertical);
const verticalBefore = { ...verticalWall.rect };
layout.setColliderOverride(WALL_COLLIDER_GROUPS.horizontal, { left: 0, right: 0, top: 1, bottom: -1 });
assert.equal(layout.getWorldObjectColliders().find((entry) => entry.id === horizontalWall.id).rect.top, horizontalWall.base.top + 1);
assert.deepEqual(layout.getWorldObjectColliders().find((entry) => entry.id === verticalWall.id).rect, verticalBefore, "horizontal authoring leaves vertical wall colliders unchanged");
const horizontalAfter = { ...layout.getWorldObjectColliders().find((entry) => entry.id === horizontalWall.id).rect };
layout.setColliderOverride(WALL_COLLIDER_GROUPS.vertical, { left: 1, right: -1, top: 0, bottom: 0 });
assert.deepEqual(layout.getWorldObjectColliders().find((entry) => entry.id === horizontalWall.id).rect, horizontalAfter, "vertical authoring leaves horizontal wall colliders unchanged");

const base = { left: 700, right: 732, top: 400, bottom: 432 };
const offsets = { left: 1, right: -2, top: 16, bottom: 0 };
layout.setColliderOverride("facility:synthetic", offsets);
layout.setWorldObjectCollider("synthetic", base, "facility:synthetic");
assert.deepEqual(layout.getResourceCollider("synthetic"), applyColliderOffsets(base, offsets));
layout.setColliderOverride("facility:synthetic", offsets);
assert.deepEqual(layout.getResourceCollider("synthetic"), applyColliderOffsets(base, offsets), "profile offsets are reapplied from canonical bounds without doubling");

class DisplayStub {
  setOrigin() { return this; }
  setDepth() { return this; }
  setVisible() { return this; }
  setPosition() { return this; }
  destroy() {}
}
const profiles = normalizeAssetProfiles({
  "facility:gas-stove": { colliderOffsets: { left: 0, right: 0, top: 16, bottom: 0 } },
});
const placementChecks = [];
const registrations = new Map();
const facilityWorld = {
  getEffectiveCollider(rect, groupKey) {
    return applyColliderOffsets(rect, profiles[groupKey]?.colliderOffsets);
  },
  isBlockedBox(rect) { placementChecks.push({ ...rect }); return false; },
  setWorldObjectCollider(id, rect, groupKey) { registrations.set(id, { rect: { ...rect }, groupKey }); },
  clearWorldObjectCollider(id) { registrations.delete(id); },
};
const facilityRuntime = createFacilityRuntime({ assetProfiles: profiles, add: {
  graphics: () => new DisplayStub(),
  image: () => new DisplayStub(),
} }, { worldLayout: facilityWorld });
const stove = facilityRuntime.add("gas-stove", { x: 640, y: 400 });
assert(stove);
assert(placementChecks.some((rect) => rect.left === 640 && rect.top === 416 && rect.bottom === 432), "facility placement validates the edited effective collider");
assert.deepEqual(registrations.get(stove.id), {
  rect: { left: 640, right: 656, top: 400, bottom: 432 },
  groupKey: "facility:gas-stove",
}, "registration retains one canonical collider source for future profile edits");
facilityRuntime.destroy();

const vertical = { x: 32, y: 32, orientation: "vertical" };
const verticalCollider = { left: 30, right: 34, top: 32, bottom: 48 };
const joinedWalls = [
  { rect: { left: 16, right: 32, top: 30, bottom: 34 }, wallEdge: { x: 16, y: 32, orientation: "horizontal" } },
  { rect: { left: 32, right: 48, top: 46, bottom: 50 }, wallEdge: { x: 32, y: 48, orientation: "horizontal" } },
];
assert.equal(isWallPlacementBlocked({ edge: vertical, collider: verticalCollider, colliders: joinedWalls, tileSize: TILE_SIZE }), false, "perpendicular walls may join at both candidate endpoints");
assert.equal(isWallPlacementBlocked({
  edge: vertical,
  collider: verticalCollider,
  colliders: [{ rect: { left: 24, right: 40, top: 38, bottom: 42 }, wallEdge: { x: 24, y: 40, orientation: "horizontal" } }],
  tileSize: TILE_SIZE,
}), true, "an incompatible wall crossing through the candidate interior stays blocked");
assert.equal(isWallPlacementBlocked({
  edge: vertical,
  collider: verticalCollider,
  colliders: [{ rect: { left: 31, right: 33, top: 31, bottom: 33 }, wallNode: { x: 32, y: 32 } }],
  tileSize: TILE_SIZE,
}), false, "an existing explicit node is a compatible endpoint junction");
assert.equal(hasIncidentWall({ north: false, east: true, south: false, west: false }), true);
assert.equal(hasIncidentWall({ north: false, east: false, south: false, west: false }), false, "standalone nodes remain valid only at free topology vertices");

const drag = createPlacementDragState({
  placementPosition: { x: 160, y: 96 },
  pointer: { x: 174, y: 103 },
  snapAnchorOffset: { x: 2, y: -1 },
});
const dragPreview = resolvePlacementDrag(drag, { x: 206, y: 119 }, TILE_SIZE);
const dragCommit = resolvePlacementDrag(drag, { x: 206, y: 119 }, TILE_SIZE);
assert.deepEqual(drag.pointerOffset, { x: 14, y: 7 });
assert.deepEqual(dragPreview, dragCommit, "move preview and commit share the same transform");
assert(Math.abs((dragPreview.x + drag.pointerOffset.x) - 206) < TILE_SIZE / 2, "the grabbed asset edge stays near the pointer after grid snapping");

const midpointOffset = placementMidpointOffset({
  placementPosition: { x: 0, y: 0 },
  pivotOffset: { x: 8, y: 16 },
  effectiveCollider: { left: 2, right: 18, top: 4, bottom: 20 },
});
assert.deepEqual(midpointOffset, { x: 9, y: 14 }, "new-object drag anchor is midway between the pivot and effective collider center");
const midpointPlacement = snapPlacementPoint({ x: 81, y: 95 }, midpointOffset, TILE_SIZE);
assert.deepEqual(midpointPlacement, { x: 71, y: 82 });
assert.deepEqual(
  { x: midpointPlacement.x + midpointOffset.x, y: midpointPlacement.y + midpointOffset.y },
  { x: 80, y: 96 },
  "the midpoint anchor follows the nearest grid point under the pointer",
);
const assetDepth = assetDepthFromPivot({ x: 100, y: 200 }, { x: 8, y: 12 });
assert(500 + 211 < assetDepth && 500 + 213 > assetDepth, "the player crosses the asset depth exactly at the authored pivot Y");

const legacyProfiles = normalizeAssetProfiles({
  "facility:table": { visualOffset: { x: 3, y: -1 }, colliderOffsets: { left: 1, right: 0, top: 0, bottom: 0 } },
});
const canonicalTablePivot = DEFAULT_ASSET_PROFILES["facility:table"].snapAnchorOffset;
assert.deepEqual(legacyProfiles["facility:table"].snapAnchorOffset, canonicalTablePivot, "legacy profile payloads gain the current canonical depth pivot");
const storage = { value: null, setItem(key, value) { if (key === ASSET_PROFILES_STORAGE_KEY) this.value = value; } };
saveAssetProfiles(legacyProfiles, storage);
assert.equal(JSON.parse(storage.value).version, ASSET_PROFILES_VERSION, "profile saves use the migrated version in the existing storage key");
const backup = normalizeAuthoringBackup({
  version: 2,
  savedAt: "2026-07-27T12:00:00.000Z",
  colliderOverrides: { [WALL_COLLIDER_GROUPS.legacy]: legacyWall },
  assetProfiles: legacyProfiles,
});
assert.equal(backup.version, AUTHORING_BACKUP_VERSION);
assert.deepEqual(backup.assetProfiles["facility:table"].snapAnchorOffset, canonicalTablePivot);
assert.deepEqual(backup.colliderOverrides[WALL_COLLIDER_GROUPS.horizontal], legacyWall);
assert.deepEqual(backup.colliderOverrides[WALL_COLLIDER_GROUPS.vertical], legacyWall, "v2 backups migrate both wall directions and the new anchor field");

const visualTarget = { x: 100, y: 200, setPosition(x, y) { this.x = x; this.y = y; return this; }, setDepth() { return this; } };
const visualProfiles = normalizeAssetProfiles();
const visualCollider = { left: 100, right: 148, top: 200, bottom: 216 };
const visualBuildCoordinator = {
  getPlacedObjects: () => [],
  getPlacedObject: () => null,
  placeBuildAsset: () => ({ status: "ignored" }),
};
const visualFacilityRuntime = {
  getAuthoringInstances: () => [{
    id: "table-visual",
    profileKey: "facility:table",
    anchor: { x: 100, y: 200 },
    bounds: visualCollider,
    targets: [visualTarget],
  }],
  applyAuthoringVisualOffset(_profileKey, offset) { visualTarget.setPosition(100 + offset.x, 200 + offset.y); },
  syncKitchenVisuals() {},
};
const visualScene = {
  assetProfiles: visualProfiles,
  colliderOverrides: {},
  worldLocationRuntime: {
    getOwners: () => ({
      worldBuildCoordinator: visualBuildCoordinator,
      facilityRuntime: visualFacilityRuntime,
    }),
  },
  sessionState: { gameplay: { resourceNodes: {} } },
  worldLayout: {
    setColliderOverride() {},
    getWorldObjectColliders: () => [{ id: "table-visual", rect: visualCollider }],
  },
};
const authoringRuntime = attachEditorAuthoringRuntime(visualScene, { storage: null });
const pivotBeforeVisualMove = { ...visualScene.assetProfiles["facility:table"].snapAnchorOffset };
assert(authoringRuntime.selectVisualOffsetAt({ x: 110, y: 205 }));
const visualSelection = authoringRuntime.setVisualOffset({ x: 5, y: -3 });
assert.deepEqual(visualSelection.offset, { x: 5, y: -3 });
assert.deepEqual({ x: visualTarget.x, y: visualTarget.y }, { x: 105, y: 197 }, "visual-offset editing moves only the rendered target");
assert.deepEqual(visualScene.assetProfiles["facility:table"].snapAnchorOffset, pivotBeforeVisualMove, "visual-offset editing preserves the authored pivot");
assert.deepEqual(visualScene.worldLayout.getWorldObjectColliders()[0].rect, visualCollider, "visual-offset editing preserves collision geometry");
assert.deepEqual(authoringRuntime.nudgeVisualOffset(-1, 1).offset, { x: 4, y: -2 }, "visual-offset arrow nudging moves exactly one pixel per axis");
assert.deepEqual(authoringRuntime.resetVisualOffset().offset, { x: 0, y: 0 }, "visual offset resets to the profile default");
assert(authoringRuntime.selectPivotAt({ x: 110, y: 205 }));
assert.deepEqual(authoringRuntime.nudgePivot(1, -1).offset, {
  x: pivotBeforeVisualMove.x + 1,
  y: pivotBeforeVisualMove.y - 1,
}, "pivot arrow nudging moves exactly one pixel per axis");
authoringRuntime.destroy();

console.log("Task #044 contracts passed: directional walls, effective colliders, pivot depth, visual offsets, midpoint placement, topology joins, implicit drag anchors, and profile migrations");
