export const WEALTH_LEVELS = Object.freeze({
  low: "low",
  middle: "middle",
  high: "high",
});

export const PRICE_BANDS = Object.freeze({
  budget: "budget",
  standard: "standard",
  premium: "premium",
});

export const PRICE_PREFERENCES = Object.freeze({
  budget: "budget",
  neutral: "neutral",
  premium: "premium",
});

export const PRICE_SENSITIVITY_VALUES = Object.freeze([0.4, 0.7, 1]);

export function wealthLevelForSpendingCapacity(spendingCapacity) {
  const value = Number(spendingCapacity);
  if (!Number.isFinite(value) || value <= 2) return WEALTH_LEVELS.low;
  if (value <= 4) return WEALTH_LEVELS.middle;
  return WEALTH_LEVELS.high;
}

export function personEconomyProfile(person) {
  const id = typeof person?.id === "string" ? person.id.trim() : "";
  if (!id) {
    return {
      wealthLevel: wealthLevelForSpendingCapacity(person?.spendingCapacity),
      pricePreference: PRICE_PREFERENCES.neutral,
      priceSensitivity: 0,
    };
  }
  const preferenceUnit = stableUnit(`${id}:price-preference`);
  const pricePreference = preferenceUnit < 0.35
    ? PRICE_PREFERENCES.budget
    : preferenceUnit < 0.65
      ? PRICE_PREFERENCES.neutral
      : PRICE_PREFERENCES.premium;
  const sensitivityIndex = Math.min(
    PRICE_SENSITIVITY_VALUES.length - 1,
    Math.floor(stableUnit(`${id}:price-sensitivity`) * PRICE_SENSITIVITY_VALUES.length),
  );
  return {
    wealthLevel: wealthLevelForSpendingCapacity(person?.spendingCapacity),
    pricePreference,
    priceSensitivity: pricePreference === PRICE_PREFERENCES.neutral
      ? 0
      : PRICE_SENSITIVITY_VALUES[sensitivityIndex],
  };
}

export function priceBandPreferenceFit(pricePreference, priceSensitivity, priceBand) {
  if (pricePreference === PRICE_PREFERENCES.neutral) return 0;
  const target = pricePreference === PRICE_PREFERENCES.budget ? -1
    : pricePreference === PRICE_PREFERENCES.premium ? 1 : 0;
  const position = priceBand === PRICE_BANDS.budget ? -1
    : priceBand === PRICE_BANDS.standard ? 0
      : priceBand === PRICE_BANDS.premium ? 1 : 0;
  const sensitivity = clamp(Number(priceSensitivity), 0, 1);
  return round((1 - Math.abs(target - position)) * sensitivity);
}

export function priceAppealForPerson(person, priceBand) {
  const profile = personEconomyProfile(person);
  if (profile.pricePreference === PRICE_PREFERENCES.neutral) return 1;
  const target = profile.pricePreference === PRICE_PREFERENCES.budget ? -1 : 1;
  const position = priceBand === PRICE_BANDS.budget ? -1
    : priceBand === PRICE_BANDS.standard ? 0
      : priceBand === PRICE_BANDS.premium ? 1 : 0;
  const rawFit = 1 - Math.abs(target - position);
  const baseAppeal = (rawFit + 1) / 2;
  return round(1 - profile.priceSensitivity * (1 - baseAppeal));
}

export function priceBandFitForPerson(person, priceBand) {
  const profile = personEconomyProfile(person);
  return priceBandPreferenceFit(profile.pricePreference, profile.priceSensitivity, priceBand);
}

function stableUnit(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
