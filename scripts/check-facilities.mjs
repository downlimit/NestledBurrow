import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { BED_ASSET } from "../src/debrisConfig.js";
import { FACILITIES, FACILITY_ASSETS, PLATED_DISH_ASSET, preloadFacilityAssets } from "../src/facilityConfig.js";
import { createFacilityRuntime } from "../src/facilityRuntime.js";

assert.deepEqual(FACILITIES.map(({ facilityType, footprint }) => [facilityType, footprint.width / 16, footprint.height / 16]), [
  ["shower", 2, 2],
  ["toilet", 1, 1],
  ["table", 3, 1],
  ["cutting-table", 2, 1],
  ["gas-stove", 1, 2],
  ["serving-table", 2, 1],
]);
assert(FACILITIES.every((facility) => Number.isInteger(facility.visual.x) && Number.isInteger(facility.visual.y)));
assert(FACILITIES.filter((facility) => ["shower", "toilet"].includes(facility.facilityType)).every((facility) => facility.presentationPose));
assert(FACILITIES.filter((facility) => !["shower", "toilet"].includes(facility.facilityType)).every((facility) => facility.presentationPose === null));
assert(FACILITIES.filter((facility) => ["cutting-table", "gas-stove", "serving-table"].includes(facility.facilityType)).every((facility) => facility.editable === false));
for (const type of ["cutting-table", "gas-stove", "serving-table"]) {
  const asset = FACILITY_ASSETS[type];
  const path = `public/${asset.path}`;
  assert(existsSync(path), `${type} sprite exists`);
  assert(statSync(path).size > 100, `${type} sprite is non-empty`);
}
assert(existsSync(`public/${PLATED_DISH_ASSET.path}`), "plated dish sprite exists");

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
const scene = { add: { image(x, y, key) { const image = { x, y, key, visible: true, setOrigin() { return this; }, setDepth(value) { this.depth = value; return this; }, setVisible(value) { this.visible = value; return this; }, destroy() { this.destroyed = true; } }; images.push(image); return image; } } };
const worldLayout = { isBlockedBox() { return false; }, setWorldObjectCollider(id, bounds) { colliders.set(id, bounds); }, clearWorldObjectCollider(id) { colliders.delete(id); } };
const kitchen = { rawPotatoes: 5, preparedPotatoes: 0, cookedDishes: 0, servingTableHasDish: false };
const runtime = createFacilityRuntime(scene, { worldLayout, getKitchenState: () => kitchen });
assert.equal(images.length, 7); assert.deepEqual([...colliders.values()].map((bounds) => [(bounds.right - bounds.left) / 16, (bounds.bottom - bounds.top) / 16]), [[2, 2], [1, 1], [3, 1], [2, 1], [1, 2], [2, 1]]);
const motor = { position: null, movement: { velocity: { x: 3, y: -2 } } };
for (const facility of FACILITIES.filter((candidate) => candidate.editable !== false)) {
  motor.position = { x: 123, y: 456 };
  assert.equal(runtime.toggle(facility.id, motor).status, "started");
  assert.deepEqual(motor.position, { x: 123, y: 456 }, `${facility.facilityType} interaction never moves the player motor`);
  assert.equal(runtime.toggle(facility.id, motor).status, "stopped");
}
assert.equal(runtime.getInteractionDefinitions().find((facility) => facility.facilityType === "cutting-table").prompt, "hud:interaction.startPreparation");
assert.equal(runtime.getInteractionDefinitions().find((facility) => facility.facilityType === "gas-stove").prompt, "hud:interaction.noPreparedPotatoes");
const fixedCuttingTable = FACILITIES.find((facility) => facility.facilityType === "cutting-table");
assert.equal(runtime.remove(fixedCuttingTable.id), false, "fixed kitchen facilities cannot be removed");
assert.equal(runtime.getDemolitionTargetAt(fixedCuttingTable.position), null, "fixed kitchen facilities cannot be selected for demolition");
kitchen.servingTableHasDish = true;
runtime.syncKitchenVisuals();
assert.equal(images.find((image) => image.key === PLATED_DISH_ASSET.key).visible, true, "serving table dish visibility follows persistent state");
runtime.destroy(); runtime.destroy(); assert.equal(colliders.size, 0); assert(images.every((image) => image.destroyed));
console.log("facility checks passed: canonical furniture sprites, footprints, interaction and teardown");
