import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";

export const SALE_PROFILES = Object.freeze({
  "fried-potato-dish": Object.freeze({
    itemId: "fried-potato-dish",
    price: 4,
    cuisine: "local",
    dishClass: "hot",
    ingredients: Object.freeze(["potato"]),
  }),
  lemonade: Object.freeze({
    itemId: "lemonade",
    price: 2,
    cuisine: "local",
    dishClass: "drink",
    ingredients: Object.freeze(["lemon"]),
  }),
});

export function getSaleProfile(itemId) {
  return SELLABLE_ITEM_IDS.includes(itemId) ? SALE_PROFILES[itemId] ?? null : null;
}

export function getSalePrice(itemId) {
  return getSaleProfile(itemId)?.price ?? 0;
}

export function getSaleProfiles(itemIds = SELLABLE_ITEM_IDS) {
  return itemIds.map((itemId) => getSaleProfile(itemId)).filter(Boolean);
}
