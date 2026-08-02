import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { BED_ASSET, BED_OBJECT } from "../src/resources/debrisConfig.js";
import { FACILITIES, FACILITY_ASSETS, PLATED_DISH_ASSET, preloadFacilityAssets } from "../src/facilities/facilityConfig.js";
import { createFacilityRuntime } from "../src/facilities/facilityRuntime.js";
import { createNewGameInventory } from "../src/inventory/inventoryDomain.js";
import { DEFAULT_SERVING_TABLE_ID } from "../src/tavern/cookingDomain.js";
import { pixelAlignedWorldPoint } from "../src/build/buildWorldGeometry.js";

assert.deepEqual(pixelAlignedWorldPoint({ x: 392, y: 372.5 }), { x: 392, y: 373 }, "half-pixel authored coordinates snap only at the visual boundary");

assert.deepEqual(FACILITIES.map(({ facilityType, footprint }) => [facilityType, footprint.width / 16, footprint.height / 16]), [
  ["shower", 2, 2],
  ["toilet", 1, 1],
  ["table", 3, 1],
  ["cutting-table", 2, 1],
  ["gas-stove", 1, 2],
  ["serving-table", 2, 1],
  ["lemon-sack", 1, 1],
  ["juicer", 1, 1],
]);
assert.deepEqual(FACILITIES.map(({ facilityType, footprint }) => [facilityType, footprint.x / 16, footprint.y / 16]), [
  ["shower", 27, 20], ["toilet", 33, 20], ["table", 36, 26],
  ["cutting-table", 29, 21], ["gas-stove", 31, 20], ["serving-table", 33, 26],
  ["lemon-sack", 27, 24], ["juicer", 29, 24],
], "the accepted live furniture arrangement is the default 16 px layout");
assert(FACILITIES.every((facility) => Number.isInteger(facility.visual.x) && Number.isInteger(facility.visual.y)));
assert(FACILITIES.filter((facility) => ["shower", "toilet"].includes(facility.facilityType)).every((facility) => facility.presentationPose));
assert(FACILITIES.filter((facility) => !["shower", "toilet"].includes(facility.facilityType)).every((facility) => facility.presentationPose === null));
assert(FACILITIES.filter((facility) => ["cutting-table", "gas-stove", "serving-table", "lemon-sack", "juicer"].includes(facility.facilityType)).every((facility) => facility.editable === false));
for (const type of ["cutting-table", "gas-stove", "serving-table"]) {
  const asset = FACILITY_ASSETS[type];
  const path = `public/${asset.path}`;
  assert(existsSync(path), `${type} sprite exists`);
  assert(statSync(path).size > 100, `${type} sprite is non-empty`);
}
assert(existsSync(`public/${PLATED_DISH_ASSET.path}`), "plated dish sprite exists");

const diningTablePath = `public/${FACILITY_ASSETS.table.path}`;
assert.equal(FACILITY_ASSETS.table.key, "facility.dining-table-feast");
assert.equal(FACILITY_ASSETS.table.width, 48);
assert.equal(FACILITY_ASSETS.table.height, 16);
assert(existsSync(diningTablePath));
assert.equal(statSync(diningTablePath).size, 730);
assert.equal(createHash("sha256").update(readFileSync(diningTablePath)).digest("hex"), "37fec3c3d5a521d8ac47592622fc79849c7e6b678fd9b4ae9086962365c54018");
assert.equal(execFileSync("git", ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`, "hash-object", diningTablePath], { encoding: "utf8" }).trim(), "d12b16c0e6f4554d77f48f0e73c4e3963c291fd9");

const bedPath = `public/${BED_ASSET.path}`;
assert.equal(BED_ASSET.key, "furniture.bed");
assert.equal(BED_ASSET.width, 16);
assert.equal(BED_ASSET.height, 16);
assert.deepEqual(BED_OBJECT.position, { x: 520, y: 328 }, "the accepted live bed position is the default layout");
assert(BED_OBJECT.priority > 20, "the bed remains selectable inside its smaller radius beside priority-20 facilities");
assert(existsSync(bedPath));
assert.equal(statSync(bedPath).size, 2415);
assert.equal(createHash("sha256").update(readFileSync(bedPath)).digest("hex"), "5046a56d0e9cd13b8f85b34aaea3487fa0fb5626e880ce3179e3428dc8f35e91");
assert.equal(execFileSync("git", ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`, "hash-object", bedPath], { encoding: "utf8" }).trim(), "d828dec6d5056daa5cafbb3c173cfa0e8554b507");

const preloaded = [];
preloadFacilityAssets({ load: { image(key, path) { preloaded.push([key, path]); } } }, "/NestledBurrow/");
assert(preloaded.some(([key, path]) => key === BED_ASSET.key && path === `/NestledBurrow/${BED_ASSET.path}`), "the uploaded bed sprite is preloaded with the facility sprite set");

const facilitySource = readFileSync("src/facilities/facilityRuntime.js", "utf8");
assert(facilitySource.includes("drawFacility(graphics, facility.facilityType)"), "runtime and build previews share the facility presentation adapter");
assert(facilitySource.includes("pixelAlignedWorldPoint"), "facility graphics and serving dishes use the shared pixel-aligned render position");
const previewSource = readFileSync("src/facilities/facilityPreviewVisuals.js", "utf8");
assert(previewSource.includes("bindSpriteVisual"));
assert(!previewSource.includes("fillRect"));
assert(!previewSource.includes("fillEllipse"));
assert(!previewSource.includes("fillCircle"));
const debrisSource = readFileSync("src/resources/debrisRuntime.js", "utf8");
assert(debrisSource.includes("bindSpriteVisual(graphics, BED_ASSET"));
assert(debrisSource.includes("pixelAlignedWorldPoint"), "resource graphics, including large stones and logs, use the shared pixel-aligned render position");
assert(!debrisSource.includes("0x5c3a2a"));
assert(!debrisSource.includes("0x315c8a"));

const colliders = new Map(); const images = [];
const scene = { add: {
  graphics() { return { scene, x: 0, y: 0, depth: 0, visible: true, alpha: 1, scaleX: 1, scaleY: 1, setPosition(x, y) { this.x = x; this.y = y; return this; }, setDepth(value) { this.depth = value; return this; }, setVisible(value) { this.visible = value; return this; }, setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; }, setAlpha(value) { this.alpha = value; return this; }, destroy() { this.destroyed = true; return this; } }; },
  image(x, y, key, frame = 0) { const image = { x, y, key, frame, visible: true, setOrigin() { return this; }, setPosition(nextX, nextY) { this.x = nextX; this.y = nextY; return this; }, setDepth(value) { this.depth = value; return this; }, setVisible(value) { this.visible = value; return this; }, setScale() { return this; }, setAlpha() { return this; }, setScrollFactor() { return this; }, setTexture(nextKey, nextFrame = 0) { this.key = nextKey; this.frame = nextFrame; return this; }, setFrame(nextFrame) { this.frame = nextFrame; return this; }, destroy() { this.destroyed = true; } }; images.push(image); return image; },
} };
let blockFacilityPlacement = false;
const worldLayout = { getEffectiveCollider(bounds) { return bounds; }, isBlockedBox() { return blockFacilityPlacement; }, setWorldObjectCollider(id, bounds) { colliders.set(id, bounds); }, clearWorldObjectCollider(id) { colliders.delete(id); } };
const kitchen = {
  starterLemons: 6,
  stoveRepaired: false,
  servingTables: { [DEFAULT_SERVING_TABLE_ID]: { itemId: null, quantity: 0, reservations: [] } },
};
const inventory = createNewGameInventory();
let reservedDiningTableId = null;
const runtime = createFacilityRuntime(scene, {
  worldLayout,
  getKitchenState: () => kitchen,
  getInventoryState: () => inventory,
  isFacilityReserved: (facilityId) => facilityId === reservedDiningTableId,
});
assert.equal(images.length, 9); assert.deepEqual([...colliders.values()].map((bounds) => [(bounds.right - bounds.left) / 16, (bounds.bottom - bounds.top) / 16]), [[2, 2], [1, 1], [3, 1], [2, 1], [1, 2], [2, 1], [1, 1], [1, 1]]);
const motor = { position: null, movement: { velocity: { x: 3, y: -2 } } };
for (const facility of FACILITIES.filter((candidate) => candidate.editable !== false)) {
  motor.position = { x: 123, y: 456 };
  assert.equal(runtime.toggle(facility.id, motor).status, "started");
  assert.deepEqual(motor.position, { x: 123, y: 456 }, `${facility.facilityType} interaction never moves the player motor`);
  assert.equal(runtime.toggle(facility.id, motor).status, "stopped");
}
const diningTable = runtime.getDefinitions().find((facility) => facility.facilityType === "table");
reservedDiningTableId = diningTable.id;
assert.equal(runtime.toggle(diningTable.id, motor).status, "busy", "a player cannot occupy a guest-reserved dining table");
reservedDiningTableId = null;
assert.equal(runtime.getInteractionDefinitions().find((facility) => facility.facilityType === "cutting-table").prompt, "hud:interaction.noRawPotatoes");
assert.equal(runtime.getInteractionDefinitions().find((facility) => facility.facilityType === "gas-stove").prompt, "hud:interaction.repairStove");
const lemonSack = FACILITIES.find((facility) => facility.facilityType === "lemon-sack");
assert.equal(runtime.getVisualStates()[lemonSack.id]?.visible, true, "full starter sack is visible");
assert(colliders.has(lemonSack.id), "full starter sack blocks the world");
kitchen.starterLemons = 0;
runtime.syncKitchenVisuals();
assert.equal(runtime.getVisualStates()[lemonSack.id], null, "depleted starter sack visual is removed");
assert.equal(colliders.has(lemonSack.id), false, "depleted starter sack collider is removed");
assert.equal(runtime.getInteractionDefinitions().some((facility) => facility.id === lemonSack.id), false, "depleted starter sack cannot be targeted");
const fixedCuttingTable = FACILITIES.find((facility) => facility.facilityType === "cutting-table");
assert.equal(runtime.remove(fixedCuttingTable.id), false, "fixed kitchen facilities cannot be removed");
assert.equal(runtime.getDemolitionTargetAt(fixedCuttingTable.position), null, "fixed kitchen facilities cannot be selected for demolition");
const shower = runtime.getDefinitions().find((facility) => facility.facilityType === "shower");
blockFacilityPlacement = true;
assert.equal(runtime.replace(shower, { validateFootprint: false }), true, "canonical restore bypasses transient footprint and use-position blockers");
blockFacilityPlacement = false;
const movedShower = runtime.move(shower.id, { x: 640, y: 320 });
assert(movedShower && runtime.getDefinition(shower.id).footprint.x === 640, "editable facility moves to a snapped destination");
assert.equal(runtime.replace(movedShower.previous), true, "facility move can be undone with its original definition");
const movedCuttingTable = runtime.move(fixedCuttingTable.id, { x: 640, y: 320 });
assert(movedCuttingTable && runtime.getDefinition(fixedCuttingTable.id).footprint.x === 640, "fixed kitchen facilities can move while remaining protected from demolition");
assert.equal(runtime.replace(movedCuttingTable.previous), true, "fixed kitchen facility move supports undo");
const servingTable = runtime.getDefinitions().find((facility) => facility.facilityType === "serving-table");
const movedServingTable = runtime.move(servingTable.id, { x: 672, y: 320 });
assert(movedServingTable, "serving table can move");
assert.equal(runtime.getServingTableVisualStates()[servingTable.id].x, 688, "served dish follows a moved serving table");
assert.equal(runtime.replace(movedServingTable.previous), true);
kitchen.servingTables[servingTable.id] = { itemId: "fried-potato-dish", quantity: 1, reservations: [] };
runtime.syncKitchenVisuals();
assert.equal(runtime.getServingTableVisualStates()[servingTable.id].visible, true, "serving table dish visibility follows persistent state");
const secondServingTable = runtime.add("serving-table", { x: 800, y: 320 });
assert(secondServingTable, "a second serving table can be placed");
kitchen.servingTables[secondServingTable.id] = { itemId: "lemonade", quantity: 1, reservations: [] };
runtime.syncKitchenVisuals();
const dishVisuals = runtime.getServingTableVisualStates();
assert.equal(dishVisuals[servingTable.id].visible, true);
assert.equal(dishVisuals[secondServingTable.id].visible, true);
assert.notDeepEqual(
  [dishVisuals[servingTable.id].x, dishVisuals[servingTable.id].y],
  [dishVisuals[secondServingTable.id].x, dishVisuals[secondServingTable.id].y],
  "each serving table owns its own dish visual",
);
runtime.destroy(); runtime.destroy(); assert.equal(colliders.size, 0); assert(images.every((image) => image.destroyed));
console.log("facility checks passed: canonical furniture sprites, independent serving visuals, interaction and teardown");
