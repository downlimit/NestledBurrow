import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INVENTORY_SLOT_COUNT,
  addInventoryItem,
  createFreshInventory,
  createInventoryItem,
  getInventoryQuantity,
  normalizeInventory,
  normalizeWorldItems,
  swapInventorySlots,
  takeInventorySlot,
} from "../src/inventoryDomain.js";
import { createFreshGameSessionState, hitResourceNode, SESSION_STATE_VERSION } from "../src/gameSessionState.js";
import { deserializeSessionEnvelope, serializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/sessionPersistence.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resourceConfig.js";
import {
  INVENTORY_HUD_AREA,
  INVENTORY_SLOT_AREAS,
  inventoryIndexFromKeyboardEvent,
  inventorySlotIndexAt,
} from "../src/inventoryRuntime.js";

const inventory = createFreshInventory();
assert.equal(INVENTORY_SLOT_COUNT, 10);
assert.equal(inventory.slots.length, 10);
assert.deepEqual(inventory.slots.slice(0, 3).map((item) => item.id), ["axe", "hoe", "watering-can"]);
assert(inventory.slots.slice(3).every((item) => item === null));

assert.equal(addInventoryItem(inventory, createInventoryItem("wood", 3)).status, "inserted");
assert.equal(addInventoryItem(inventory, createInventoryItem("wood", 2)).status, "stacked");
assert.equal(getInventoryQuantity(inventory, "wood"), 5);
const woodIndex = inventory.slots.findIndex((item) => item?.id === "wood");
assert.equal(swapInventorySlots(inventory, 1, woodIndex).status, "swapped");
assert.equal(inventory.slots[1].id, "wood");
assert.equal(inventory.slots[woodIndex].id, "hoe");
assert.equal(takeInventorySlot(inventory, 1).item.quantity, 5);
assert.equal(inventory.slots[1], null);
assert.equal(normalizeInventory({ slots: [...inventory.slots, createInventoryItem("ruby")] }).slots.length, 10);
assert.deepEqual(normalizeWorldItems([{ id: "dropped-item-1", item: { id: "wood", quantity: 2 }, x: 20, y: 30 }]), [{ id: "dropped-item-1", item: { id: "wood", kind: "loot", quantity: 2 }, x: 20, y: 30 }]);

assert.equal(INVENTORY_SLOT_AREAS.length, 10);
assert.equal(INVENTORY_HUD_AREA.x, 41);
assert.equal(INVENTORY_HUD_AREA.y, 156);
assert.equal(INVENTORY_HUD_AREA.width, 238);
assert(INVENTORY_SLOT_AREAS.every((rect) => rect.width === 22 && rect.height === 22));
INVENTORY_SLOT_AREAS.forEach((rect, index) => assert.equal(inventorySlotIndexAt(rect.x + 1, rect.y + 1), index));
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit1" }), 0);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Numpad9" }), 8);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit0" }), 9);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Numpad0" }), 9);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit4", repeat: true }), null);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit4", target: { tagName: "INPUT" } }), null);

const legacyState = JSON.parse(JSON.stringify(createFreshGameSessionState()));
legacyState.version = 6;
delete legacyState.gameplay.inventory;
delete legacyState.gameplay.worldItems;
legacyState.gameplay.wood = 7;
legacyState.gameplay.stone = 2;
legacyState.gameplay.rubies = 1;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 6, state: legacyState }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.version, SESSION_STATE_VERSION);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "wood"), 7);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "stone"), 2);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "ruby"), 1);
assert.deepEqual(migrated.state.gameplay.worldItems, []);
const serialized = JSON.parse(serializeSessionEnvelope(migrated.state));
assert.equal(serialized.schemaVersion, SAVE_SCHEMA_VERSION);
assert.equal(serialized.state.version, SESSION_STATE_VERSION);
assert("inventory" in serialized.state.gameplay);
assert("worldItems" in serialized.state.gameplay);
assert(!("wood" in serialized.state.gameplay));
assert(!("stone" in serialized.state.gameplay));
assert(!("rubies" in serialized.state.gameplay));

const rewardState = createFreshGameSessionState();
const clear = hitResourceNode(rewardState, "fallen-log-01", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING });
assert.equal(clear.status, "cleared");
assert.equal(getInventoryQuantity(rewardState.gameplay.inventory, "wood"), 1);

const fullState = createFreshGameSessionState();
for (let index = 3; index < 10; index += 1) fullState.gameplay.inventory.slots[index] = createInventoryItem(`future-${index}`, 1);
const beforeFull = JSON.parse(JSON.stringify(fullState));
const blocked = hitResourceNode(fullState, "fallen-log-01", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING });
assert.equal(blocked.status, "inventory-full");
assert.equal(blocked.mutated, false);
assert.deepEqual(JSON.parse(JSON.stringify(fullState)), beforeFull, "full-inventory final hit is atomic");

const runtimeSource = readFileSync("src/inventoryRuntime.js", "utf8");
const hudSource = readFileSync("src/gameHud.js", "utf8");
assert(runtimeSource.includes("swapInventorySlots") && runtimeSource.includes("dropSlot(fromIndex)"));
assert(runtimeSource.includes("DROP_HITBOX_SIZE = 2"));
assert(runtimeSource.includes("directionX *= -1") && runtimeSource.includes("directionY *= -1"));
assert(runtimeSource.includes("findNearestFreePoint"));
assert(runtimeSource.includes("TOOL_VISIBLE_MS = 1000") && runtimeSource.includes("TOOL_FADE_MS = 1000"));
assert(runtimeSource.includes("drawBitmapTextInto"), "slot labels use crisp project bitmap glyphs");
assert(hudSource.includes("createInventoryRuntime(scene"));
assert(!hudSource.includes("woodValueText"), "old resource text counters are removed");

console.log("inventory checks passed: ten slots, swap/drop ownership, migration, atomic rewards and input geometry");
