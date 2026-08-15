import { NEED_IDS, normalizeNeedValue } from "../needs/needsDomain.js";

export const GUEST_INTENTS = Object.freeze({
  food: "food",
  toilet: "toilet",
  wash: "wash",
  rest: "rest",
  wander: "wander",
  social: "social",
  waiting: "waiting",
  leave: "leave",
  none: "none",
});

export const GUEST_INTENT_NEED = Object.freeze({
  [GUEST_INTENTS.food]: "satiety",
  [GUEST_INTENTS.toilet]: "toilet",
  [GUEST_INTENTS.wash]: "lustre",
  [GUEST_INTENTS.rest]: "energy",
  [GUEST_INTENTS.wander]: "novelty",
  [GUEST_INTENTS.social]: "dialogue",
});

export const GUEST_NEED_THRESHOLDS = Object.freeze({
  critical: 15,
  seek: 35,
  resolved: 68,
  hysteresisMargin: 0.12,
});

export const LIVE_GUEST_NEED_RATES_PER_GAME_HOUR = Object.freeze({
  novelty: -1,
  energy: -5,
  satiety: -7,
  toilet: -6,
  lustre: -1,
  dialogue: -2,
});

const RECOVERY_PER_REAL_SECOND = Object.freeze({
  [GUEST_INTENTS.toilet]: 36,
  [GUEST_INTENTS.wash]: 18,
  [GUEST_INTENTS.rest]: 8,
  [GUEST_INTENTS.wander]: 12,
  [GUEST_INTENTS.social]: 25,
});

const INTENT_PRIORITY = Object.freeze([
  GUEST_INTENTS.toilet,
  GUEST_INTENTS.food,
  GUEST_INTENTS.wash,
  GUEST_INTENTS.rest,
  GUEST_INTENTS.social,
  GUEST_INTENTS.wander,
]);

export function advanceLiveGuestNeeds(person, deltaMs, {
  moving = false,
  resolvingIntent = GUEST_INTENTS.none,
  worldTimeSeconds = null,
} = {}) {
  if (!person?.needs) return { mutated: false, needs: null };
  const seconds = Math.max(0, Number(deltaMs) || 0) / 1000;
  const gameHours = seconds / 60;
  let mutated = false;
  for (const needId of NEED_IDS) {
    const baseRate = LIVE_GUEST_NEED_RATES_PER_GAME_HOUR[needId] ?? 0;
    const movementRate = moving && needId === "energy" ? -0.5 : moving && needId === "lustre" ? -0.3 : 0;
    const recovery = GUEST_INTENT_NEED[resolvingIntent] === needId
      ? (RECOVERY_PER_REAL_SECOND[resolvingIntent] ?? 0) * seconds
      : 0;
    const previous = normalizeNeedValue(person.needs[needId]);
    const next = roundNeed(previous + (baseRate + movementRate) * gameHours + recovery);
    if (next !== previous) {
      person.needs[needId] = next;
      mutated = true;
    }
  }
  if (Number.isFinite(Number(worldTimeSeconds)) && Number(worldTimeSeconds) >= 0) {
    const nextTime = Number(worldTimeSeconds);
    if (person.lastEvaluatedWorldTimeSeconds !== nextTime) mutated = true;
    person.lastEvaluatedWorldTimeSeconds = nextTime;
  }
  return { mutated, needs: person.needs };
}

export function applyGuestNeedResolution(person, intent, amount = null) {
  const needId = GUEST_INTENT_NEED[intent];
  if (!needId || !person?.needs) return { mutated: false, needId: null, value: null };
  const defaultAmount = intent === GUEST_INTENTS.food ? 65 : intent === GUEST_INTENTS.social ? 30 : 0;
  const previous = normalizeNeedValue(person.needs[needId]);
  const next = roundNeed(previous + Math.max(0, Number(amount ?? defaultAmount) || 0));
  person.needs[needId] = next;
  return { mutated: next !== previous, needId, value: next };
}

export function rankGuestIntents(person) {
  const needs = person?.needs ?? {};
  return INTENT_PRIORITY.map((intent, priority) => {
    const needId = GUEST_INTENT_NEED[intent];
    const value = normalizeNeedValue(needs[needId]);
    const pressure = (100 - value) / 100;
    const critical = value <= GUEST_NEED_THRESHOLDS.critical;
    const active = value <= GUEST_NEED_THRESHOLDS.seek;
    return { intent, needId, value, pressure, critical, active, priority };
  }).sort((a, b) => Number(b.critical) - Number(a.critical)
    || b.pressure - a.pressure
    || a.priority - b.priority);
}

export function arbitrateGuestIntent(person, currentIntent = GUEST_INTENTS.none, {
  orderStatus = null,
} = {}) {
  const ranked = rankGuestIntents(person);
  const challenger = ranked.find(({ active }) => active) ?? null;
  const current = ranked.find(({ intent }) => intent === currentIntent) ?? null;
  if (current && current.value < GUEST_NEED_THRESHOLDS.resolved) {
    const challengerWins = challenger
      && challenger.intent !== current.intent
      && (challenger.critical && !current.critical
        || challenger.pressure > current.pressure + GUEST_NEED_THRESHOLDS.hysteresisMargin);
    if (!challengerWins) return intentResult(current, orderStatus);
  }
  if (challenger) return intentResult(challenger, orderStatus);
  if (["accepted", "reserved"].includes(orderStatus)) {
    return { intent: GUEST_INTENTS.waiting, needId: null, value: null, pressure: 0, critical: false };
  }
  return { intent: GUEST_INTENTS.none, needId: null, value: null, pressure: 0, critical: false };
}

export function isIntentResolved(person, intent) {
  const needId = GUEST_INTENT_NEED[intent];
  return !needId || normalizeNeedValue(person?.needs?.[needId]) >= GUEST_NEED_THRESHOLDS.resolved;
}

export function shouldInterruptOrder(intentResult, orderStatus) {
  return Boolean(intentResult?.critical)
    && ["accepted", "reserved"].includes(orderStatus)
    && ![GUEST_INTENTS.food, GUEST_INTENTS.waiting].includes(intentResult.intent);
}

export function shouldDrinkTakeout(person) {
  return !rankGuestIntents(person).some(({ intent, active }) => active && intent !== GUEST_INTENTS.food);
}

export function menuReadingDurationMs(offerFit) {
  const fit = clamp(Number(offerFit), 0, 1);
  return Math.round(6_000 - 3_500 * fit);
}

export function computeVisitSatisfactionTier({
  fulfillmentElapsedMs = 0,
  resolvedInterrupts = 0,
  unresolvedCritical = false,
  failed = false,
} = {}) {
  if (failed || unresolvedCritical) return 1;
  let score = 3;
  if (Number(fulfillmentElapsedMs) <= 30_000) score += 1;
  if (Number(fulfillmentElapsedMs) > 90_000) score -= 1;
  if (Number(resolvedInterrupts) > 0) score += 1;
  return Math.max(1, Math.min(5, score));
}

export function stableIntentDurationMs(personId, intent, minimumMs = 1_200, maximumMs = 2_600) {
  const minimum = Math.max(0, Number(minimumMs) || 0);
  const maximum = Math.max(minimum, Number(maximumMs) || minimum);
  return Math.round(minimum + stableUnit(`${personId}:${intent}`) * (maximum - minimum));
}

function intentResult(candidate, orderStatus) {
  if (candidate.intent === GUEST_INTENTS.food && ["accepted", "reserved"].includes(orderStatus)) {
    return { intent: GUEST_INTENTS.waiting, needId: candidate.needId, value: candidate.value, pressure: candidate.pressure, critical: candidate.critical };
  }
  return { ...candidate };
}

function stableUnit(key) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}

function roundNeed(value) {
  return Math.round(clamp(value, 0, 100) * 1_000_000) / 1_000_000;
}

function clamp(value, minimum, maximum) {
  const number = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, number));
}
