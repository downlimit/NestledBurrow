import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  consumeServingReservation,
  getAvailableServingPortions,
  interactServingTable,
  normalizeKitchenState,
  reserveServingItem,
} from "../src/tavern/cookingDomain.js";
import { addInventoryItem, createFreshInventory, createInventoryItem, getInventoryQuantity } from "../src/inventory/inventoryDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

const leftId = "serving-left";
const rightId = "serving-right";
const kitchen = normalizeKitchenState({ servingTables: {
  [leftId]: { itemId: null, quantity: 0, reservations: [] },
  [rightId]: { itemId: null, quantity: 0, reservations: [] },
} });
const inventory = createFreshInventory();
addInventoryItem(inventory, createInventoryItem("fried-potato-dish", 1));
addInventoryItem(inventory, createInventoryItem("lemonade", 1));

assert.equal(interactServingTable(kitchen, inventory, rightId, "fried-potato-dish").status, "item-served");
assert.deepEqual(kitchen.servingTables[leftId], { itemId: null, quantity: 0, reservations: [] });
assert.deepEqual(kitchen.servingTables[rightId], { itemId: "fried-potato-dish", quantity: 1, reservations: [] });
addInventoryItem(inventory, createInventoryItem("fried-potato-dish", 1));
assert.equal(interactServingTable(kitchen, inventory, rightId, "fried-potato-dish").status, "serving-table-full");
assert.equal(interactServingTable(kitchen, inventory, leftId, "lemonade").status, "item-served");
assert.equal(getAvailableServingPortions(kitchen, [leftId, rightId]), 2);

const first = reserveServingItem(kitchen, "tavern-guest-1", [rightId, leftId]);
const second = reserveServingItem(kitchen, "tavern-guest-2", [rightId, leftId]);
assert.deepEqual(first, { guestId: "tavern-guest-1", itemId: "fried-potato-dish", servingTableId: rightId });
assert.deepEqual(second, { guestId: "tavern-guest-2", itemId: "lemonade", servingTableId: leftId });
assert.equal(consumeServingReservation(kitchen, first.guestId, first.servingTableId).servingTableId, rightId);
assert.equal(consumeServingReservation(kitchen, second.guestId, second.servingTableId).servingTableId, leftId);

const current = createFreshGameSessionState();
current.gameplay.kitchen.servingTables = kitchen.servingTables;
const reloaded = deserializeSessionEnvelope(serializeSessionEnvelope(current));
assert.equal(reloaded.status, "loaded");
assert.equal(reloaded.state.version, 15);
assert.deepEqual(reloaded.state.gameplay.kitchen.servingTables, kitchen.servingTables);

const legacy = createFreshGameSessionState();
legacy.version = 11;
legacy.gameplay.kitchen = {
  starterLemons: 4,
  stoveRepaired: true,
  servingTable: { itemId: "lemonade", quantity: 4, reservations: [] },
};
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 11, state: legacy }));
assert.equal(migrated.status, "loaded");
assert.deepEqual(migrated.state.gameplay.kitchen.servingTables["home-serving-table-01"], {
  itemId: "lemonade", quantity: 1, reservations: [],
});
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "lemonade"), 3);
assert.equal(SESSION_STATE_VERSION, 15);
assert.equal(SAVE_SCHEMA_VERSION, 15);

const guestSource = readFileSync("src/tavern/guestRuntime.js", "utf8");
assert(guestSource.includes("servingTableId"));
assert(guestSource.includes("diningTableId"));
const facilitySource = readFileSync("src/facilities/facilityRuntime.js", "utf8");
assert(facilitySource.includes("const platedDishVisuals = new Map()"));

console.log("Task #058 checks passed: table-owned stock, routed reservations and migration");
