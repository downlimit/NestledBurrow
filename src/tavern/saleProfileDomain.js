import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";

export const SERVICE_FORMATS = Object.freeze({
  assisted: "assisted",
  takeaway: "takeaway",
  selfService: "self-service",
});

export const SALE_PROFILES = Object.freeze({
  "fried-potato-dish": Object.freeze({
    itemId: "fried-potato-dish",
    price: 4,
    cuisine: "local",
    dishClass: "hot",
    ingredients: Object.freeze(["potato"]),
    serviceFormats: Object.freeze([SERVICE_FORMATS.assisted, SERVICE_FORMATS.selfService]),
  }),
  lemonade: Object.freeze({
    itemId: "lemonade",
    price: 2,
    cuisine: "local",
    dishClass: "drink",
    ingredients: Object.freeze(["lemon"]),
    serviceFormats: Object.freeze([
      SERVICE_FORMATS.assisted,
      SERVICE_FORMATS.takeaway,
      SERVICE_FORMATS.selfService,
    ]),
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

export function getSaleProfileTags(profileOrItemId) {
  const profile = typeof profileOrItemId === "string" ? getSaleProfile(profileOrItemId) : profileOrItemId;
  if (!profile) return [];
  return [
    `cuisine:${profile.cuisine}`,
    `dishClass:${profile.dishClass}`,
    ...profile.ingredients.map((ingredient) => `ingredient:${ingredient}`),
  ];
}

export function isServiceFormatAllowed(itemId, serviceFormat) {
  return getSaleProfile(itemId)?.serviceFormats.includes(serviceFormat) ?? false;
}

export function chooseServiceFormat(itemId, {
  hasSelfServiceStock = false,
  hasServicePlace = false,
  preferTakeaway = false,
  requestedFormat = null,
} = {}) {
  const profile = getSaleProfile(itemId);
  if (!profile) return null;
  const requested = requestedFormat === "auto" ? null : requestedFormat;
  if (requested === SERVICE_FORMATS.selfService) {
    return hasSelfServiceStock && profile.serviceFormats.includes(requested) ? requested : null;
  }
  if (requested) {
    return hasServicePlace && profile.serviceFormats.includes(requested) ? requested : null;
  }
  if (hasSelfServiceStock && profile.serviceFormats.includes(SERVICE_FORMATS.selfService)) {
    return SERVICE_FORMATS.selfService;
  }
  if (!hasServicePlace) return null;
  if (preferTakeaway && profile.serviceFormats.includes(SERVICE_FORMATS.takeaway)) {
    return SERVICE_FORMATS.takeaway;
  }
  if (profile.serviceFormats.includes(SERVICE_FORMATS.assisted)) return SERVICE_FORMATS.assisted;
  return profile.serviceFormats.includes(SERVICE_FORMATS.takeaway) ? SERVICE_FORMATS.takeaway : null;
}
