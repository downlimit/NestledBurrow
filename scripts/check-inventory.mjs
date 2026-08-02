import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  INVENTORY_SLOT_COUNT,
  COMBAT_LOADOUT_SLOT_COUNT,
  COMBAT_ACTION_SLOT_INDEXES,
  COMBAT_NUMBER_SLOT_INDEXES,
  LOADOUT_PANELS,
  addInventoryItem,
  createEmptyCombatLoadout,
  createFreshInventory,
  createInventoryItem,
  createNewGameInventory,
  getInventoryQuantity,
  normalizeInventory,
  normalizeCombatLoadout,
  normalizeWorldItems,
  preferredCombatActionIdForItem,
  routePickedInventoryItem,
  swapInventorySlots,
  swapLoadoutSlots,
  takeInventorySlot,
} from "../src/inventory/inventoryDomain.js";
import { createFreshGameSessionState, hitResourceNode, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, serializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/session/sessionPersistence.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resources/resourceConfig.js";
import {
  INVENTORY_HUD_AREA,
  INVENTORY_SLOT_AREAS,
  INVENTORY_WATER_BAR_HEIGHT,
  INVENTORY_WATER_BAR_WIDTH,
  inventoryCycleDirectionFromKeyboardEvent,
  inventoryCycleDirectionFromWheelEvent,
  inventoryCycleIndex,
  inventoryIndexFromKeyboardEvent,
  inventorySlotIndexAt,
  inventoryWaterBarState,
  shouldRenderInventoryQuantity,
} from "../src/inventory/inventoryRuntime.js";
import {
  THROW_ORIGIN_HEIGHT_RATIO,
  throwDirectionTowardPoint,
  throwOriginFromPlayer,
} from "../src/inventory/worldThrowDirection.js";

const inventory = createFreshInventory();
assert.equal(INVENTORY_SLOT_COUNT, 10);
assert.equal(inventory.slots.length, 10);
assert.deepEqual(inventory.slots.slice(0, 4).map((item) => item.id), ["axe", "pickaxe", "hoe", "water-bucket"]);
assert(inventory.slots.slice(4).every((item) => item === null));
const newGameInventory = createNewGameInventory();
assert.equal(getInventoryQuantity(newGameInventory, "potato-seed"), 4);
assert.equal(getInventoryQuantity(newGameInventory, "potato"), 0);
const combatLoadout = createEmptyCombatLoadout();
assert.equal(COMBAT_LOADOUT_SLOT_COUNT, 10);
assert.equal(combatLoadout.slots.length, 10);
assert(combatLoadout.slots.every((item) => item === null));
assert.deepEqual(COMBAT_ACTION_SLOT_INDEXES, { space: 0, lmb: 1, rmb: 2, shift: 3 });
assert.deepEqual(COMBAT_NUMBER_SLOT_INDEXES, [4, 5, 6, 7, 8, 9]);
assert.equal(preferredCombatActionIdForItem("sword"), "lmb");
assert.equal(preferredCombatActionIdForItem("battle-axe"), "rmb");
assert.equal(preferredCombatActionIdForItem("crossbow"), "space");
assert.equal(preferredCombatActionIdForItem("blink-amulet"), "shift");

const swordPickupInventory = createFreshInventory();
const swordPickupCombat = createEmptyCombatLoadout();
const swordPickup = routePickedInventoryItem(
  { inventory: swordPickupInventory, combatLoadout: swordPickupCombat },
  createInventoryItem("sword"),
);
assert.equal(swordPickup.panel, LOADOUT_PANELS.COMBAT);
assert.equal(swordPickup.slotIndex, COMBAT_ACTION_SLOT_INDEXES.lmb);
assert.equal(swordPickupCombat.slots[COMBAT_ACTION_SLOT_INDEXES.lmb].id, "sword");

const axePickupInventory = createFreshInventory();
const axePickupCombat = createEmptyCombatLoadout();
const axePickup = routePickedInventoryItem(
  { inventory: axePickupInventory, combatLoadout: axePickupCombat },
  createInventoryItem("battle-axe"),
);
assert.equal(axePickup.slotIndex, COMBAT_ACTION_SLOT_INDEXES.rmb);

const peacefulPickupInventory = createFreshInventory();
const peacefulPickupCombat = createEmptyCombatLoadout();
const peacefulWood = routePickedInventoryItem(
  { inventory: peacefulPickupInventory, combatLoadout: peacefulPickupCombat },
  createInventoryItem("wood"),
);
assert.equal(peacefulWood.panel, LOADOUT_PANELS.PEACEFUL);

const combatPickupInventory = createFreshInventory();
const combatPickupCombat = createEmptyCombatLoadout();
const combatWood = routePickedInventoryItem(
  { inventory: combatPickupInventory, combatLoadout: combatPickupCombat },
  createInventoryItem("wood"),
  { combatMode: true },
);
assert.equal(combatWood.panel, LOADOUT_PANELS.COMBAT);
assert.equal(combatWood.slotIndex, COMBAT_NUMBER_SLOT_INDEXES[0]);

const occupiedActionInventory = createFreshInventory();
const occupiedActionCombat = createEmptyCombatLoadout();
occupiedActionCombat.slots[COMBAT_ACTION_SLOT_INDEXES.lmb] = createInventoryItem("wood");
const numericSword = routePickedInventoryItem(
  { inventory: occupiedActionInventory, combatLoadout: occupiedActionCombat },
  createInventoryItem("sword"),
);
assert.equal(numericSword.slotIndex, COMBAT_NUMBER_SLOT_INDEXES[0], "occupied preferred action falls back to combat number 1");

const fullCombatInventory = createFreshInventory();
const fullCombatLoadout = createEmptyCombatLoadout();
for (const index of [COMBAT_ACTION_SLOT_INDEXES.lmb, ...COMBAT_NUMBER_SLOT_INDEXES]) {
  fullCombatLoadout.slots[index] = createInventoryItem(`occupied-${index}`);
}
const peacefulSwordFallback = routePickedInventoryItem(
  { inventory: fullCombatInventory, combatLoadout: fullCombatLoadout },
  createInventoryItem("sword"),
);
assert.equal(peacefulSwordFallback.panel, LOADOUT_PANELS.PEACEFUL);
const loadoutInventory = createNewGameInventory();
const equipped = swapLoadoutSlots(
  { inventory: loadoutInventory, combatLoadout },
  { panel: LOADOUT_PANELS.PEACEFUL, index: 0 },
  { panel: LOADOUT_PANELS.COMBAT, index: 4 },
);
assert.equal(equipped.mutated, true);
assert.equal(loadoutInventory.slots[0], null);
assert.equal(combatLoadout.slots[4].id, "axe");
const unequipped = swapLoadoutSlots(
  { inventory: loadoutInventory, combatLoadout },
  { panel: LOADOUT_PANELS.COMBAT, index: 4 },
  { panel: LOADOUT_PANELS.PEACEFUL, index: 0 },
);
assert.equal(unequipped.mutated, true);
assert.equal(loadoutInventory.slots[0].id, "axe");
assert.equal(combatLoadout.slots[4], null);
assert.deepEqual(
  normalizeCombatLoadout({ slots: [createInventoryItem("axe")] }, { reservedToolIds: ["axe"] }).slots,
  Array.from({ length: COMBAT_LOADOUT_SLOT_COUNT }, () => null),
  "normalization cannot duplicate a tool across peaceful inventory and combat loadout",
);

assert.equal(addInventoryItem(inventory, createInventoryItem("wood", 3)).status, "inserted");
assert.equal(addInventoryItem(inventory, createInventoryItem("wood", 2)).status, "stacked");
assert.equal(getInventoryQuantity(inventory, "wood"), 5);
const woodIndex = inventory.slots.findIndex((item) => item?.id === "wood");
assert.equal(swapInventorySlots(inventory, 1, woodIndex).status, "swapped");
assert.equal(inventory.slots[1].id, "wood");
assert.equal(inventory.slots[woodIndex].id, "pickaxe");
assert.equal(takeInventorySlot(inventory, 1).item.quantity, 5);
assert.equal(inventory.slots[1], null);
assert.equal(normalizeInventory({ slots: [...inventory.slots, createInventoryItem("ruby")] }).slots.length, 10);
assert.deepEqual(normalizeWorldItems([{ id: "dropped-item-1", item: { id: "wood", quantity: 2 }, x: 20, y: 30 }]), [{ id: "dropped-item-1", item: { id: "wood", kind: "loot", quantity: 2 }, x: 20, y: 30 }]);

assert.equal(INVENTORY_SLOT_AREAS.length, 10);
assert.equal(INVENTORY_HUD_AREA.x, 43);
assert.equal(INVENTORY_HUD_AREA.y, 156);
assert.equal(INVENTORY_HUD_AREA.width, 238);
assert.equal(shouldRenderInventoryQuantity(createInventoryItem("lemonade", 1)), true, "single consumables keep a visible quantity label");
assert.equal(shouldRenderInventoryQuantity(createInventoryItem("water-bucket")), false, "tools do not show quantity labels");
assert.equal(INVENTORY_WATER_BAR_WIDTH, 4);
assert.equal(INVENTORY_WATER_BAR_HEIGHT, 16);
assert.deepEqual(inventoryWaterBarState(INVENTORY_SLOT_AREAS[3], 6, 12), {
  x: INVENTORY_SLOT_AREAS[3].x + 16,
  y: INVENTORY_SLOT_AREAS[3].y + 3,
  width: 4,
  height: 16,
  ratio: 0.5,
  fillHeight: 7,
});
assert(INVENTORY_SLOT_AREAS.every((rect) => rect.width === 22 && rect.height === 22));
INVENTORY_SLOT_AREAS.forEach((rect, index) => assert.equal(inventorySlotIndexAt(rect.x + 1, rect.y + 1), index));
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit1" }), 0);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Numpad9" }), 8);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit0" }), 9);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Numpad0" }), 9);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit4", repeat: true }), null);
assert.equal(inventoryIndexFromKeyboardEvent({ code: "Digit4", target: { tagName: "INPUT" } }), null);
assert.equal(inventoryCycleDirectionFromKeyboardEvent({ code: "KeyE" }), 1);
assert.equal(inventoryCycleDirectionFromKeyboardEvent({ code: "KeyQ" }), -1);
assert.equal(inventoryCycleDirectionFromKeyboardEvent({ code: "KeyE", repeat: true }), 0);
assert.equal(inventoryCycleDirectionFromWheelEvent({ deltaY: 120 }), 1);
assert.equal(inventoryCycleDirectionFromWheelEvent({ deltaY: -120 }), -1);
assert.equal(inventoryCycleDirectionFromWheelEvent({ deltaY: 0 }), 0);
assert.equal(inventoryCycleDirectionFromWheelEvent({ deltaY: 120, target: { tagName: "INPUT" } }), 0);
assert.equal(inventoryCycleIndex(newGameInventory.slots, null, 1), 0);
assert.equal(inventoryCycleIndex(newGameInventory.slots, 2, 1), 3);
assert.equal(inventoryCycleIndex(newGameInventory.slots, 0, -1), 4);
assert.deepEqual(throwDirectionTowardPoint({ x: 10, y: 20 }, { x: 20, y: 20 }, "up"), { x: 1, y: 0 });
assert.deepEqual(throwDirectionTowardPoint({ x: 10, y: 20 }, { x: 13, y: 24 }, "up"), { x: 0.6, y: 0.8 });
assert.deepEqual(throwDirectionTowardPoint({ x: 10, y: 20 }, { x: 10, y: 20 }, "left"), { x: -1, y: 0 });
assert.equal(THROW_ORIGIN_HEIGHT_RATIO, 1 / 3);
assert.deepEqual(throwOriginFromPlayer({ x: 10, y: 20, displayHeight: 12 }), { x: 10, y: 16 });

const droppedToolInventory = createFreshInventory();
const droppedAxe = takeInventorySlot(droppedToolInventory, 0).item;
assert.equal(addInventoryItem(droppedToolInventory, droppedAxe).mutated, true);
assert.equal(droppedToolInventory.slots[0].id, "axe", "picked-up tools execute their planned insertion");

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
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "potato-seed"), 0);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "potato"), 0);
assert.deepEqual(migrated.state.gameplay.worldItems, []);
const serialized = JSON.parse(serializeSessionEnvelope(migrated.state));
assert.equal(serialized.schemaVersion, SAVE_SCHEMA_VERSION);
assert.equal(serialized.state.version, SESSION_STATE_VERSION);
assert("inventory" in serialized.state.gameplay);
assert("combatLoadout" in serialized.state.gameplay);
assert("worldItems" in serialized.state.gameplay);
assert(!("wood" in serialized.state.gameplay));
assert(!("stone" in serialized.state.gameplay));
assert(!("rubies" in serialized.state.gameplay));

const rewardState = createFreshGameSessionState();
const clear = hitResourceNode(rewardState, "fallen-log-01", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING });
assert.equal(clear.status, "cleared");
assert.equal(getInventoryQuantity(rewardState.gameplay.inventory, "wood"), 1);

const fullState = createFreshGameSessionState();
for (let index = 4; index < 10; index += 1) fullState.gameplay.inventory.slots[index] = createInventoryItem(`future-${index}`, 1);
const beforeFull = JSON.parse(JSON.stringify(fullState));
const blocked = hitResourceNode(fullState, "fallen-log-01", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING });
assert.equal(blocked.status, "inventory-full");
assert.equal(blocked.mutated, false);
assert.deepEqual(JSON.parse(JSON.stringify(fullState)), beforeFull, "full-inventory final hit is atomic");

const runtimeSource = readFileSync("src/inventory/inventoryRuntime.js", "utf8");
const hudSource = readFileSync("src/ui/gameHud.js", "utf8");
assert(runtimeSource.includes("swapInventorySlots") && runtimeSource.includes("dropSlot(fromIndex, worldPointFromPointer(scene, pointer))"));
assert(runtimeSource.includes("routePickedInventoryItem") && runtimeSource.includes("combatMode: isCombatMode()"));
assert(hudSource.includes("dropLoadoutSlot") && readFileSync("src/inventory/loadoutDragCoordinator.js", "utf8").includes("onWorldDrop(source, pointer)"), "loadout edit can drop combat slots into the world");
assert(runtimeSource.includes("throwOriginFromPlayer(sprite)") && runtimeSource.includes("throwDirectionTowardPoint(origin, pointerWorld, character.lastFacing)"));
assert(runtimeSource.includes("DROP_HITBOX_SIZE = 2"));
assert(runtimeSource.includes("directionX *= -1") && runtimeSource.includes("directionY *= -1"));
assert(runtimeSource.includes("findNearestFreePoint"));
assert(runtimeSource.includes("TOOL_VISIBLE_MS = 1000") && runtimeSource.includes("TOOL_FADE_MS = 1000"));
assert(runtimeSource.includes("drawBitmapTextInto"), "slot labels use crisp project bitmap glyphs");
assert(runtimeSource.includes('item.id === "water-bucket"') && runtimeSource.includes("renderWaterBar(rect)"), "bucket fill renders vertically inside its own slot");
assert(runtimeSource.includes("presentationContainer") && runtimeSource.includes("setInputEnabled(value)"), "screen hotbar exposes the presentation-only transform/input adapter");
assert(runtimeSource.includes('scene.input.on("wheel", handleWheel)') && runtimeSource.includes('scene.input.off("wheel", handleWheel)'), "peaceful inventory owns wheel cycling lifecycle");
assert(!hudSource.includes("inventoryHud?.clearSelection?.()"), "combat mode preserves peaceful inventory selection");
assert(runtimeSource.includes("worldPresentationActive()"), "held world-space item visibility stays outside panel interactivity");
assert(hudSource.includes("createInventoryRuntime(scene"));
assert(hudSource.includes("presentation: inventoryHud.presentation"), "inventory gain cues share the hotbar transform");
assert(!hudSource.includes("woodValueText"), "old resource text counters are removed");

console.log("inventory checks passed: ten slots, swap/drop ownership, presentation adapter, migration, atomic rewards and input geometry");
