import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  COOKING_STEP_TYPES,
  DEFAULT_SERVING_TABLE_ID,
  SERVING_TABLE_CAPACITY,
  STOVE_REPAIR_COST,
  completeCookingStep,
  consumeServingReservation,
  craftLemonade,
  interactServingTable,
  releaseServingReservation,
  repairStove,
  reserveServingItem,
  takeStarterLemons,
} from "../src/tavern/cookingDomain.js";
import {
  LEMON_CROP_PROFILE,
  POTATO_CROP_PROFILE,
  STARTER_WELL,
  WATER_BUCKET_CAPACITY,
} from "../src/resources/farmingConfig.js";
import {
  advanceFarmTime,
  createFreshFarmState,
  harvestCrop,
  normalizeFarmState,
  plantCrop,
  tillSoil,
  waterSoil,
} from "../src/resources/farmingDomain.js";
import { createFreshGameSessionState, hitResourceNode, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  aggregateInventoryGain,
  INVENTORY_GAIN_DROP_MS,
  INVENTORY_GAIN_DURATION_MS,
  INVENTORY_GAIN_HOLD_MS,
  INVENTORY_GAIN_ICON_HOLD_SCALE,
} from "../src/inventory/inventoryGainPresentation.js";
import {
  INVENTORY_ITEM_IDS,
  INVENTORY_TOOL_IDS,
  addInventoryItem,
  createFreshInventory,
  createInventoryItem,
  getInventoryQuantity,
  normalizeInventory,
} from "../src/inventory/inventoryDomain.js";
import { LEMONADE_FRAME_ORDER } from "../src/tavern/lemonadeConfig.js";
import { LEMON_SEED_PRICE, POTATO_SEED_PRICE } from "../src/resources/merchantDomain.js";
import { normalizeCoinValue } from "../src/tavern/coinRuntime.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resources/resourceConfig.js";
import { RESOURCE_OBJECTS } from "../src/resources/resourceConfig.js";
import { getResourceProfile, resourceActionForTool } from "../src/resources/resourceDomain.js";
import { STARTER_TREE_OBJECTS } from "../src/build/startingLayout.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";
import {
  GUEST_ACTIVE_CAP,
  sampleVisitOpportunityDelay,
} from "../src/tavern/tavernServiceDomain.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

assert.equal(SESSION_STATE_VERSION, 15);
assert.equal(SAVE_SCHEMA_VERSION, 15);
assert.deepEqual(INVENTORY_TOOL_IDS, ["axe", "pickaxe", "hoe", "water-bucket", "sword", "battle-axe"]);
for (const id of ["pickaxe", "water-bucket", "lemon-seed", "lemon", "sliced-potato", "lemonade", "fried-potato-dish"]) {
  assert(INVENTORY_ITEM_IDS.includes(id), `inventory contains ${id}`);
}
const fresh = createFreshGameSessionState();
assert.deepEqual(fresh.gameplay.inventory.slots.slice(0, 5).map((item) => item?.id), [
  "axe", "pickaxe", "hoe", "water-bucket", "potato-seed",
]);
assert.equal(getInventoryQuantity(fresh.gameplay.inventory, "potato"), 0);
assert.deepEqual(fresh.gameplay.farm.waterBucket, { capacity: 8, currentWater: 0 });
assert.deepEqual(fresh.gameplay.farm.wells, [{ ...STARTER_WELL }]);
assert.deepEqual(normalizeFarmState({
  ...createFreshFarmState(),
  wells: [{ id: STARTER_WELL.id, x: 448, y: 496, fixed: true }],
}).wells, [{ ...STARTER_WELL }], "existing saves relocate the fixed starter well to its canonical right-of-road position");
assert.equal(WATER_BUCKET_CAPACITY, 8);

const matrix = {
  "log-small": { axe: "chop", pickaxe: null, hoe: null, "water-bucket": null },
  "stone-small": { axe: null, pickaxe: "mine", hoe: null, "water-bucket": null },
  "ruby-node": { axe: null, pickaxe: "mine", hoe: null, "water-bucket": null },
  "tree-planted": { axe: "chop", pickaxe: null, hoe: null, "water-bucket": null },
};
for (const [profileId, tools] of Object.entries(matrix)) {
  const profile = getResourceProfile(profileId);
  for (const [toolId, action] of Object.entries(tools)) assert.equal(resourceActionForTool(profile, toolId), action);
}
assert.equal(RESOURCE_OBJECTS.some((definition) => definition.id.startsWith("starter-tree-")), false);
assert.equal(STARTER_TREE_OBJECTS.length, 2);
assert(STARTER_TREE_OBJECTS.every((tree) => tree.kind === "plant"
  && tree.item.resourceProfileId === "tree-planted"
  && tree.colliderGroup === "resource:tree-planted"));
const wrongToolState = createFreshGameSessionState();
assert.equal(hitResourceNode(wrongToolState, "yard-stone-02", {
  action: "chop",
  damage: 99,
  energyPerHit: 0,
  tuning: DEFAULT_GAMEPLAY_TUNING,
}).status, "unsupported-action");

const sackState = createFreshGameSessionState();
const sack = takeStarterLemons(sackState.gameplay.kitchen, sackState.gameplay.inventory);
assert.equal(sack.inventory.accepted, 6);
assert.equal(sackState.gameplay.kitchen.starterLemons, 0);
assert.equal(getInventoryQuantity(sackState.gameplay.inventory, "lemon"), 6);
assert.equal(takeStarterLemons(sackState.gameplay.kitchen, sackState.gameplay.inventory).status, "lemon-sack-empty");

const lemonadeState = createFreshGameSessionState();
addInventoryItem(lemonadeState.gameplay.inventory, createInventoryItem("lemon", 1));
lemonadeState.gameplay.farm.waterBucket.currentWater = 1;
const lemonade = craftLemonade(
  lemonadeState.gameplay.kitchen,
  lemonadeState.gameplay.farm,
  lemonadeState.gameplay.inventory,
);
assert.equal(lemonade.status, "lemonade-crafted");
assert.equal(getInventoryQuantity(lemonadeState.gameplay.inventory, "lemon"), 0);
assert.equal(getInventoryQuantity(lemonadeState.gameplay.inventory, "lemonade"), 1);
assert.equal(lemonadeState.gameplay.farm.waterBucket.currentWater, 0);

const fullRecipeState = createFreshGameSessionState();
fullRecipeState.gameplay.inventory.slots = [
  createInventoryItem("axe"), createInventoryItem("pickaxe"), createInventoryItem("hoe"), createInventoryItem("water-bucket"),
  createInventoryItem("potato", 2),
  ...Array.from({ length: 5 }, (_, index) => createInventoryItem(`future-${index}`, 1)),
];
const fullRecipeBefore = clone(fullRecipeState.gameplay.inventory);
assert.equal(completeCookingStep(
  fullRecipeState.gameplay.kitchen,
  COOKING_STEP_TYPES.preparation,
  fullRecipeState.gameplay.inventory,
).status, "inventory-full");
assert.deepEqual(fullRecipeState.gameplay.inventory, fullRecipeBefore, "blocked preparation spends nothing");

const potatoState = createFreshGameSessionState();
addInventoryItem(potatoState.gameplay.inventory, createInventoryItem("potato", 1));
potatoState.gameplay.kitchen.stoveRepaired = true;
assert.equal(completeCookingStep(potatoState.gameplay.kitchen, COOKING_STEP_TYPES.preparation, potatoState.gameplay.inventory).status, "completed");
assert.equal(getInventoryQuantity(potatoState.gameplay.inventory, "sliced-potato"), 1);
assert.equal(completeCookingStep(potatoState.gameplay.kitchen, COOKING_STEP_TYPES.frying, potatoState.gameplay.inventory).status, "completed");
assert.equal(getInventoryQuantity(potatoState.gameplay.inventory, "fried-potato-dish"), 1);

const stockState = createFreshGameSessionState();
addInventoryItem(stockState.gameplay.inventory, createInventoryItem("lemonade", SERVING_TABLE_CAPACITY + 1));
for (let index = 0; index < SERVING_TABLE_CAPACITY; index += 1) {
  assert.equal(interactServingTable(stockState.gameplay.kitchen, stockState.gameplay.inventory, DEFAULT_SERVING_TABLE_ID, "lemonade").status, "item-served");
}
assert.equal(interactServingTable(stockState.gameplay.kitchen, stockState.gameplay.inventory, DEFAULT_SERVING_TABLE_ID, "lemonade").status, "serving-table-full");
addInventoryItem(stockState.gameplay.inventory, createInventoryItem("fried-potato-dish", 1));
assert.equal(interactServingTable(stockState.gameplay.kitchen, stockState.gameplay.inventory, DEFAULT_SERVING_TABLE_ID, "fried-potato-dish").status, "different-item");
const firstReservation = reserveServingItem(stockState.gameplay.kitchen, "tavern-guest-1");
const secondReservation = reserveServingItem(stockState.gameplay.kitchen, "tavern-guest-2");
assert.equal(firstReservation.itemId, "lemonade");
assert.equal(secondReservation, null);
assert.equal(consumeServingReservation(stockState.gameplay.kitchen, "tavern-guest-1").quantity, 0);
assert.equal(interactServingTable(
  stockState.gameplay.kitchen,
  stockState.gameplay.inventory,
  DEFAULT_SERVING_TABLE_ID,
  "lemonade",
).status, "item-served");
assert(reserveServingItem(stockState.gameplay.kitchen, "tavern-guest-2"));
assert.equal(releaseServingReservation(stockState.gameplay.kitchen, "tavern-guest-2"), true);
assert.equal(stockState.gameplay.kitchen.servingTables[DEFAULT_SERVING_TABLE_ID].quantity, 1);
assert.equal(stockState.gameplay.kitchen.servingTables[DEFAULT_SERVING_TABLE_ID].reservations.length, 0);

const repairState = createFreshGameSessionState();
addInventoryItem(repairState.gameplay.inventory, createInventoryItem("wood", STOVE_REPAIR_COST.wood));
addInventoryItem(repairState.gameplay.inventory, createInventoryItem("stone", STOVE_REPAIR_COST.stone - 1));
repairState.gameplay.coins = STOVE_REPAIR_COST.coins;
const repairBefore = clone(repairState.gameplay);
assert.equal(repairStove(repairState.gameplay).status, "repair-missing");
assert.deepEqual(clone(repairState.gameplay), repairBefore, "blocked repair is atomic");
addInventoryItem(repairState.gameplay.inventory, createInventoryItem("stone", 1));
assert.equal(repairStove(repairState.gameplay).status, "stove-repaired");
assert.equal(repairState.gameplay.kitchen.stoveRepaired, true);
assert.equal(getInventoryQuantity(repairState.gameplay.inventory, "wood"), 0);
assert.equal(getInventoryQuantity(repairState.gameplay.inventory, "stone"), 0);
assert.equal(repairState.gameplay.coins, 0);
assert.equal(deserializeSessionEnvelope(serializeSessionEnvelope(repairState)).state.gameplay.kitchen.stoveRepaired, true);
assert.equal(repairStove(repairState.gameplay).status, "already-repaired");

assert.equal(POTATO_CROP_PROFILE.requiredEffectiveGrowthSeconds, LEMON_CROP_PROFILE.requiredEffectiveGrowthSeconds * 2);
assert(LEMON_CROP_PROFILE.maximumEffectiveGrowthPerDay >= LEMON_CROP_PROFILE.requiredEffectiveGrowthSeconds);
const farm = createFreshFarmState(6 * 3600);
const farmInventory = createFreshInventory();
addInventoryItem(farmInventory, createInventoryItem("lemon-seed", 1));
tillSoil(farm, { x: 0, y: 0 });
assert.equal(plantCrop(farm, { x: 0, y: 0 }, farmInventory, 6 * 3600, "lemon").status, "planted");
farm.waterBucket.currentWater = 1;
assert.equal(waterSoil(farm, { x: 0, y: 0 }, 6 * 3600).status, "watered");
advanceFarmTime(farm, 10 * 3600);
assert.equal(farm.soilCells[0].crop.mature, true);
for (const value of [0, 0.999999]) {
  const sample = clone(farm);
  assert([2, 3].includes(harvestCrop(sample, { x: 0, y: 0 }, () => value).quantity));
}

assert.equal(POTATO_SEED_PRICE, 1);
assert.equal(LEMON_SEED_PRICE, 2);
assert.equal(sampleVisitOpportunityDelay(() => 0), 3_000);
assert(sampleVisitOpportunityDelay(() => 0.999999) < 8_001);
assert.equal(GUEST_ACTIVE_CAP, 6);
assert.equal(normalizeCoinValue(undefined), 1);
assert.equal(normalizeCoinValue(2), 2);
assert.equal(normalizeCoinValue(4), 4);

const gains = new Map();
assert.equal(aggregateInventoryGain(gains, { itemId: "lemon", slotIndex: 4, added: 1, nowMs: 100 }).amount, 1);
const mergedGain = aggregateInventoryGain(gains, { itemId: "lemon", slotIndex: 4, added: 2, nowMs: 300 });
assert.equal(mergedGain.amount, 3);
assert.equal(mergedGain.expiresAtMs, 300 + INVENTORY_GAIN_DURATION_MS);
assert.equal(INVENTORY_GAIN_HOLD_MS, 700);
assert.equal(INVENTORY_GAIN_DROP_MS, 300);
assert.equal(INVENTORY_GAIN_DURATION_MS, 1000);
assert.equal(INVENTORY_GAIN_ICON_HOLD_SCALE, 1.5);

const legacy = clone(createFreshGameSessionState());
legacy.version = 9;
legacy.gameplay.inventory = {
  slots: [
    createInventoryItem("axe"),
    createInventoryItem("hoe"),
    { id: "watering-can", kind: "tool", quantity: 1 },
    createInventoryItem("potato", 2),
    null, null, null, null, null, null,
  ],
};
legacy.gameplay.farm = {
  soilCells: [],
  wateringCan: { capacity: 40, currentWater: 6 },
  wells: [],
  lastProcessedWorldTimeSeconds: legacy.gameplay.worldTimeSeconds,
};
legacy.gameplay.kitchen = { preparedPotatoes: 2, cookedDishes: 1, servingTableHasDish: true };
delete legacy.gameplay.tavernService;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 9, state: legacy }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.flags["migration.task049WarningPending"], true);
assert.deepEqual(
  migrated.state.gameplay.inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id).sort(),
  ["axe", "pickaxe", "hoe", "water-bucket"].sort(),
  "legacy migration keeps the four historical starter tools and does not add melee weapons",
);
assert.equal(new Set(migrated.state.gameplay.inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id)).size, 4);
assert.equal(migrated.state.gameplay.farm.waterBucket.currentWater, 6);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "sliced-potato"), 2);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "fried-potato-dish"), 1);
assert.deepEqual(migrated.state.gameplay.kitchen.servingTables, {
  [DEFAULT_SERVING_TABLE_ID]: { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
});

const manifest = JSON.parse(readFileSync("public/assets/project/lemonade/NestledBurrow_Lemonade.manifest.json", "utf8"));
assert.deepEqual(manifest.frameOrder, LEMONADE_FRAME_ORDER);
assert.equal(manifest.frameWidth, 16);
assert.equal(manifest.frameHeight, 16);
checkPng("public/assets/project/lemonade/NestledBurrow_Lemonade.png", 288, 16, "e2b35ab0e8c51ff5e5ad10e9a988f9424f6904102e65d126cb7110e7a356e91f");
checkPng("public/assets/project/lemonade/NestledBurrow_GasStoveBroken.png", 16, 32, "d57a2d04ec511f007c1b947ec5623eaf7e6c13458ab86a0b065ab1a51be06715");

const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes('showTransientMessage?.("hud:interaction.wakeFailed")'));
assert(mainSource.includes("transientMessageShown: true"), "system messages preserve the interaction action label");
assert(mainSource.includes('prompt: "hud:interaction.wake"'));
const persistenceSource = readFileSync("src/session/sessionPersistence.js", "utf8");
assert(!persistenceSource.includes("notifyInventoryGain"), "load and migration do not invoke gain presentation");

console.log("Task #049 checks passed: tools, water, recipes, service, guests, migration, feedback and owned asset integrity");

function checkPng(path, width, height, hash) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32BE(16), width, `${path} width`);
  assert.equal(bytes.readUInt32BE(20), height, `${path} height`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, `${path} hash`);
}
