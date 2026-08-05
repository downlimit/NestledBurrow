import assert from "node:assert/strict";
import fs from "node:fs";
import {
  BUILD_ASSET_GROUPS,
  BUILD_FACILITY_ITEMS,
  BUILD_RESOURCE_ITEMS,
  BUILD_SPECIAL_ITEMS,
} from "../src/build/buildAssetCatalog.js";
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

const contractSource = fs.readFileSync(new URL("../src/build/placeableBuildContract.js", import.meta.url), "utf8");
for (const required of [
  "coordinator.getBuildMoveTarget =",
  "coordinator.getBuildDemolitionPreviewTarget =",
  "coordinator.applyBuildMove =",
  "coordinator.demolishBuildObject =",
  "coordinator.recordBuildUndo",
  "createPlaceableThumbnail",
  "Number(this.panel?.depth)",
]) {
  assert(contractSource.includes(required), `placeable lifecycle contract retains ${required}`);
}
assert(!contractSource.includes(".setDepth(9021)"), "placeable thumbnails cannot render below the HUD-depth build panel");

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
for (const required of ["placeBuildTarget", "removeBuildTarget", "restoreBuildTarget", "isBuildPlacementBlocked"]) {
  assert(signSource.includes(required), `tavern sign runtime retains ${required}`);
}

const facilitySource = fs.readFileSync(new URL("../src/facilities/facilityConfig.js", import.meta.url), "utf8");
assert(!facilitySource.includes("editable: false"), "canonical facilities are removable and movable through build mode");

const bootstrapSource = fs.readFileSync(new URL("../src/build/assetRuntimeConsistencyBootstrap.js", import.meta.url), "utf8");
assert(bootstrapSource.includes("installPlaceableBuildContract(scene, owners)"), "every mounted build-enabled location installs the placeable contract");

const systemSource = fs.readFileSync(new URL("../systems/build-and-authoring.md", import.meta.url), "utf8");
assert(systemSource.includes("place → move → remove → restore"));
assert(systemSource.includes("berry-bush"));

console.log("Task #072 contracts passed: the build library contains every facility, special object and resource with names, visible thumbnails and a full lifecycle owner");
