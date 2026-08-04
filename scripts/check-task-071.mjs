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
import { authoringArrowDelta, toAuthoringArrowKey } from "../src/build/assetAuthoringInput.js";
import {
  normalizeBedDefinitionToGrid,
  normalizeFacilityDefinitionToGrid,
  roundColliderToAssetFootprint,
  snapAssetPlacementPoint,
} from "../src/build/assetGridPlacement.js";
import { applyVisualCrop } from "../src/build/assetVisualCrop.js";
import { COLLIDER_DEBUG_STORAGE_KEY } from "../src/build/colliderDebugOverrides.js";
import { editRectDraftByArrow, roundColliderDraftToGrid } from "../src/build/colliderResize.js";
import {
  filterPerimeterInteractionPoints,
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
  roundColliderToAssetFootprint({ left: 165, right: 181, top: 278, bottom: 294 }, 16, 2),
  { left: 162, right: 174, top: 274, bottom: 286 },
  "authoring round uses the asset footprint and produces one padded grid cell even from an off-grid legacy placement",
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

assert.deepEqual(
  snapAssetPlacementPoint({ x: 23, y: 39 }, 16),
  { x: 16, y: 32 },
  "placeable assets store their top-left placement on the tile grid",
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
  position: { x: 31, y: 43 },
  wakePosition: { x: 31, y: 59 },
});
assert.deepEqual(normalizedBed.position, { x: 24, y: 40 }, "bed centre derives from one grid-aligned footprint cell");
assert.deepEqual(normalizedBed.wakePosition, { x: 24, y: 56 });

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
assert(facilityVisualSource.includes("applyVisualCrop"), "canonical crop applies when normal runtime visuals are created");
assert(interactionApproachSource.includes("assetProfilesDefault.js"), "canonical approach masks apply without opening the debug panel");
assert(gridAuthoringSource.includes("GRID_OVERLAY_ALPHA = 0.4"), "collider volumes are rendered at forty percent of their previous layer opacity");
assert(gridAuthoringSource.includes("stopPlayerMotion"), "active authoring keyboard input explicitly stops player motion");

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

console.log("Task #071 contracts passed: grid placement, WASD/arrow authoring, dimmed volumes, canonical profiles, crop and approach directions");
