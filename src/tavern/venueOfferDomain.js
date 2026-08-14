import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";

export const DEFAULT_VENUE_OFFER = Object.freeze({
  foodItemIds: Object.freeze([...SELLABLE_ITEM_IDS]),
});

export function createDefaultVenueOffer() {
  return { foodItemIds: [...DEFAULT_VENUE_OFFER.foodItemIds] };
}

export function normalizeVenueOffer(value = DEFAULT_VENUE_OFFER) {
  const candidateIds = value
    && typeof value === "object"
    && !Array.isArray(value)
    && Array.isArray(value.foodItemIds)
      ? value.foodItemIds
      : DEFAULT_VENUE_OFFER.foodItemIds;
  const requestedIds = new Set(candidateIds.filter((itemId) => typeof itemId === "string"));
  return {
    foodItemIds: SELLABLE_ITEM_IDS.filter((itemId) => requestedIds.has(itemId)),
  };
}

export function isVenueOfferItemActive(venueOffer, itemId) {
  return SELLABLE_ITEM_IDS.includes(itemId)
    && normalizeVenueOffer(venueOffer).foodItemIds.includes(itemId);
}

export function setVenueOfferItemActive(venueOffer, itemId, active) {
  if (!SELLABLE_ITEM_IDS.includes(itemId)) {
    return { status: "unknown-item", mutated: false, venueOffer: normalizeVenueOffer(venueOffer) };
  }
  const normalized = normalizeVenueOffer(venueOffer);
  const nextIds = new Set(normalized.foodItemIds);
  if (active) nextIds.add(itemId);
  else nextIds.delete(itemId);
  const foodItemIds = SELLABLE_ITEM_IDS.filter((candidateId) => nextIds.has(candidateId));
  const mutated = foodItemIds.length !== normalized.foodItemIds.length
    || foodItemIds.some((candidateId, index) => candidateId !== normalized.foodItemIds[index]);
  if (venueOffer && typeof venueOffer === "object" && !Array.isArray(venueOffer)) {
    venueOffer.foodItemIds = foodItemIds;
  }
  return { status: mutated ? "updated" : "unchanged", mutated, venueOffer: { foodItemIds: [...foodItemIds] } };
}

export function toggleVenueOfferItem(venueOffer, itemId) {
  return setVenueOfferItemActive(venueOffer, itemId, !isVenueOfferItemActive(venueOffer, itemId));
}
