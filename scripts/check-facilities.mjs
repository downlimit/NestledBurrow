import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { BED_ASSET } from "../src/debrisConfig.js";
import { FACILITIES, preloadFacilityAssets } from "../src/facilityConfig.js";
import { createFacilityRuntime } from "../src/facilityRuntime.js";

assert.deepEqual(FACILITIES.map(({ facilityType, footprint }) => [facilityType, footprint.width / 16, footprint.height / 16]), [["shower", 2, 2], ["toilet", 1, 1], ["table", 3, 1]]);
assert(FACILITIES.every((facility) => Number.isInteger(facility.visual.x) && Number.isInteger(facility.visual.y)));
assert(FACILITIES.filter((facility) => facility.facilityType !== "table").every((facility) => facility.presentationPose));
assert.equal(FACILITIES.find((facility) => facility.facilityType === "table").presentationPose, null);

const bedPath = `public/${BED_ASSET.path}`;
assert.equal(BED_ASSET.key, "furniture.bed");
assert.equal(BED_ASSET.width, 16);
assert.equal(BED_ASSET.height, 16);
assert(existsSync(bedPath));
assert.equal(statSync(bedPath).size, 2415);
assert.equal(createHash("sha256").update(readFileSync(bedPath)).digest("hex"), "5046a56d0e9cd13b8f85b34aaea3487fa0fb5626e880ce3179e3428dc8f35e91");
assert.equal(execFileSync("git", ["hash-object", bedPath], { encoding: "utf8" }).trim(), "d828dec6d5056daa5cafbb3c173cfa0e8554b507");

const preloaded = [];
preloadFacilityAssets({ load: { image(key, path) { preloaded.push([key, path]); } } }, "/NestledBurrow/");
assert(preloaded.some(([key, path]) => key === BED_ASSET.key && path === `/NestledBurrow/${BED_ASSET.path}`), "the uploaded bed sprite is preloaded with the facility sprite set");

const facilitySource = readFileSync("src/facilityRuntime.js", "utf8");
assert(!facilitySource.includes("drawFacility"));
assert(facilitySource.includes("scene.add.image"));
const previewSource = readFileSync("src/facilityPreviewVisuals.js", "utf8");
assert(previewSource.includes("bindSpriteVisual"));
assert(!previewSource.includes("fillRect"));
assert(!previewSource.includes("fillEllipse"));
assert(!previewSource.includes("fillCircle"));
const debrisSource = readFileSync("src/debrisRuntime.js", "utf8");
assert(debrisSource.includes("bindSpriteVisual(graphics, BED_ASSET"));
assert(!debrisSource.includes("0x5c3a2a"));
assert(!debrisSource.includes("0x315c8a"));

const colliders = new Map(); const images = [];
const scene = { add: { image(x, y, key) { const image = { x, y, key, setOrigin() { return this; }, setDepth(value) { this.depth = value; return this; }, destroy() { this.destroyed = true; } }; images.push(image); return image; } } };
const worldLayout = { isBlockedBox() { return false; }, setWorldObjectCollider(id, bounds) { colliders.set(id, bounds); }, clearWorldObjectCollider(id) { colliders.delete(id); } };
const runtime = createFacilityRuntime(scene, { worldLayout });
assert.equal(images.length, 3); assert.deepEqual([...colliders.values()].map((bounds) => [(bounds.right - bounds.left) / 16, (bounds.bottom - bounds.top) / 16]), [[2, 2], [1, 1], [3, 1]]);
const motor = { position: null, movement: { velocity: { x: 3, y: -2 } } };
for (const facility of FACILITIES) {
  motor.position = { x: 123, y: 456 };
  assert.equal(runtime.toggle(facility.id, motor).status, "started");
  assert.deepEqual(motor.position, { x: 123, y: 456 }, `${facility.facilityType} interaction never moves the player motor`);
  assert.equal(runtime.toggle(facility.id, motor).status, "stopped");
}
runtime.destroy(); runtime.destroy(); assert.equal(colliders.size, 0); assert(images.every((image) => image.destroyed));
console.log("facility checks passed: canonical furniture sprites, footprints, interaction and teardown");
