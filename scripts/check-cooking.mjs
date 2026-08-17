import assert from "node:assert/strict";
import {
  attemptCookingStep,
  completeCookingStep,
  consumeServingReservation,
  COOKING_MINIGAME_CONFIG,
  COOKING_STEP_TYPES,
  craftLemonade,
  createCookingStep,
  DEFAULT_KITCHEN_STATE,
  DEFAULT_SERVING_TABLE_ID,
  getComboBonus,
  interactServingTable,
  normalizeKitchenState,
  releaseServingReservation,
  repairStove,
  reserveServingItem,
  SERVING_TABLE_CAPACITY,
  startCookingStep,
  STOVE_REPAIR_COST,
  takeStarterLemons,
} from "../src/tavern/cookingDomain.js";
import {
  addInventoryItem,
  createFreshInventory,
  createInventoryItem,
  getInventoryQuantity,
} from "../src/inventory/inventoryDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { createKitchenInteractionRuntime } from "../src/tavern/kitchenInteractionRuntime.js";
import { SAVE_SCHEMA_VERSION } from "../src/session/sessionPersistence.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const fresh = createFreshGameSessionState();
assert.deepEqual(fresh.gameplay.kitchen, DEFAULT_KITCHEN_STATE);
assert.equal(fresh.version, SESSION_STATE_VERSION);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.equal(getInventoryQuantity(fresh.gameplay.inventory, "potato"), 0);
assert.equal(fresh.gameplay.kitchen.starterLemons, 6);
assert.equal(fresh.gameplay.kitchen.stoveRepaired, false);

assert.throws(
  () => normalizeKitchenState({ ...clone(DEFAULT_KITCHEN_STATE), starterLemons: -1 }),
  /non-negative safe integer/,
);
assert.throws(
  () => normalizeKitchenState({
    ...clone(DEFAULT_KITCHEN_STATE),
    servingTables: { [DEFAULT_SERVING_TABLE_ID]: { itemId: "lemonade", quantity: SERVING_TABLE_CAPACITY + 1, reservations: [] } },
  }),
  /0\.\.1/,
);
assert.deepEqual([1, 2, 3, 4, 5, 9].map((combo) => getComboBonus(combo)), [3, 6, 18, 32, 64, 64]);

const successStep = createCookingStep(COOKING_STEP_TYPES.preparation, () => 0.5);
successStep.markerPosition = successStep.targetPosition + successStep.targetWidth / 2;
const success = attemptCookingStep(successStep, () => 0.25);
assert.equal(success.status, "success");
assert.equal(success.activeStep.remainingSeconds, COOKING_MINIGAME_CONFIG.durationSeconds - 3);

const inventory = createFreshInventory();
const kitchen = normalizeKitchenState();
addInventoryItem(inventory, createInventoryItem("potato", 1));
assert.equal(startCookingStep(kitchen, COOKING_STEP_TYPES.preparation, inventory, () => 0).status, "started");
assert.equal(completeCookingStep(kitchen, COOKING_STEP_TYPES.preparation, inventory).status, "completed");
assert.equal(getInventoryQuantity(inventory, "potato"), 0);
assert.equal(getInventoryQuantity(inventory, "sliced-potato"), 1);
kitchen.stoveRepaired = true;
assert.equal(startCookingStep(kitchen, COOKING_STEP_TYPES.frying, inventory).status, "started");
assert.equal(completeCookingStep(kitchen, COOKING_STEP_TYPES.frying, inventory).status, "completed");
assert.equal(getInventoryQuantity(inventory, "fried-potato-dish"), 1);

const farm = { waterBucket: { capacity: 8, currentWater: 1 } };
addInventoryItem(inventory, createInventoryItem("lemon", 1));
assert.equal(craftLemonade(kitchen, farm, inventory).status, "lemonade-crafted");
assert.equal(farm.waterBucket.currentWater, 0);
assert.equal(getInventoryQuantity(inventory, "lemonade"), 1);
const lemonadeSnapshot = clone(inventory);
assert.equal(craftLemonade(kitchen, farm, inventory).status, "no-lemon");
assert.deepEqual(inventory, lemonadeSnapshot, "failed juicing is atomic");

const sackInventory = createFreshInventory();
assert.equal(takeStarterLemons(kitchen, sackInventory).status, "lemon-sack-depleted");
assert.equal(getInventoryQuantity(sackInventory, "lemon"), 6);
assert.equal(kitchen.starterLemons, 0);
assert.equal(takeStarterLemons(kitchen, sackInventory).status, "lemon-sack-empty");

assert.equal(interactServingTable(kitchen, inventory, DEFAULT_SERVING_TABLE_ID, "lemonade").status, "item-served");
assert.deepEqual(kitchen.servingTables[DEFAULT_SERVING_TABLE_ID], { itemId: "lemonade", quantity: 1, reservations: [] });
assert.deepEqual(reserveServingItem(kitchen, "guest-1"), {
  guestId: "guest-1", itemId: "lemonade", servingTableId: DEFAULT_SERVING_TABLE_ID,
});
assert.equal(interactServingTable(kitchen, inventory, DEFAULT_SERVING_TABLE_ID, null).status, "all-reserved");
assert.deepEqual(consumeServingReservation(kitchen, "guest-1"), {
  itemId: "lemonade", quantity: 0, servingTableId: DEFAULT_SERVING_TABLE_ID,
});
assert.deepEqual(kitchen.servingTables[DEFAULT_SERVING_TABLE_ID], { itemId: null, quantity: 0, reservations: [] });

addInventoryItem(inventory, createInventoryItem("fried-potato-dish", 1));
assert.equal(interactServingTable(kitchen, inventory, DEFAULT_SERVING_TABLE_ID, "fried-potato-dish").status, "item-served");
assert(reserveServingItem(kitchen, "guest-2"));
assert.equal(releaseServingReservation(kitchen, "guest-2"), true);
assert.equal(interactServingTable(kitchen, inventory, DEFAULT_SERVING_TABLE_ID, null).status, "item-taken");

const repairGameplay = createFreshGameSessionState().gameplay;
assert.equal(repairStove(repairGameplay).status, "repair-missing");
addInventoryItem(repairGameplay.inventory, createInventoryItem("wood", 4));
repairGameplay.combatLoadout.slots[4] = createInventoryItem("wood", STOVE_REPAIR_COST.wood - 4);
repairGameplay.combatLoadout.slots[5] = createInventoryItem("stone", STOVE_REPAIR_COST.stone);
repairGameplay.coins = STOVE_REPAIR_COST.coins;
assert.equal(repairStove(repairGameplay).status, "stove-repaired");
assert.equal(repairGameplay.kitchen.stoveRepaired, true);
assert.equal(repairGameplay.coins, 0);
assert.equal(getInventoryQuantity(repairGameplay.inventory, "wood"), 0);
assert.equal(getInventoryQuantity(repairGameplay.inventory, "stone"), 0);
assert.equal(repairGameplay.combatLoadout.slots[4], null);
assert.equal(repairGameplay.combatLoadout.slots[5], null);

const repairMessages = [];
const repairRuntime = createKitchenInteractionRuntime({
  sessionState: createFreshGameSessionState(),
  cookingRuntime: { start: () => ({ status: "unused", mutated: false }) },
  localization: {
    t(key, values = {}) {
      const text = {
        "hud:interaction.repairMissing": "Missing: {categories}",
        "hud:interaction.repairCategory.wood": "wood",
        "hud:interaction.repairCategory.stone": "stone",
        "hud:interaction.repairCategory.coins": "coins",
      }[key] ?? key;
      return text.replace("{categories}", values.categories ?? "?categories?");
    },
  },
  showMessage: (text, options) => repairMessages.push({ text, options }),
});
const presentedRepairFailure = repairRuntime.handleFacility({ facilityType: "gas-stove" });
assert.equal(presentedRepairFailure.transientMessageShown, true);
assert.deepEqual(repairMessages, [{
  text: "Missing: wood, stone, coins",
  options: { literalText: true },
}], "repair failure interpolates localized categories in the system message");

console.log("cooking checks passed: inventory recipes, lemonade, finite sack, serving stock and stove repair");
