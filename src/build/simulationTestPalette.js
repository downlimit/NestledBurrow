import {
  addInventoryItemUpTo,
  createInventoryItem,
  INVENTORY_ITEM_IDS,
} from "../inventory/inventoryDomain.js";

export const SIMULATION_TEST_GROUPS = Object.freeze([
  Object.freeze({
    id: "food",
    labelKey: "hud:buildMode.test.groups.food",
    items: Object.freeze([
      Object.freeze({ id: "fried-potato-dish", labelKey: "hud:buildMode.test.items.friedPotato" }),
      Object.freeze({ id: "lemonade", labelKey: "hud:buildMode.test.items.lemonade" }),
      Object.freeze({ id: "sliced-potato", labelKey: "hud:buildMode.test.items.slicedPotato" }),
    ]),
  }),
  Object.freeze({
    id: "produce",
    labelKey: "hud:buildMode.test.groups.produce",
    items: Object.freeze([
      Object.freeze({ id: "potato", labelKey: "hud:buildMode.test.items.potato" }),
      Object.freeze({ id: "lemon", labelKey: "hud:buildMode.test.items.lemon" }),
    ]),
  }),
  Object.freeze({
    id: "seeds",
    labelKey: "hud:buildMode.test.groups.seeds",
    items: Object.freeze([
      Object.freeze({ id: "potato-seed", labelKey: "hud:buildMode.test.items.potatoSeed" }),
      Object.freeze({ id: "lemon-seed", labelKey: "hud:buildMode.test.items.lemonSeed" }),
    ]),
  }),
  Object.freeze({
    id: "resources",
    labelKey: "hud:buildMode.test.groups.resources",
    items: Object.freeze([
      Object.freeze({ id: "wood", labelKey: "hud:buildMode.test.items.wood" }),
      Object.freeze({ id: "stone", labelKey: "hud:buildMode.test.items.stone" }),
      Object.freeze({ id: "ruby", labelKey: "hud:buildMode.test.items.ruby" }),
    ]),
  }),
  Object.freeze({
    id: "economy",
    labelKey: "hud:buildMode.test.groups.economy",
    items: Object.freeze([
      Object.freeze({ id: "coins", labelKey: "hud:buildMode.test.items.coins", quantities: Object.freeze([100]) }),
    ]),
  }),
]);

const PALETTE_ITEM_IDS = Object.freeze(SIMULATION_TEST_GROUPS
  .flatMap((group) => group.items)
  .map((item) => item.id)
  .filter((itemId) => itemId !== "coins"));

for (const itemId of PALETTE_ITEM_IDS) {
  if (!INVENTORY_ITEM_IDS.includes(itemId)) throw new Error(`Unknown simulation test item: ${itemId}`);
}

export function grantSimulationTestItem(gameplay, itemId, quantity) {
  if (!gameplay?.inventory || !PALETTE_ITEM_IDS.includes(itemId)) {
    return { status: "invalid-test-item", mutated: false, accepted: 0, remaining: 0 };
  }
  const requested = Number(quantity);
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return { status: "invalid-quantity", mutated: false, accepted: 0, remaining: 0 };
  }
  return addInventoryItemUpTo(gameplay.inventory, createInventoryItem(itemId, requested));
}

export function grantSimulationTestCoins(gameplay, amount = 100) {
  const requested = Number(amount);
  const current = Number(gameplay?.coins);
  if (!gameplay || !Number.isSafeInteger(requested) || requested <= 0 || !Number.isSafeInteger(current) || current < 0) {
    return { status: "invalid-coin-grant", mutated: false, value: 0 };
  }
  if (!Number.isSafeInteger(current + requested)) return { status: "coin-limit", mutated: false, value: 0 };
  gameplay.coins = current + requested;
  return { status: "coins-granted", mutated: true, value: requested, coins: gameplay.coins };
}

export function getSimulationTestItemIds() {
  return [...PALETTE_ITEM_IDS];
}
