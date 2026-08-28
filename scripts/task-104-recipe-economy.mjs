import { SPENDING_CAPACITY_WEIGHTS } from "../src/character/populationDomain.js";

export const RECIPE_BALANCE_PRICES = Object.freeze([10, 30, 80, 200, 500]);
export const RECIPE_TOTAL_WORK = Object.freeze([1, 3, 8, 20, 50]);
export const RECIPE_SKILLED_WORK = Object.freeze([1, 2, 4, 7, 10]);
export const RECIPE_ROUTINE_WORK = Object.freeze(RECIPE_TOTAL_WORK.map(
  (value, index) => value - RECIPE_SKILLED_WORK[index],
));
export const RECIPE_WEALTH_DISTANCE_DECAY = 0.7;
export const RECIPE_TARGET_VALUE_PER_OPPORTUNITY = 10;

// Simulation placeholders, not final minion stats.
export const GENERAL_HELPER_AUTOMATION = Object.freeze({
  routineCoverage: 0.9,
  skilledCoverage: Object.freeze([0.95, 0.85, 0.65, 0.4, 0.2]),
  autonomousFinishRate: Object.freeze([1, 0.9, 0.65, 0.4, 0.2]),
});

export const SPECIALIZED_HELPER_AUTOMATION = Object.freeze({
  routineCoverage: 0.98,
  skilledCoverage: Object.freeze([1, 0.95, 0.8, 0.6, 0.35]),
  autonomousFinishRate: Object.freeze([1, 1, 0.9, 0.7, 0.45]),
});

export const MASTER_AUTOMATION = Object.freeze({
  routineCoverage: 1,
  skilledCoverage: Object.freeze([1, 1, 1, 0.95, 0.85]),
  autonomousFinishRate: Object.freeze([1, 1, 1, 0.95, 0.85]),
});

export function normalizedAudienceDistribution(distribution = SPENDING_CAPACITY_WEIGHTS) {
  if (!Array.isArray(distribution) || distribution.length !== 5) {
    throw new Error("Audience distribution must contain five wealth tiers");
  }
  const values = distribution.map((value) => Math.max(0, Number(value) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Audience distribution must have positive weight");
  return values.map((value) => value / total);
}

export function recipeLifestyleFit(wealthIndex, recipeIndex) {
  const safeWealth = normalizeIndex(wealthIndex);
  const safeRecipe = normalizeIndex(recipeIndex);
  return Math.exp(-RECIPE_WEALTH_DISTANCE_DECAY * Math.max(0, safeRecipe - safeWealth));
}

export function recipeAudienceFit(recipeIndex, distribution = SPENDING_CAPACITY_WEIGHTS) {
  const weights = normalizedAudienceDistribution(distribution);
  return weights.reduce((sum, weight, wealthIndex) => (
    sum + weight * recipeLifestyleFit(wealthIndex, recipeIndex)
  ), 0);
}

export function calibratedOccasionRate(recipeIndex) {
  const index = normalizeIndex(recipeIndex);
  const fit = recipeAudienceFit(index, SPENDING_CAPACITY_WEIGHTS);
  return Math.min(1, RECIPE_TARGET_VALUE_PER_OPPORTUNITY / (RECIPE_BALANCE_PRICES[index] * fit));
}

export function expectedOrderChance(recipeIndex, distribution = SPENDING_CAPACITY_WEIGHTS) {
  return recipeAudienceFit(recipeIndex, distribution) * calibratedOccasionRate(recipeIndex);
}

export function expectedRevenuePerDay(recipeIndex, opportunitiesPerDay, distribution = SPENDING_CAPACITY_WEIGHTS) {
  const index = normalizeIndex(recipeIndex);
  return expectedOrderChance(index, distribution)
    * Math.max(0, Number(opportunitiesPerDay) || 0)
    * RECIPE_BALANCE_PRICES[index];
}

export function automationResidualWork(recipeIndex, profile = GENERAL_HELPER_AUTOMATION) {
  const index = normalizeIndex(recipeIndex);
  const routineCoverage = clamp01(profile?.routineCoverage);
  const skilledCoverage = clamp01(profile?.skilledCoverage?.[index]);
  return RECIPE_ROUTINE_WORK[index] * (1 - routineCoverage)
    + RECIPE_SKILLED_WORK[index] * (1 - skilledCoverage);
}

export function automationAttemptMultiplier(recipeIndex, profile = GENERAL_HELPER_AUTOMATION) {
  const index = normalizeIndex(recipeIndex);
  const finishRate = clamp01(profile?.autonomousFinishRate?.[index]);
  return finishRate > 0 ? 1 / finishRate : Number.POSITIVE_INFINITY;
}

export const RECIPE_BALANCE_PLACEHOLDERS = Object.freeze(RECIPE_BALANCE_PRICES.map((price, index) => Object.freeze({
  id: `placeholder-recipe-${index + 1}`,
  tier: index + 1,
  price,
  totalWork: RECIPE_TOTAL_WORK[index],
  skilledWork: RECIPE_SKILLED_WORK[index],
  routineWork: RECIPE_ROUTINE_WORK[index],
  occasionRate: calibratedOccasionRate(index),
})));

function normalizeIndex(value) {
  return Math.max(0, Math.min(4, Math.floor(Number(value) || 0)));
}

function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}
