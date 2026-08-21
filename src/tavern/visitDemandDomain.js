import { personEconomyProfile, priceAppealForPerson } from "../character/personEconomyProfile.js";
import { normalizeVenueOffer } from "./venueOfferDomain.js";
import { getSalePriceBand, getSaleProfiles } from "./saleProfileDomain.js";

export const FOOD_PREFERENCE_WEIGHTS = Object.freeze({
  cuisine: 0.5,
  dishClass: 0.3,
  ingredient: 0.2,
});
export const RECENT_VISIT_RECOVERY_HOURS = 12;
export const RECENT_VISIT_MIN_FACTOR = 0.15;

export function foodMotiveFromSatiety(satiety) {
  const value = clamp(Number(satiety), 0, 100);
  if (value >= 60) return 0;
  if (value <= 20) return 1;
  return round((60 - value) / 40);
}

export function scoreFoodPreference(foodPreferences, saleProfile) {
  if (!saleProfile) return -1;
  const cuisine = preferenceValue(foodPreferences?.cuisine?.[saleProfile.cuisine]);
  const dishClass = preferenceValue(foodPreferences?.dishClass?.[saleProfile.dishClass]);
  const ingredientValues = saleProfile.ingredients.map((ingredient) => (
    preferenceValue(foodPreferences?.ingredient?.[ingredient])
  ));
  const ingredientAverage = ingredientValues.length > 0
    ? ingredientValues.reduce((total, value) => total + value, 0) / ingredientValues.length
    : 0;
  return round(
    cuisine * FOOD_PREFERENCE_WEIGHTS.cuisine
    + dishClass * FOOD_PREFERENCE_WEIGHTS.dishClass
    + ingredientAverage * FOOD_PREFERENCE_WEIGHTS.ingredient,
  );
}

export function recentVisitFactor(visitorHistory, worldTimeSeconds) {
  const meaningfulVisits = [
    visitorHistory?.lastCompletedVisitWorldTimeSeconds,
    visitorHistory?.lastFailedAcceptedOrderWorldTimeSeconds,
  ].filter((value) => Number.isFinite(value) && value >= 0);
  const lastVisit = meaningfulVisits.length > 0 ? Math.max(...meaningfulVisits) : null;
  if (!Number.isFinite(lastVisit) || lastVisit < 0) {
    return { hoursSinceLastVisit: null, recentVisitFactor: 1 };
  }
  const elapsedSeconds = Math.max(0, Number(worldTimeSeconds) - lastVisit);
  const hoursSinceLastVisit = round(elapsedSeconds / (60 * 60));
  const recovery = clamp(hoursSinceLastVisit / RECENT_VISIT_RECOVERY_HOURS, 0, 1);
  return {
    hoursSinceLastVisit,
    recentVisitFactor: round(RECENT_VISIT_MIN_FACTOR + (1 - RECENT_VISIT_MIN_FACTOR) * recovery),
  };
}

export function decideFoodVisit({
  person,
  venueOffer,
  visitorHistory = null,
  venueOpinionScore = 0,
  venueOpinionFactor = 1,
  serviceReliability = 0,
  serviceReliabilityFactor = 1,
  worldTimeSeconds = 0,
  randomSource = Math.random,
} = {}) {
  if (!person?.id) throw new Error("Visit decision requires a persistent person");
  const satiety = clamp(Number(person.needs?.satiety), 0, 100);
  const foodMotive = foodMotiveFromSatiety(satiety);
  const normalizedOffer = normalizeVenueOffer(venueOffer);
  const economyProfile = personEconomyProfile(person);
  const affordableProfiles = getSaleProfiles(normalizedOffer.foodItemIds)
    .filter((profile) => profile.price <= person.spendingCapacity)
    .map((profile) => {
      const preferenceScore = scoreFoodPreference(person.foodPreferences, profile);
      const tasteFit = round((preferenceScore + 1) / 2);
      const priceBand = getSalePriceBand(profile);
      const priceAppeal = priceAppealForPerson(person, priceBand);
      return {
        ...profile,
        preferenceScore,
        tasteFit,
        priceBand,
        priceAppeal,
        offerFit: round(tasteFit * priceAppeal),
      };
    });
  const best = affordableProfiles.reduce((selected, candidate) => (
    !selected || candidate.offerFit > selected.offerFit ? candidate : selected
  ), null);
  const recency = recentVisitFactor(visitorHistory, worldTimeSeconds);
  const opinionFactor = clamp(Number(venueOpinionFactor), 0.25, 1.75);
  const reliabilityFactor = clamp(Number(serviceReliabilityFactor), 0.65, 1.35);
  const visitChance = round(clamp(
    foodMotive * (best?.offerFit ?? 0) * recency.recentVisitFactor * opinionFactor * reliabilityFactor,
    0,
    1,
  ));
  const base = {
    personId: person.id,
    displayName: person.displayName,
    satiety,
    foodMotive,
    spendingCapacity: person.spendingCapacity,
    wealthLevel: economyProfile.wealthLevel,
    pricePreference: economyProfile.pricePreference,
    priceSensitivity: economyProfile.priceSensitivity,
    activeMenuItemIds: [...normalizedOffer.foodItemIds],
    affordableItemIds: affordableProfiles.map(({ itemId }) => itemId),
    acceptableItemIds: affordableProfiles
      .filter(({ offerFit }) => offerFit > 0)
      .map(({ itemId }) => itemId),
    bestOfferItemId: best?.itemId ?? null,
    bestOfferFit: best?.offerFit ?? 0,
    bestOfferPriceBand: best?.priceBand ?? null,
    bestOfferPriceAppeal: best?.priceAppeal ?? 0,
    hoursSinceLastVisit: recency.hoursSinceLastVisit,
    recentVisitFactor: recency.recentVisitFactor,
    venueOpinionScore: clamp(Number(venueOpinionScore), -1, 1),
    venueOpinionFactor: opinionFactor,
    serviceReliability: clamp(Number(serviceReliability), -1, 1),
    serviceReliabilityFactor: reliabilityFactor,
    visitChance,
  };
  if (foodMotive === 0) return { ...base, roll: null, decision: "NO_VISIT", reason: "no-food-motive" };
  if (!best) return { ...base, roll: null, decision: "NO_VISIT", reason: "no-affordable-offer" };
  const roll = randomUnit(randomSource);
  return roll < visitChance
    ? { ...base, roll, decision: "VISIT", reason: "visit" }
    : { ...base, roll, decision: "NO_VISIT", reason: "roll-failed" };
}

export function selectVisitCandidate(population, activePersonIds = [], randomSource = Math.random) {
  const excluded = new Set(activePersonIds);
  const candidates = Array.isArray(population)
    ? population.filter((person) => person?.id && !excluded.has(person.id))
    : [];
  if (candidates.length === 0) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(randomUnit(randomSource) * candidates.length))];
}

function preferenceValue(value) {
  return [-1, 0, 1].includes(Number(value)) ? Number(value) : 0;
}

function randomUnit(randomSource) {
  const value = Number(randomSource?.());
  return Number.isFinite(value) ? clamp(value, 0, 0.999999999) : 0;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
