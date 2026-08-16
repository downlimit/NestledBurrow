import { getSaleProfile, getSaleProfiles, getSaleProfileTags } from "./saleProfileDomain.js";

export const VISIT_OPPORTUNITY_INTERVAL_MIN_MS = 3_000;
export const VISIT_OPPORTUNITY_INTERVAL_MAX_MS = 8_000;
export const DEFAULT_TAVERN_FLOW_PRESSURE = 0.5;

export const TAVERN_FEEDBACK_BALANCE = Object.freeze({
  opinionDecayPerWorldDay: 0.08,
  opinionBySatisfactionTier: Object.freeze({ 1: -0.55, 2: -0.25, 3: 0, 4: 0.3, 5: 0.5 }),
  openUnservedOpinionDelta: -0.25,
  acceptedFailureOpinionDelta: -0.6,
  reputationEvidenceRate: 0.12,
  completedReliabilityDelta: 0.02,
  openUnservedReliabilityDelta: -0.08,
  acceptedFailureReliabilityDelta: -0.2,
  completedFlowDelta: 0.006,
  openUnservedFlowDelta: -0.025,
  acceptedFailureFlowDelta: -0.06,
  closureGraceWorldSeconds: 6 * 60 * 60,
  closureFlowLossPerWorldDay: 0.01,
  minimumDiscoveryWeight: 0.2,
  minimumFlowIntervalScale: 0.5,
  maximumFlowIntervalScale: 1.5,
});

const WORLD_DAY_SECONDS = 24 * 60 * 60;
const CANONICAL_REPUTATION_TAGS = Object.freeze([...new Set(
  getSaleProfiles().flatMap((profile) => getSaleProfileTags(profile)),
)]);

export function createNeutralTavernFeedbackState(population = [], worldTimeSeconds = 0) {
  return normalizeTavernFeedbackState({}, { population, worldTimeSeconds });
}

export function normalizeTavernFeedbackState(value = {}, { population = [], worldTimeSeconds = 0 } = {}) {
  const source = plainRecord(value);
  const evaluationTime = nonNegativeNumber(worldTimeSeconds, 0);
  const lastEvaluatedWorldTimeSeconds = nonNegativeNumber(
    source.lastEvaluatedWorldTimeSeconds,
    evaluationTime,
  );
  const rawOpinions = plainRecord(source.venueOpinionsByPersonId);
  const venueOpinionsByPersonId = Object.fromEntries((Array.isArray(population) ? population : [])
    .filter((person) => safePersonId(person?.id))
    .map((person) => [person.id, normalizeOpinionEntry(
      rawOpinions[person.id],
      lastEvaluatedWorldTimeSeconds,
    )]));
  const rawReputation = plainRecord(source.reputationProfile);
  const rawTagWeights = plainRecord(rawReputation.foodTagWeights);
  const foodTagWeights = Object.fromEntries(CANONICAL_REPUTATION_TAGS.map((tag) => [
    tag,
    clamp(Number(rawTagWeights[tag]), 0, 1, 0),
  ]));
  const rawCounts = plainRecord(source.outcomeCounts);
  return {
    flowPressure: clamp(Number(source.flowPressure), 0, 1, DEFAULT_TAVERN_FLOW_PRESSURE),
    lastEvaluatedWorldTimeSeconds,
    closureElapsedWorldSeconds: nonNegativeNumber(source.closureElapsedWorldSeconds, 0),
    venueOpinionsByPersonId,
    reputationProfile: {
      foodTagWeights,
      serviceReliability: clamp(Number(rawReputation.serviceReliability), -1, 1, 0),
    },
    outcomeCounts: {
      completedVisits: nonNegativeInteger(rawCounts.completedVisits, 0),
      openUnserved: nonNegativeInteger(rawCounts.openUnserved, 0),
      acceptedOrderFailures: nonNegativeInteger(rawCounts.acceptedOrderFailures, 0),
    },
  };
}

export function evaluateVenueOpinion(feedbackState, personId, worldTimeSeconds) {
  const entry = requireOpinion(feedbackState, personId, worldTimeSeconds);
  const now = nonNegativeNumber(worldTimeSeconds, entry.lastEvaluatedWorldTimeSeconds);
  const elapsedDays = Math.max(0, now - entry.lastEvaluatedWorldTimeSeconds) / WORLD_DAY_SECONDS;
  const decay = TAVERN_FEEDBACK_BALANCE.opinionDecayPerWorldDay * elapsedDays;
  entry.score = round(moveToward(entry.score, 0, decay));
  entry.lastEvaluatedWorldTimeSeconds = now;
  return { score: entry.score, lastEvaluatedWorldTimeSeconds: entry.lastEvaluatedWorldTimeSeconds };
}

export function visitFeedbackFactors(feedbackState, personId, worldTimeSeconds) {
  const opinion = evaluateVenueOpinion(feedbackState, personId, worldTimeSeconds);
  const reliability = clamp(Number(feedbackState?.reputationProfile?.serviceReliability), -1, 1, 0);
  return {
    venueOpinionScore: opinion.score,
    venueOpinionFactor: round(clamp(1 + opinion.score * 0.75, 0.25, 1.75, 1)),
    serviceReliability: reliability,
    serviceReliabilityFactor: round(clamp(1 + reliability * 0.35, 0.65, 1.35, 1)),
  };
}

export function recordCompletedVisitFeedback(feedbackState, {
  personId,
  satisfactionTier,
  itemId,
  worldTimeSeconds,
} = {}) {
  const opinion = requireOpinion(feedbackState, personId, worldTimeSeconds);
  evaluateVenueOpinion(feedbackState, personId, worldTimeSeconds);
  const tier = Math.max(1, Math.min(5, Math.round(Number(satisfactionTier) || 3)));
  opinion.score = round(clamp(
    opinion.score + TAVERN_FEEDBACK_BALANCE.opinionBySatisfactionTier[tier],
    -1,
    1,
    0,
  ));
  opinion.completedVisitCount += 1;
  applySaleEvidence(feedbackState, itemId);
  applyReliabilityDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.completedReliabilityDelta);
  applyFlowDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.completedFlowDelta);
  feedbackState.outcomeCounts.completedVisits += 1;
  return feedbackSnapshot(feedbackState, personId, "completed-visit");
}

export function recordOpenUnservedFeedback(feedbackState, { personId, worldTimeSeconds } = {}) {
  const opinion = requireOpinion(feedbackState, personId, worldTimeSeconds);
  evaluateVenueOpinion(feedbackState, personId, worldTimeSeconds);
  opinion.score = round(clamp(
    opinion.score + TAVERN_FEEDBACK_BALANCE.openUnservedOpinionDelta,
    -1,
    1,
    0,
  ));
  opinion.openUnservedCount += 1;
  applyReliabilityDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.openUnservedReliabilityDelta);
  applyFlowDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.openUnservedFlowDelta);
  feedbackState.outcomeCounts.openUnserved += 1;
  return feedbackSnapshot(feedbackState, personId, "open-unserved");
}

export function recordAcceptedOrderFailureFeedback(feedbackState, { personId, worldTimeSeconds } = {}) {
  const opinion = requireOpinion(feedbackState, personId, worldTimeSeconds);
  evaluateVenueOpinion(feedbackState, personId, worldTimeSeconds);
  opinion.score = round(clamp(
    opinion.score + TAVERN_FEEDBACK_BALANCE.acceptedFailureOpinionDelta,
    -1,
    1,
    0,
  ));
  opinion.acceptedOrderFailureCount += 1;
  applyReliabilityDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.acceptedFailureReliabilityDelta);
  applyFlowDelta(feedbackState, TAVERN_FEEDBACK_BALANCE.acceptedFailureFlowDelta);
  feedbackState.outcomeCounts.acceptedOrderFailures += 1;
  return feedbackSnapshot(feedbackState, personId, "accepted-order-failure");
}

export function advanceTavernFeedbackTime(feedbackState, { worldTimeSeconds, tavernOpen } = {}) {
  const previousTime = nonNegativeNumber(feedbackState.lastEvaluatedWorldTimeSeconds, 0);
  const now = Math.max(previousTime, nonNegativeNumber(worldTimeSeconds, previousTime));
  const elapsed = now - previousTime;
  feedbackState.lastEvaluatedWorldTimeSeconds = now;
  if (tavernOpen) {
    const reset = feedbackState.closureElapsedWorldSeconds > 0;
    feedbackState.closureElapsedWorldSeconds = 0;
    return { mutated: elapsed > 0 || reset, flowDelta: 0, closureElapsedWorldSeconds: 0 };
  }
  const before = nonNegativeNumber(feedbackState.closureElapsedWorldSeconds, 0);
  const after = before + elapsed;
  feedbackState.closureElapsedWorldSeconds = after;
  const grace = TAVERN_FEEDBACK_BALANCE.closureGraceWorldSeconds;
  const penalizedSeconds = Math.max(0, after - grace) - Math.max(0, before - grace);
  const flowDelta = -TAVERN_FEEDBACK_BALANCE.closureFlowLossPerWorldDay
    * penalizedSeconds / WORLD_DAY_SECONDS;
  if (flowDelta !== 0) applyFlowDelta(feedbackState, flowDelta);
  return {
    mutated: elapsed > 0,
    flowDelta: round(flowDelta),
    closureElapsedWorldSeconds: after,
  };
}

export function setTavernFlowPressure(feedbackState, value) {
  const previous = feedbackState.flowPressure;
  feedbackState.flowPressure = round(clamp(Number(value), 0, 1, DEFAULT_TAVERN_FLOW_PRESSURE));
  return { mutated: feedbackState.flowPressure !== previous, flowPressure: feedbackState.flowPressure };
}

export function boostTavernFlowPressure(feedbackState, amount) {
  return setTavernFlowPressure(feedbackState, feedbackState.flowPressure + (Number(amount) || 0));
}

export function sampleVisitOpportunityDelay(randomSource = Math.random, flowPressure = DEFAULT_TAVERN_FLOW_PRESSURE) {
  const unit = randomUnit(randomSource);
  const pressure = clamp(Number(flowPressure), 0, 1, DEFAULT_TAVERN_FLOW_PRESSURE);
  const interval = VISIT_OPPORTUNITY_INTERVAL_MIN_MS
    + unit * (VISIT_OPPORTUNITY_INTERVAL_MAX_MS - VISIT_OPPORTUNITY_INTERVAL_MIN_MS);
  const scale = TAVERN_FEEDBACK_BALANCE.maximumFlowIntervalScale
    - pressure * (TAVERN_FEEDBACK_BALANCE.maximumFlowIntervalScale - TAVERN_FEEDBACK_BALANCE.minimumFlowIntervalScale);
  return round(interval * scale);
}

export function reputationFitForPerson(feedbackState, person) {
  const tagWeights = feedbackState?.reputationProfile?.foodTagWeights ?? {};
  let totalWeight = 0;
  let weightedFit = 0;
  for (const [tag, rawWeight] of Object.entries(tagWeights)) {
    const weight = clamp(Number(rawWeight), 0, 1, 0);
    if (weight <= 0) continue;
    totalWeight += weight;
    weightedFit += weight * preferenceForTag(person?.foodPreferences, tag);
  }
  return totalWeight > 0 ? round(weightedFit / totalWeight) : 0;
}

export function reputationCandidateWeight(feedbackState, person) {
  const fit = reputationFitForPerson(feedbackState, person);
  const discovery = TAVERN_FEEDBACK_BALANCE.minimumDiscoveryWeight;
  return round(discovery + (1 - discovery) * ((fit + 1) / 2));
}

export function selectReputationBiasedCandidate(
  population,
  feedbackState,
  activePersonIds = [],
  randomSource = Math.random,
) {
  const excluded = new Set(activePersonIds);
  const candidates = Array.isArray(population)
    ? population.filter((person) => person?.id && !excluded.has(person.id))
    : [];
  if (candidates.length === 0) return null;
  const weighted = candidates.map((person) => ({
    person,
    weight: reputationCandidateWeight(feedbackState, person),
  }));
  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  let target = randomUnit(randomSource) * total;
  for (const candidate of weighted) {
    target -= candidate.weight;
    if (target < 0) return candidate.person;
  }
  return weighted.at(-1).person;
}

export function cloneTavernFeedbackState(feedbackState) {
  return JSON.parse(JSON.stringify(feedbackState));
}

function applySaleEvidence(feedbackState, itemId) {
  const profile = getSaleProfile(itemId);
  if (!profile) return;
  const matching = new Set(getSaleProfileTags(profile));
  const rate = TAVERN_FEEDBACK_BALANCE.reputationEvidenceRate;
  for (const tag of CANONICAL_REPUTATION_TAGS) {
    const current = feedbackState.reputationProfile.foodTagWeights[tag] ?? 0;
    const target = matching.has(tag) ? 1 : 0;
    feedbackState.reputationProfile.foodTagWeights[tag] = round(current + (target - current) * rate);
  }
}

function applyReliabilityDelta(feedbackState, delta) {
  feedbackState.reputationProfile.serviceReliability = round(clamp(
    feedbackState.reputationProfile.serviceReliability + delta,
    -1,
    1,
    0,
  ));
}

function applyFlowDelta(feedbackState, delta) {
  feedbackState.flowPressure = clamp(
    feedbackState.flowPressure + delta,
    0,
    1,
    DEFAULT_TAVERN_FLOW_PRESSURE,
  );
}

function requireOpinion(feedbackState, personId, worldTimeSeconds) {
  if (!safePersonId(personId)) throw new Error("Tavern feedback requires a persistent person ID");
  feedbackState.venueOpinionsByPersonId ??= {};
  feedbackState.venueOpinionsByPersonId[personId] ??= normalizeOpinionEntry({}, worldTimeSeconds);
  return feedbackState.venueOpinionsByPersonId[personId];
}

function normalizeOpinionEntry(value, fallbackTime) {
  const source = plainRecord(value);
  return {
    score: clamp(Number(source.score), -1, 1, 0),
    lastEvaluatedWorldTimeSeconds: nonNegativeNumber(source.lastEvaluatedWorldTimeSeconds, fallbackTime),
    completedVisitCount: nonNegativeInteger(source.completedVisitCount, 0),
    openUnservedCount: nonNegativeInteger(source.openUnservedCount, 0),
    acceptedOrderFailureCount: nonNegativeInteger(source.acceptedOrderFailureCount, 0),
  };
}

function feedbackSnapshot(feedbackState, personId, outcome) {
  return {
    outcome,
    personId,
    venueOpinion: { ...feedbackState.venueOpinionsByPersonId[personId] },
    reputationProfile: {
      foodTagWeights: { ...feedbackState.reputationProfile.foodTagWeights },
      serviceReliability: feedbackState.reputationProfile.serviceReliability,
    },
    flowPressure: feedbackState.flowPressure,
    outcomeCounts: { ...feedbackState.outcomeCounts },
  };
}

function preferenceForTag(foodPreferences, tag) {
  const separator = tag.indexOf(":");
  if (separator < 0) return 0;
  const group = tag.slice(0, separator);
  const value = tag.slice(separator + 1);
  const preference = Number(foodPreferences?.[group]?.[value]);
  return [-1, 0, 1].includes(preference) ? preference : 0;
}

function moveToward(value, target, maximumDelta) {
  if (value < target) return Math.min(target, value + maximumDelta);
  if (value > target) return Math.max(target, value - maximumDelta);
  return target;
}

function safePersonId(value) {
  return typeof value === "string" && /^person-[a-z0-9-]+$/i.test(value)
    && !["__proto__", "constructor", "prototype"].includes(value);
}

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function nonNegativeNumber(value, fallback) {
  return Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : Math.max(0, Number(fallback) || 0);
}

function nonNegativeInteger(value, fallback) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function randomUnit(randomSource) {
  const value = Number(randomSource?.());
  return Number.isFinite(value) ? clamp(value, 0, 0.999999999, 0) : 0;
}

function clamp(value, minimum, maximum, fallback) {
  const normalized = Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, normalized));
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
