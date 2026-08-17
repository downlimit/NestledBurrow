import { visitTimeFactorForPerson } from "../character/populationDomain.js";
import { reputationCandidateWeight } from "./tavernFeedbackDomain.js";

export const VISIT_GROUP_MAX_SIZE = 3;

export function describeVisitCandidate(person, feedbackState, worldTimeSeconds) {
  if (!person?.id) throw new Error("Visit candidate diagnostics require a persistent person");
  const schedule = visitTimeFactorForPerson(person, worldTimeSeconds);
  const reputationFactor = reputationCandidateWeight(feedbackState, person);
  return {
    personId: person.id,
    preferredVisitPeriods: [...(person.preferredVisitPeriods ?? [])],
    period: schedule.period,
    preferredTime: schedule.preferred,
    timeFactor: schedule.timeFactor,
    reputationFactor,
    candidateWeight: round(schedule.timeFactor * reputationFactor),
  };
}

export function buildVisitCandidateWeights(
  population,
  feedbackState,
  activePersonIds = [],
  worldTimeSeconds = 0,
) {
  const excluded = new Set(activePersonIds);
  return (Array.isArray(population) ? population : [])
    .filter((person) => person?.id && !excluded.has(person.id))
    .map((person) => ({ person, ...describeVisitCandidate(person, feedbackState, worldTimeSeconds) }));
}

export function selectVisitLead(
  population,
  feedbackState,
  activePersonIds = [],
  worldTimeSeconds = 0,
  randomSource = Math.random,
) {
  const weighted = buildVisitCandidateWeights(population, feedbackState, activePersonIds, worldTimeSeconds);
  if (weighted.length === 0) return { person: null, selected: null, candidateWeights: [] };
  const total = weighted.reduce((sum, candidate) => sum + candidate.candidateWeight, 0);
  let target = randomUnit(randomSource) * total;
  let selected = weighted.at(-1);
  for (const candidate of weighted) {
    target -= candidate.candidateWeight;
    if (target < 0) {
      selected = candidate;
      break;
    }
  }
  return {
    person: selected.person,
    selected: candidateSnapshot(selected),
    candidateWeights: weighted.map(candidateSnapshot),
  };
}

export function selectRelatedVisitCandidates(
  population,
  leadPerson,
  activePersonIds = [],
  worldTimeSeconds = 0,
) {
  if (!leadPerson?.id || !Array.isArray(leadPerson.relatedPersonIds)) return [];
  const excluded = new Set([...activePersonIds, leadPerson.id]);
  const peopleById = new Map((Array.isArray(population) ? population : [])
    .filter((person) => person?.id)
    .map((person) => [person.id, person]));
  return leadPerson.relatedPersonIds
    .map((personId) => peopleById.get(personId))
    .filter((person) => person && !excluded.has(person.id))
    .filter((person) => visitTimeFactorForPerson(person, worldTimeSeconds).preferred)
    .slice(0, VISIT_GROUP_MAX_SIZE - 1);
}

function candidateSnapshot(candidate) {
  const { person: _person, ...snapshot } = candidate;
  return snapshot;
}

function randomUnit(randomSource) {
  const value = Number(randomSource?.());
  return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
