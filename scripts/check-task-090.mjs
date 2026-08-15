import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFreshInventory, createInventoryItem, INVENTORY_ITEM_IDS } from "../src/inventory/inventoryDomain.js";
import {
  getSimulationTestItemIds,
  grantSimulationTestCoins,
  grantSimulationTestItem,
  SIMULATION_TEST_GROUPS,
} from "../src/build/simulationTestPalette.js";
import { createStage1Population, setPopulationPersonNeed } from "../src/character/populationDomain.js";
import { NEED_IDS } from "../src/needs/needsDomain.js";
import { needValueFromTrackPointerX } from "../src/ui/needBarGeometry.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const expectedItemIds = [
  "fried-potato-dish", "lemonade", "sliced-potato", "potato", "lemon",
  "potato-seed", "lemon-seed", "wood", "stone", "ruby",
];

assert.deepEqual(getSimulationTestItemIds(), expectedItemIds);
assert(expectedItemIds.every((itemId) => INVENTORY_ITEM_IDS.includes(itemId)));
assert.equal(SIMULATION_TEST_GROUPS.flatMap((group) => group.items).filter((item) => item.id === "coins").length, 1);

const gameplay = { inventory: createFreshInventory(), coins: 7 };
assert.equal(grantSimulationTestItem(gameplay, "lemonade", 1).accepted, 1);
assert.equal(gameplay.inventory.slots.find((slot) => slot?.id === "lemonade")?.quantity, 1);
assert.equal(grantSimulationTestItem(gameplay, "fried-potato-dish", 10).accepted, 10);
assert.equal(gameplay.inventory.slots.find((slot) => slot?.id === "fried-potato-dish")?.quantity, 10);

const partialInventory = createFreshInventory();
partialInventory.slots = Array.from({ length: 10 }, (_value, index) => (
  index === 0 ? createInventoryItem("potato", 95) : createInventoryItem("stone", index + 1)
));
const partial = grantSimulationTestItem({ inventory: partialInventory }, "potato", 10);
assert.deepEqual({ accepted: partial.accepted, remaining: partial.remaining }, { accepted: 4, remaining: 6 });
assert.equal(partialInventory.slots[0].quantity, 99);
const fullBefore = JSON.stringify(partialInventory);
const full = grantSimulationTestItem({ inventory: partialInventory }, "lemon", 10);
assert.equal(full.status, "inventory-full");
assert.equal(full.mutated, false);
assert.equal(JSON.stringify(partialInventory), fullBefore);

assert.deepEqual(grantSimulationTestCoins(gameplay), {
  status: "coins-granted", mutated: true, value: 100, coins: 107,
});
assert.equal(gameplay.coins, 107);

const population = createStage1Population(500);
const before = structuredClone(population[0]);
const mutation = setPopulationPersonNeed(population, before.id, "satiety", 10.4, 777);
assert.equal(mutation.status, "need-set");
assert.equal(population[0].needs.satiety, 10.4);
assert.equal(population[0].lastEvaluatedWorldTimeSeconds, 777);
for (const needId of NEED_IDS.filter((id) => id !== "satiety")) assert.equal(population[0].needs[needId], before.needs[needId]);
assert.equal(population[0].spendingCapacity, before.spendingCapacity);
assert.deepEqual(population[0].foodPreferences, before.foodPreferences);
assert.equal(setPopulationPersonNeed(population, before.id, "satiety", -20, 778).person.needs.satiety, 0);
assert.equal(setPopulationPersonNeed(population, before.id, "satiety", 120, 779).person.needs.satiety, 100);
const invalidBefore = structuredClone(population);
assert.equal(setPopulationPersonNeed(population, "missing", "satiety", 50, 800).mutated, false);
assert.equal(setPopulationPersonNeed(population, before.id, "invalid", 50, 800).mutated, false);
assert.deepEqual(population, invalidBefore);

assert.equal(needValueFromTrackPointerX(10, 100, 10), 0);
assert.equal(needValueFromTrackPointerX(10, 100, 60), 50);
assert.equal(needValueFromTrackPointerX(10, 100, 110), 100);

const buildRuntime = read("src/build/buildModeRuntime.js");
assert(buildRuntime.includes('build: "build"'));
assert(buildRuntime.includes('test: "test"'));
assert(buildRuntime.includes("this.view !== BUILD_PANEL_VIEWS.build"), "TEST view must block world placement paths");
assert(buildRuntime.includes("this.grantTestItem(item.item.id, button.quantity)"));
assert(buildRuntime.includes("this.grantTestCoins(button.quantity)"));
assert(buildRuntime.includes("this.isPointerBlocked(pointer)"));

const inspectionRuntime = read("src/character/personInspectionRuntime.js");
assert(inspectionRuntime.includes("export const NPC_HOVER_EXPAND_MS = 667"));
assert(inspectionRuntime.includes("export const NPC_CARD_EXPAND_MS = 220"));
assert(inspectionRuntime.includes("export const NPC_CARD_LEAVE_GRACE_MS = 660"));
assert(inspectionRuntime.includes("drawNeedsPanel"));
assert(inspectionRuntime.includes("createNeedsPanelGeometry"));
assert(inspectionRuntime.includes("needValueFromTrackPointerX"));
assert(inspectionRuntime.includes("event?.stopPropagation?.()"));
assert(inspectionRuntime.includes("resolveCardRect"));

const guestRuntime = read("src/tavern/guestRuntime.js");
assert(guestRuntime.includes("getActivePersonBindings"));
assert(guestRuntime.includes("actorId: visit.id"));
assert(guestRuntime.includes("personId: visit.personId"));

const bridge = read("src/devtools/e2eBridge.js");
for (const route of [
  "setBuildPanelView", "grantSimulationTestItem", "grantSimulationTestCoins",
  "getPersonInspectionState", "forcePersonInspectionExpanded", "setInspectedPersonNeed",
]) assert(bridge.includes(route), `missing E2E bridge route ${route}`);

const locationRuntime = read("src/world/worldLocationRuntime.js");
assert(locationRuntime.includes("grantSimulationTestItem(this.sessionState.gameplay"));
assert(locationRuntime.includes("setPopulationPersonNeed("));
assert(locationRuntime.includes("this.callbacks.saveSession?.()"));

console.log("Task #090 simulation proof tooling contracts OK");
