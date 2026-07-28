import { addInventoryItem, canAddInventoryItem, createInventoryItem } from "./inventoryDomain.js";

export const POTATO_SEED_PRICE = 1;

export function purchasePotatoSeed(gameplay) {
  if (!Number.isSafeInteger(gameplay?.coins) || gameplay.coins < POTATO_SEED_PRICE) {
    return { status: "not-enough-coins", mutated: false };
  }
  const item = createInventoryItem("potato-seed", 1);
  const capacity = canAddInventoryItem(gameplay.inventory, item);
  if (!capacity.canAdd) return { status: "inventory-full", mutated: false };
  const inventory = addInventoryItem(gameplay.inventory, item);
  if (!inventory.mutated) return { status: inventory.status, mutated: false };
  gameplay.coins -= POTATO_SEED_PRICE;
  return { status: "purchased", mutated: true, coins: gameplay.coins, inventory };
}
