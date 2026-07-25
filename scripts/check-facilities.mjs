import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FACILITIES } from "../src/facilityConfig.js";
import { createFacilityRuntime } from "../src/facilityRuntime.js";

assert.deepEqual(FACILITIES.map(({ facilityType, footprint }) => [facilityType, footprint.width / 16, footprint.height / 16]), [["shower", 2, 2], ["toilet", 1, 1], ["table", 3, 1]]);
assert(FACILITIES.every((facility) => Number.isInteger(facility.visual.x) && Number.isInteger(facility.visual.y)));
assert(FACILITIES.filter((facility) => facility.facilityType !== "table").every((facility) => facility.presentationPose));
assert.equal(FACILITIES.find((facility) => facility.facilityType === "table").presentationPose, null);
const source = readFileSync("src/facilityRuntime.js", "utf8");
assert(!source.includes("drawFacility")); assert(source.includes("scene.add.image"));
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
console.log("facility checks passed: assets, footprints, interaction and teardown");
