import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_ASSET_GROUPS, BUILD_RESOURCE_ITEMS } from "../src/build/buildAssetCatalog.js";
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

const objectItems = BUILD_ASSET_GROUPS
  .flatMap((group) => group.items)
  .filter((item) => item.objectLike);
assert(objectItems.length > 0, "the build catalog exposes object-like placeables");
for (const item of objectItems) {
  assert(ownerIds.includes(placeableOwnerIdForItem(item)), `${item.id} has a registered placeable owner`);
}

assert.deepEqual(
  new Set(BUILD_RESOURCE_ITEMS.map((item) => item.resourceProfileId)),
  new Set(Object.keys(RESOURCE_PROFILES)),
  "every resource profile, including berry bushes, automatically enters the build catalog",
);
assert(BUILD_RESOURCE_ITEMS.some((item) => item.resourceProfileId === "berry-bush"));
assert(BUILD_RESOURCE_ITEMS.every((item) => item.placeableOwner === PLACEABLE_BUILD_OWNER_IDS.resource));

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
]) {
  assert(contractSource.includes(required), `placeable lifecycle contract retains ${required}`);
}

const ownerSource = fs.readFileSync(new URL("../src/build/placeableBuildOwners.js", import.meta.url), "utf8");
for (const required of [
  "removeState: false",
  "runtime.registerResource(current)",
  "getBedRuntimeGeometry",
  "getFacilityRuntimeGeometry",
]) {
  assert(ownerSource.includes(required), `placeable owners retain ${required}`);
}

const bootstrapSource = fs.readFileSync(new URL("../src/build/assetRuntimeConsistencyBootstrap.js", import.meta.url), "utf8");
assert(bootstrapSource.includes("installPlaceableBuildContract(scene, owners)"), "every mounted build-enabled location installs the placeable contract");

const systemSource = fs.readFileSync(new URL("../systems/build-and-authoring.md", import.meta.url), "utf8");
assert(systemSource.includes("place → move → remove → restore"));
assert(systemSource.includes("berry-bush"));

console.log("Task #072 contracts passed: every catalog placeable has a full lifecycle owner, resources auto-register, and visible geometry drives move/demolition targeting");
