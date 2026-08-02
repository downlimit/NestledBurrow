import { addInventoryItem, canAddInventoryItem, createInventoryItem } from "../inventory/inventoryDomain.js";

export const POTATO_SEED_PRICE = 1;
export const LEMON_SEED_PRICE = 2;
export const SEED_OFFERS = Object.freeze({
  "potato-seed": POTATO_SEED_PRICE,
  "lemon-seed": LEMON_SEED_PRICE,
});

export function purchaseSeed(gameplay, itemId) {
  const price = SEED_OFFERS[itemId];
  if (!price) return { status: "unknown-offer", mutated: false };
  if (!Number.isSafeInteger(gameplay?.coins) || gameplay.coins < price) {
    return { status: "not-enough-coins", mutated: false };
  }
  const item = createInventoryItem(itemId, 1);
  const capacity = canAddInventoryItem(gameplay.inventory, item);
  if (!capacity.canAdd) return { status: "inventory-full", mutated: false };
  const inventory = addInventoryItem(gameplay.inventory, item);
  if (!inventory.mutated) return { status: inventory.status, mutated: false };
  gameplay.coins -= price;
  return { status: "purchased", mutated: true, itemId, price, coins: gameplay.coins, inventory };
}

export function purchasePotatoSeed(gameplay) {
  return purchaseSeed(gameplay, "potato-seed");
}

export function purchaseLemonSeed(gameplay) {
  return purchaseSeed(gameplay, "lemon-seed");
}
