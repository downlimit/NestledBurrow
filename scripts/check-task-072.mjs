import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUILD_ASSET_GROUPS,
  BUILD_FACILITY_ITEMS,
  BUILD_RESOURCE_ITEMS,
  BUILD_SPECIAL_ITEMS,
} from "../src/build/buildAssetCatalog.js";
import {
  ASSET_PROFILES_VERSION,
  DEFAULT_ASSET_PROFILES,
  normalizeAssetProfiles,
} from "../src/build/assetProfiles.js";
import { resolvePlaceablePlacementPose } from "../src/build/placeablePlacementPose.js";
import { FACILITY_ASSETS } from "../src/facilities/facilityConfig.js";
import {
  assertPlaceableOwnerAdapter,
  PLACEABLE_BUILD_OPERATIONS,
  PLACEABLE_BUILD_OWNER_IDS,
  placeableOwnerIdForItem,
  validatePlaceableCatalog,
} from "../src/build/placeableBuildProtocol.js";
import { resourceColliderAt, resourceVisualBoundsAt } from "../src/build/placeableBuildGeometry.js";
import { RESOURCE_PROFILES } from "../src/resources/resourceDomain.js";
import { TILE_SIZE } from "../src/world/worldConfig.js";

const ownerIds = Object.values(PLACEABLE_BUILD_OWNER_IDS);
assert(validatePlaceableCatalog(BUILD_ASSET_GROUPS, ownerIds));

const catalogItems = BUILD_ASSET_GROUPS.flatMap((group) => group.items);
const objectItems = catalogItems.filter((item) => item.objectLike);
assert(objectItems.length > 0, "the build catalog exposes object-like placeables");
for (const item of objectItems) {
  assert(ownerIds.includes(placeableOwnerIdForItem(item)), `${item.id} has a registered placeable owner`);
  assert(!String(item.labelKey).startsWith("hud:interaction."), `${item.id} uses an object name rather than an interaction verb`);
}

assert.deepEqual(
  new Set(BUILD_FACILITY_ITEMS.map((item) => item.facilityType)),
  new Set(Object.keys(FACILITY_ASSETS)),
  "every facility asset automatically enters the build library",
);
assert(BUILD_FACILITY_ITEMS.every((item) => item.placeableOwner === PLACEABLE_BUILD_OWNER_IDS.facility));
assert(BUILD_FACILITY_ITEMS.some((item) => item.facilityType === "serving-table"));
assert(BUILD_FACILITY_ITEMS.some((item) => item.facilityType === "lemon-sack"));
assert(BUILD_FACILITY_ITEMS.some((item) => item.facilityType === "juicer"));

assert.deepEqual(
  new Set(BUILD_RESOURCE_ITEMS.map((item) => item.resourceProfileId)),
  new Set(Object.keys(RESOURCE_PROFILES)),
  "every resource profile, including berry bushes, automatically enters the build library",
);
assert(BUILD_RESOURCE_ITEMS.some((item) => item.resourceProfileId === "berry-bush"));
assert(BUILD_RESOURCE_ITEMS.every((item) => item.placeableOwner === PLACEABLE_BUILD_OWNER_IDS.resource));

assert.deepEqual(
  new Set(BUILD_SPECIAL_ITEMS.map((item) => item.placeableOwner)),
  new Set([
    PLACEABLE_BUILD_OWNER_IDS.well,
    PLACEABLE_BUILD_OWNER_IDS.tavernSign,
    PLACEABLE_BUILD_OWNER_IDS.trainingDummy,
  ]),
  "well, tavern sign and training dummy are explicit build-library placeables",
);
for (const profileKey of ["farming:well", "facility:tavern-sign", "melee:training-dummy"]) {
  assert(DEFAULT_ASSET_PROFILES[profileKey], `${profileKey} has a canonical pivot/visual profile`);
}

const fullAdapter = {
  id: "synthetic",
  getTargetAt() {},
  isPlacementBlocked() {},
  place() {},
  move() {},
  remove() {},
  restore() {},
};
assert.equal(assertPlaceableOwnerAdapter(fullAdapter), fullAdapter);
for (const operation of PLACEABLE_BUILD_OPERATIONS) {
  assert.throws(
    () => assertPlaceableOwnerAdapter({ ...fullAdapter, [operation]: null }),
    new RegExp(operation),
    `a placeable owner cannot omit ${operation}`,
  );
}

const berry = RESOURCE_PROFILES["berry-bush"];
assert.deepEqual(resourceVisualBoundsAt({ x: 32, y: 48 }, berry), {
  left: 32,
  right: 48,
  top: 48,
  bottom: 64,
});
assert.deepEqual(resourceColliderAt({ x: 32, y: 48 }, berry), {
  left: 32,
  right: 48,
  top: 52,
  bottom: 64,
});
assert.deepEqual(resourceVisualBoundsAt({ x: 32, y: 48 }, RESOURCE_PROFILES["tree-planted"]), {
  left: 32,
  right: 32 + 3 * TILE_SIZE,
  top: 48,
  bottom: 48 + 4 * TILE_SIZE,
}, "tree targeting covers the visible composite sprite rather than only its trunk collider");

const pose = resolvePlaceablePlacementPose({
  assetProfiles: {
    "facility:tavern-sign": {
      snapAnchorOffset: { x: 3, y: 5 },
      visualOffset: { x: 7, y: -2 },
    },
  },
}, "facility:tavern-sign", { x: 100, y: 200 });
assert.deepEqual(pose.placementPosition, { x: 100, y: 200 });
assert.deepEqual(pose.pivotPosition, { x: 103, y: 205 });
assert.deepEqual(pose.visualPosition, { x: 107, y: 198 });

assert.equal(ASSET_PROFILES_VERSION, 4, "direct special-placeable pivot basis is a versioned profile migration");
const migratedSignProfile = normalizeAssetProfiles({
  version: 3,
  profiles: {
    "facility:tavern-sign": {
      snapAnchorOffset: { x: 17, y: 21 },
      visualOffset: { x: 4, y: -3 },
    },
  },
})["facility:tavern-sign"];
assert.deepEqual(migratedSignProfile.snapAnchorOffset, { x: 9, y: 13 }, "legacy sign pivot keeps the same world position after removing its hidden 8 px origin");
assert.deepEqual(migratedSignProfile.visualOffset, { x: 4, y: -3 });

const contractSource = fs.readFileSync(new URL("../src/build/placeableBuildContract.js", import.meta.url), "utf8");
for (const required of [
  "coordinator.getBuildMoveTarget =",
  "coordinator.getBuildDemolitionPreviewTarget =",
  "coordinator.applyBuildMove =",
  "coordinator.demolishBuildObject =",
  "coordinator.recordBuildUndo",
  "createPlaceableThumbnail",
  "Number(this.panel?.depth)",
  "decoratePlaceablePlacementAdapters",
]) {
  assert(contractSource.includes(required), `placeable lifecycle contract retains ${required}`);
}
assert(!contractSource.includes(".setDepth(9021)"), "placeable thumbnails cannot render below the HUD-depth build panel");

const poseSource = fs.readFileSync(new URL("../src/build/placeablePlacementPose.js", import.meta.url), "utf8");
for (const required of [
  "resolvePlaceablePlacementPose",
  "pose.visualPosition",
  "pose.pivotOffset",
  "renderTavernSignPreview",
  "renderWellPreview",
  "renderTrainingDummyPreview",
]) {
  assert(poseSource.includes(required), `preview/commit pose retains ${required}`);
}

const ownerSource = fs.readFileSync(new URL("../src/build/placeableBuildOwners.js", import.meta.url), "utf8");
for (const required of [
  "removeState: false",
  "persistedIds",
  "runtime.registerResource(current)",
  "getBedRuntimeGeometry",
  "getFacilityRuntimeGeometry",
  "createTavernSignAdapter",
  "createTrainingDummyAdapter",
]) {
  assert(ownerSource.includes(required), `placeable owners retain ${required}`);
}

const signSource = fs.readFileSync(new URL("../src/tavern/tavernSignRuntime.js", import.meta.url), "utf8");
for (const required of [
  "placeBuildTarget",
  "removeBuildTarget",
  "restoreBuildTarget",
  "isBuildPlacementBlocked",
  "visualPositionAt",
  "assetDepthFromPivot(position, pivot",
]) {
  assert(signSource.includes(required), `tavern sign runtime retains ${required}`);
}

const facilitySource = fs.readFileSync(new URL("../src/facilities/facilityConfig.js", import.meta.url), "utf8");
assert(!facilitySource.includes("editable: false"), "canonical facilities are removable and movable through build mode");

const authoringSource = fs.readFileSync(new URL("../src/build/universalPlaceableAuthoring.js", import.meta.url), "utf8");
for (const required of [
  "runtime.selectPivotAt =",
  "runtime.selectVisualOffsetAt =",
  "wellInstances",
  "tavernSignInstances",
  "trainingDummyInstances",
  "canonicalVisualOffsetAtCurrentPivot",
  "syncSpecialInstances",
  "installAuthoringCanonExport",
]) {
  assert(authoringSource.includes(required), `universal authoring retains ${required}`);
}
assert(!authoringSource.includes("DEFAULT_ASSET_PROFILES[visualSelection.profileKey]?.visualOffset"));
assert(!authoringSource.includes("state.position.x - TAVERN_SIGN.snapAnchorOffset.x"), "sign authoring cannot revive a hidden profile origin");

const exportSource = fs.readFileSync(new URL("../src/build/authoringCanonExport.js", import.meta.url), "utf8");
assert(exportSource.includes("Сохранить и выгрузить канон объектов"));
assert(exportSource.includes("createLiveAuthoringCanon"));
const backupSource = fs.readFileSync(new URL("../src/build/authoringBackup.js", import.meta.url), "utf8");
for (const required of ["captureStartingLayout(scene)", "scene.colliderOverrides", "scene.assetProfiles", "AUTHORING_CANON_FILENAME"]) {
  assert(backupSource.includes(required), `live canon export retains ${required}`);
}

const bootstrapSource = fs.readFileSync(new URL("../src/build/assetRuntimeConsistencyBootstrap.js", import.meta.url), "utf8");
assert(bootstrapSource.includes("installPlaceableBuildContract(scene, owners)"), "every mounted build-enabled location installs the placeable contract");
assert(bootstrapSource.includes("installUniversalPlaceableAuthoring(scene?.movementDebugPanel, scene)"), "every authoring panel installs the universal placeable registry");

const systemSource = fs.readFileSync(new URL("../systems/build-and-authoring.md", import.meta.url), "utf8");
assert(systemSource.includes("place → move → remove → restore"));
assert(systemSource.includes("berry-bush"));
assert(systemSource.includes("authoring selection"));
assert(systemSource.includes("preview and commit"));
assert(systemSource.includes("authoring-canon.json"));

console.log("Task #072 contracts passed: every placeable has full lifecycle, exact preview/commit pose, current geometry, universal authoring and complete canon export");
