import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ASSET_PROFILES_SAVE_ENDPOINT,
  ASSET_PROFILES_STORAGE_KEY,
  ASSET_PROFILES_VERSION,
  createAssetProfilesDefaultModuleSource,
  normalizeAssetProfiles,
  saveAssetProfilesToProject,
} from "../src/build/assetProfiles.js";
import {
  authoringArrowDelta,
  createAuthoringArrowEvent,
  toAuthoringArrowKey,
} from "../src/build/assetAuthoringInput.js";
import {
  normalizeBedDefinitionToGrid,
  normalizeFacilityDefinitionToGrid,
  roundColliderToAssetFootprint,
  snapAssetPlacementFromAnchor,
  snapAssetPlacementPoint,
} from "../src/build/assetGridPlacement.js";
import {
  hydrateFacilityRuntimeDefinition,
  liveFacilityGeometry,
  liveFacilityPresentationPose,
  livePlaceableInteraction,
  PLACEABLE_TARGETING_GROUP,
} from "../src/build/liveAssetGeometry.js";
import { normalizeStartingLayout } from "../src/build/startingLayout.js";
import { applyVisualCrop } from "../src/build/assetVisualCrop.js";
import { COLLIDER_DEBUG_STORAGE_KEY } from "../src/build/colliderDebugOverrides.js";
import { editRectDraftByArrow, roundColliderDraftToGrid } from "../src/build/colliderResize.js";
import { createInteractionTarget, findBestInteractionTarget } from "../src/interaction/interaction.js";
import {
  filterPerimeterInteractionPoints,
  interactionFootprintBounds,
  perimeterInteractionPointEntries,
} from "../src/interaction/interactionApproach.js";
import { INTERACTION_APPROACH_DIRECTIONS } from "../src/interaction/interactionDirections.js";

function createStorage() {
  return {
    values: new Map(),
    getItem(key) { return this.values.get(key) ?? null; },
    setItem(key, value) { this.values.set(key, value); },
    removeItem(key) { this.values.delete(key); },
  };
}

assert.deepEqual(
  roundColliderDraftToGrid({ left: 5, right: 17, top: 3, bottom: 15 }, 16, 2),
  { left: 2, right: 14, top: 2, bottom: 14 },
  "one-cell collider snaps to the nearest cell centre with a 2 px wall padding",
);
assert.deepEqual(
  roundColliderDraftToGrid({ left: 11, right: 39, top: 18, bottom: 46 }, 16, 2),
  { left: 18, right: 46, top: 18, bottom: 46 },
  "a roughly two-cell collider keeps the nearest two-cell span and the same perimeter padding",
);
assert.deepEqual(
  roundColliderToAssetFootprint({ left: 34, right: 46, top: 50, bottom: 62 }, 16, 2),
  { left: 34, right: 46, top: 50, bottom: 62 },
  "rounding follows the currently authored collider edges rather than an immutable base rectangle",
);
assert.deepEqual(
  roundColliderToAssetFootprint({ left: 18, right: 46, top: 18, bottom: 30 }, 16, 2),
  { left: 18, right: 46, top: 18, bottom: 30 },
  "a two-cell authored collider keeps its described span and fixed wall padding",
);
assert.deepEqual(
  roundColliderToAssetFootprint({ left: 20, right: 43, top: 19, bottom: 31 }, 16, 2),
  { left: 18, right: 46, top: 18, bottom: 30 },
  "each live collider edge snaps to the nearest full-cell boundary before padding is restored",
);

const rect = { left: 10, right: 20, top: 30, bottom: 40 };
assert.deepEqual(
  editRectDraftByArrow(rect, { key: "ArrowRight", ctrlKey: true }),
  { left: 10, right: 21, top: 30, bottom: 40 },
  "Ctrl+Right expands the right edge by one pixel",
);
assert.deepEqual(
  editRectDraftByArrow(rect, { key: "ArrowRight", altKey: true }),
  { left: 11, right: 20, top: 30, bottom: 40 },
  "Alt+Right shrinks from the left edge by one pixel",
);
assert.deepEqual(
  editRectDraftByArrow(rect, { key: "ArrowUp" }),
  { left: 10, right: 20, top: 29, bottom: 39 },
  "an unmodified arrow translates the complete rectangle by one pixel",
);
assert.deepEqual(
  editRectDraftByArrow({ left: 0, right: 1, top: 0, bottom: 1 }, { key: "ArrowRight", altKey: true }),
  { left: 0, right: 1, top: 0, bottom: 1 },
  "a shrink hotkey cannot collapse the rectangle below one pixel",
);
assert.equal(toAuthoringArrowKey("w"), "ArrowUp", "W maps to the same editor action as ArrowUp");
assert.equal(toAuthoringArrowKey("A"), "ArrowLeft", "WASD mapping is case-insensitive");
assert.deepEqual(authoringArrowDelta("d"), { x: 1, y: 0 }, "D performs the same one-pixel nudge as ArrowRight");
const russianLayoutWasd = createAuthoringArrowEvent({ code: "KeyW", key: "ц" });
assert.equal(russianLayoutWasd?.key, "ArrowUp", "physical WASD remains valid under a non-Latin keyboard layout");
assert.deepEqual(
  editRectDraftByArrow(rect, russianLayoutWasd),
  { left: 10, right: 20, top: 29, bottom: 39 },
  "WASD edits volumes through the same one-pixel contract as arrow keys",
);

assert.deepEqual(
  snapAssetPlacementPoint({ x: 23, y: 39 }, 16),
  { x: 16, y: 32 },
  "placeable assets store their top-left placement on the tile grid",
);
assert.deepEqual(
  snapAssetPlacementFromAnchor({ x: 43, y: 39 }, { x: 11, y: 7 }, 16),
  { x: 32, y: 32 },
  "catalog placement subtracts the current pivot/collider midpoint before snapping the footprint",
);
assert.deepEqual(
  snapAssetPlacementFromAnchor({ x: 43, y: 39 }, { x: 3, y: 7 }, 16),
  { x: 48, y: 32 },
  "changing the authored anchor immediately changes cursor attachment without cached pivots",
);
const normalizedFacility = normalizeFacilityDefinitionToGrid({
  id: "legacy-shower",
  footprint: { x: 23, y: 39, width: 32, height: 32 },
  visual: { x: 23, y: 39, width: 32, height: 32 },
  position: { x: 31, y: 47 },
  usePosition: { x: 63, y: 55 },
  presentationPose: { x: 39, y: 55, facing: "down", depth: 572 },
});
assert.deepEqual(normalizedFacility.footprint, { x: 16, y: 32, width: 32, height: 32 });
assert.deepEqual(normalizedFacility.visual, { x: 16, y: 32, width: 32, height: 32 });
assert.deepEqual(normalizedFacility.position, { x: 24, y: 40 });
assert.deepEqual(normalizedFacility.usePosition, { x: 56, y: 48 });
const normalizedBed = normalizeBedDefinitionToGrid({
  id: "legacy-bed",
  position: { x: 31, y: 43 },
  wakePosition: { x: 31, y: 59 },
  usePosition: { x: 31, y: 59 },
  aimPosition: { x: 31, y: 43 },
  presentationPose: { x: 31, y: 42, angle: -90 },
});
assert.deepEqual(normalizedBed.position, { x: 24, y: 40 }, "bed stores only its grid-aligned placement centre");
assert.equal("wakePosition" in normalizedBed, false, "legacy wake positions are removed rather than shifted forward");
assert.equal("usePosition" in normalizedBed, false, "bed approach positions are runtime-derived");
assert.equal("aimPosition" in normalizedBed, false, "bed aim positions are runtime-derived");
assert.equal("presentationPose" in normalizedBed, false, "bed timeline poses are runtime-derived");

const migratedLayout = normalizeStartingLayout({
  version: 1,
  nextBuildObjectId: 0,
  removedCanonicalFloors: [],
  removedCanonicalWalls: [],
  buildObjects: [],
  furniture: [],
  facilities: [{
    id: "legacy-bath",
    facilityType: "shower",
    footprint: { x: 32, y: 48, width: 32, height: 32 },
    visual: { x: 32, y: 48, width: 32, height: 32 },
    position: { x: 999, y: 999 },
    usePosition: { x: 998, y: 998 },
    aimPosition: { x: 997, y: 997 },
    presentationPose: { x: 996, y: 996 },
  }],
  beds: [{
    id: "legacy-bed",
    position: { x: 24, y: 40 },
    wakePosition: { x: 900, y: 900 },
    presentationPose: { x: 901, y: 901 },
  }],
});
for (const field of ["position", "usePosition", "aimPosition", "presentationPose"]) {
  assert.equal(field in migratedLayout.facilities[0], false, `canonical facilities discard ${field}`);
}
assert.equal("wakePosition" in migratedLayout.beds[0], false, "canonical beds discard wakePosition");
assert.equal("presentationPose" in migratedLayout.beds[0], false, "canonical beds discard presentationPose");

const hydratedBath = hydrateFacilityRuntimeDefinition(migratedLayout.facilities[0]);
assert.deepEqual(hydratedBath.position, { x: 48, y: 64 }, "runtime hydration derives the facility centre from footprint");
assert.deepEqual(hydratedBath.usePosition, { x: 72, y: 72 }, "runtime hydration derives a current service point and cannot revive an old authored value");
const bathGeometry = liveFacilityGeometry(
  hydratedBath,
  { visualOffset: { x: 64, y: -16 }, snapAnchorOffset: { x: 7, y: 9 } },
  { left: 96, right: 128, top: 80, bottom: 112 },
);
assert.deepEqual(bathGeometry.visualCenter, { x: 112, y: 48 }, "facility visual centre follows the current visual offset");
assert.deepEqual(bathGeometry.interactionCenter, { x: 112, y: 96 }, "facility aim follows the current effective collider");
const bathPose = liveFacilityPresentationPose(hydratedBath, bathGeometry);
assert.deepEqual({ x: bathPose.x, y: bathPose.y }, { x: 112, y: 48 }, "facility timeline pose follows live visual geometry");
const bathInteraction = livePlaceableInteraction(hydratedBath, bathGeometry);
assert.deepEqual(bathInteraction.position, { x: 112, y: 96 });
assert.deepEqual(bathInteraction.aimPosition, { x: 112, y: 96 });
assert.equal(bathInteraction.targetingMode, "facing-first");
assert.equal(bathInteraction.targetingGroup, PLACEABLE_TARGETING_GROUP);
assert.equal(bathInteraction.requiresFacing, false);

const sourceSnapshot = { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } };
const bedTarget = createInteractionTarget({
  id: "bed", entityId: "bed", kind: "sleep-bed", position: { x: 20, y: 0 }, aimPosition: { x: 20, y: 0 },
  radius: 50, priority: 21, requiresFacing: false, facingDotThreshold: -1,
  targetingMode: "facing-first", targetingGroup: PLACEABLE_TARGETING_GROUP,
  prompt: "sleep", payload: {},
});
const toiletTarget = createInteractionTarget({
  id: "toilet", entityId: "toilet", kind: "use-facility", position: { x: 0, y: 16 }, aimPosition: { x: 0, y: 16 },
  radius: 50, priority: 20, requiresFacing: false, facingDotThreshold: -1,
  targetingMode: "facing-first", targetingGroup: PLACEABLE_TARGETING_GROUP,
  prompt: "toilet", payload: {},
});
assert.equal(findBestInteractionTarget(sourceSnapshot, [bedTarget, toiletTarget])?.entityId, "bed", "looking at the bed selects the bed");
assert.equal(findBestInteractionTarget({ ...sourceSnapshot, facingDirection: { x: 0, y: 1 } }, [bedTarget, toiletTarget])?.entityId, "toilet", "looking at the toilet selects the toilet despite bed priority");

const cellBounds = { left: 16, right: 32, top: 32, bottom: 48 };
const entries = perimeterInteractionPointEntries(cellBounds, 16);
assert.equal(entries.length, 8, "a one-cell object exposes exactly eight surrounding approach cells");
assert.deepEqual(
  [...new Set(entries.map(({ direction }) => direction))].sort(),
  [...INTERACTION_APPROACH_DIRECTIONS].sort(),
  "the eight approach directions use the canonical direction set",
);
assert.deepEqual(
  filterPerimeterInteractionPoints(cellBounds, ["top", "bottom"], 16),
  [{ x: 24, y: 24 }, { x: 24, y: 56 }],
  "disabled directions are removed from the exact approach-point set",
);
const paddedCollider = { left: 18, right: 30, top: 34, bottom: 46 };
assert.deepEqual(
  interactionFootprintBounds(paddedCollider, 16),
  { left: 16, right: 32, top: 32, bottom: 48 },
  "interaction cells derive from the occupied grid footprint rather than the padded collider corner",
);
assert.deepEqual(
  filterPerimeterInteractionPoints(paddedCollider, ["top-left", "top", "top-right"], 16),
  [{ x: 8, y: 24 }, { x: 24, y: 24 }, { x: 40, y: 24 }],
  "approach markers sit at surrounding cell centres",
);

const cropCalls = [];
const cropImage = {
  x: 0,
  y: 0,
  frame: { realWidth: 16, realHeight: 20 },
  setCrop(...args) { cropCalls.push(["crop", ...args]); },
  resetCrop() { cropCalls.push(["reset"]); },
};
const cropResult = applyVisualCrop({ spriteImage: cropImage }, { left: 1, right: 2, top: 3, bottom: 4 });
assert.equal(cropResult.supported, true);
assert.deepEqual(cropResult.visibleBounds, { left: 1, right: 14, top: 3, bottom: 16 });
assert.deepEqual(cropCalls, [["crop", 1, 3, 13, 13]], "crop insets become one exact sprite source rectangle");

const profiles = normalizeAssetProfiles({
  version: ASSET_PROFILES_VERSION,
  profiles: {
    "facility:toilet": {
      visualCropInsets: { left: 1, right: 2, top: 3, bottom: 4 },
      interactionDirections: ["bottom"],
    },
  },
});
assert.deepEqual(profiles["facility:toilet"].visualCropInsets, { left: 1, right: 2, top: 3, bottom: 4 });
assert.deepEqual(profiles["facility:toilet"].interactionDirections, ["bottom"]);
assert.equal(profiles["facility:toilet"].family, "facility");
const source = createAssetProfilesDefaultModuleSource(profiles);
assert(source.startsWith("// Generated by the in-game asset profile editor."));
assert(source.includes('"interactionDirections"'));
assert(source.includes('"visualCropInsets"'));

const facilityVisualSource = readFileSync("src/facilities/facilityPreviewVisuals.js", "utf8");
const interactionApproachSource = readFileSync("src/interaction/interactionApproach.js", "utf8");
const gridAuthoringSource = readFileSync("src/build/assetGridAuthoringBootstrap.js", "utf8");
const runtimeConsistencySource = readFileSync("src/build/assetRuntimeConsistencyBootstrap.js", "utf8");
const liveGeometrySource = readFileSync("src/build/liveAssetGeometry.js", "utf8");
const startingLayoutSource = readFileSync("src/build/startingLayout.js", "utf8");
const indexSource = readFileSync("index.html", "utf8");
assert(facilityVisualSource.includes("applyVisualCrop"), "canonical crop applies when normal runtime visuals are created");
assert(interactionApproachSource.includes("assetProfilesDefault.js"), "canonical approach masks apply without opening the debug panel");
assert(gridAuthoringSource.includes("GRID_OVERLAY_ALPHA = 0.4"), "collider volumes are rendered at forty percent of their previous layer opacity");
assert(gridAuthoringSource.includes("stopPlayerMotion"), "active authoring keyboard input explicitly stops player motion");
assert(gridAuthoringSource.includes("roundColliderToAssetFootprint(selection.draft"), "rounding consumes the live edited collider draft");
assert(gridAuthoringSource.includes("snapAssetPlacementFromAnchor(raw, anchorOffset"), "catalog placement uses the freshly computed current anchor");
assert(gridAuthoringSource.includes("removeItem?.(COLLIDER_DEBUG_STORAGE_KEY)"), "legacy collider duplicates are discarded after migration and editing");
assert(runtimeConsistencySource.includes("this.active || this.gridEnabled"), "the construction grid remains visible while build mode is active");
assert(runtimeConsistencySource.includes("patchFacilityRuntime"), "facility interactions and poses use the live geometry adapter");
assert(runtimeConsistencySource.includes("WorldLocationRuntime.prototype.mount"), "live geometry installs before canonical layout restore and interaction binding");
assert(liveGeometrySource.includes("FACILITY_DERIVED_FIELDS"), "facility derived coordinates have one explicit removal contract");
assert(liveGeometrySource.includes('targetingMode: "facing-first"'), "placeable selection follows the player aim before priority");
assert(startingLayoutSource.includes("canonicalFacilityDefinition"), "canonical layout strips runtime-only facility coordinates");
assert(startingLayoutSource.includes("hydrateFacilityRuntimeDefinition"), "layout restore recreates temporary runtime geometry from footprint");
assert(indexSource.includes("assetRuntimeConsistencyBootstrap.js"), "runtime consistency patches load before the world scene");

const storage = createStorage();
storage.setItem(COLLIDER_DEBUG_STORAGE_KEY, "legacy-offsets");
const requests = [];
await saveAssetProfilesToProject(profiles, {
  storage,
  baseUrl: "/NestledBurrow/",
  fetchImpl: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, text: async () => "" };
  },
});
assert.equal(requests[0].url, `/NestledBurrow/${ASSET_PROFILES_SAVE_ENDPOINT}`);
assert.equal(requests[0].options.method, "POST");
assert.equal(JSON.parse(requests[0].options.body).version, ASSET_PROFILES_VERSION);
assert.equal(storage.getItem(ASSET_PROFILES_STORAGE_KEY), null, "canonical save clears the browser asset-profile draft");
assert.equal(storage.getItem(COLLIDER_DEBUG_STORAGE_KEY), null, "canonical save clears stale legacy collider offsets");

const failedStorage = createStorage();
await assert.rejects(() => saveAssetProfilesToProject(profiles, {
  storage: failedStorage,
  fetchImpl: async () => ({ ok: false, status: 404, text: async () => "static host" }),
}), (error) => error.localSaved === true && /static host/.test(error.message));
assert(failedStorage.getItem(ASSET_PROFILES_STORAGE_KEY), "static hosting keeps a recoverable browser draft");

console.log("Task #071 contracts passed: live facility/bed targeting, runtime-only poses, canonical layout stripping and authoring profiles");
