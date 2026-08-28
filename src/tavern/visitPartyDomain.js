import {
  isLivingPopulationPerson,
  PERSON_LIFE_STAGES,
  PERSON_RELATIONSHIP_KINDS,
  visitTimeFactorForPerson,
} from "../character/populationDomain.js";
import { reputationCandidateWeight } from "./tavernFeedbackDomain.js";

export const VISIT_GROUP_MAX_SIZE = 3;
export const AGE_VISIT_LEAD_FACTORS = Object.freeze({
  [PERSON_LIFE_STAGES.newborn]: 0,
  [PERSON_LIFE_STAGES.infant]: 0,
  [PERSON_LIFE_STAGES.toddler]: 0,
  [PERSON_LIFE_STAGES.child]: 0,
  [PERSON_LIFE_STAGES.teen]: 0.2,
  [PERSON_LIFE_STAGES.youngAdult]: 1,
  [PERSON_LIFE_STAGES.adult]: 1,
  [PERSON_LIFE_STAGES.elder]: 0.8,
});
export const TINY_CHILD_PARENT_VISIT_CHANCE = 0.03;
export const CHILD_PARENT_VISIT_CHANCE = 0.3;
export const TEEN_PARENT_VISIT_CHANCE = 0.7;
export const TEEN_PEER_VISIT_CHANCE = 0.2;
export const TEEN_CHILD_PARENT_VISIT_CHANCE = 0.55;

const TINY_STAGES = new Set([
  PERSON_LIFE_STAGES.newborn,
  PERSON_LIFE_STAGES.infant,
  PERSON_LIFE_STAGES.toddler,
]);

export function visitLeadFactorForPerson(person) {
  return AGE_VISIT_LEAD_FACTORS[person?.lifeStage] ?? 1;
}

export function describeVisitCandidate(person, feedbackState, worldTimeSeconds) {
  if (!person?.id) throw new Error("Visit candidate diagnostics require a persistent person");
  const schedule = visitTimeFactorForPerson(person, worldTimeSeconds);
  const reputationFactor = reputationCandidateWeight(feedbackState, person);
  const ageFactor = visitLeadFactorForPerson(person);
  return {
    personId: person.id,
    lifeStage: person.lifeStage ?? null,
    preferredVisitPeriods: [...(person.preferredVisitPeriods ?? [])],
    period: schedule.period,
    preferredTime: schedule.preferred,
    timeFactor: schedule.timeFactor,
    reputationFactor,
    ageFactor,
    candidateWeight: round(schedule.timeFactor * reputationFactor * ageFactor),
  };
}

export function buildVisitCandidateWeights(population, feedbackState, activePersonIds = [], worldTimeSeconds = 0) {
  const excluded = new Set(activePersonIds);
  return (Array.isArray(population) ? population : [])
    .filter((person) => person?.id && isLivingPopulationPerson(person) && !excluded.has(person.id))
    .map((person) => ({ person, ...describeVisitCandidate(person, feedbackState, worldTimeSeconds) }));
}

export function selectVisitLead(population, feedbackState, activePersonIds = [], worldTimeSeconds = 0, randomSource = Math.random) {
  const weighted = buildVisitCandidateWeights(population, feedbackState, activePersonIds, worldTimeSeconds);
  const eligible = weighted.filter((candidate) => candidate.candidateWeight > 0);
  if (eligible.length === 0) return { person: null, selected: null, candidateWeights: weighted.map(candidateSnapshot) };
  const total = eligible.reduce((sum, candidate) => sum + candidate.candidateWeight, 0);
  let target = randomUnit(randomSource) * total;
  let selected = eligible.at(-1);
  for (const candidate of eligible) {
    target -= candidate.candidateWeight;
    if (target < 0) { selected = candidate; break; }
  }
  return { person: selected.person, selected: candidateSnapshot(selected), candidateWeights: weighted.map(candidateSnapshot) };
}

export function selectRelatedVisitCandidates(
  population,
  leadPerson,
  activePersonIds = [],
  worldTimeSeconds = 0,
  randomSource = () => 0.1,
) {
  if (!leadPerson?.id) return [];
  if (leadPerson.lifeStage === PERSON_LIFE_STAGES.teen) {
    return selectTeenVisitCompanions(population, leadPerson, activePersonIds, worldTimeSeconds, randomSource);
  }
  if (!Array.isArray(leadPerson.relatedPersonIds)) return [];
  const excluded = new Set([...activePersonIds, leadPerson.id]);
  const peopleById = new Map((Array.isArray(population) ? population : [])
    .filter((person) => person?.id && isLivingPopulationPerson(person))
    .map((person) => [person.id, person]));
  const related = leadPerson.relatedPersonIds
    .map((personId) => peopleById.get(personId))
    .filter((person) => person && !excluded.has(person.id))
    .filter((person) => visitTimeFactorForPerson(person, worldTimeSeconds).preferred);
  return related
    .filter((person) => companionAllowedForLead(leadPerson, person, randomSource))
    .slice(0, VISIT_GROUP_MAX_SIZE - 1);
}

function selectTeenVisitCompanions(population, leadPerson, activePersonIds, worldTimeSeconds, randomSource) {
  const excluded = new Set([...activePersonIds, leadPerson.id]);
  const people = (Array.isArray(population) ? population : [])
    .filter((person) => person?.id && isLivingPopulationPerson(person) && !excluded.has(person.id));
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const parents = parentIdsForTeen(leadPerson)
    .map((personId) => peopleById.get(personId))
    .filter(Boolean)
    .filter((person) => visitTimeFactorForPerson(person, worldTimeSeconds).preferred);
  const modeRoll = randomUnit(randomSource);
  if (modeRoll < TEEN_PARENT_VISIT_CHANCE) return parents.slice(0, VISIT_GROUP_MAX_SIZE - 1);
  if (modeRoll >= TEEN_PARENT_VISIT_CHANCE + TEEN_PEER_VISIT_CHANCE) return [];
  return people
    .filter((person) => person.lifeStage === PERSON_LIFE_STAGES.teen)
    .filter((person) => visitTimeFactorForPerson(person, worldTimeSeconds).preferred)
    .sort((first, second) => stableUnit(`teen-peer:${leadPerson.id}:${first.id}`)
      - stableUnit(`teen-peer:${leadPerson.id}:${second.id}`))
    .slice(0, VISIT_GROUP_MAX_SIZE - 1);
}

function companionAllowedForLead(leadPerson, person, randomSource) {
  const relationshipKind = relationshipKindTo(leadPerson, person.id);
  if (TINY_STAGES.has(person.lifeStage)) {
    return relationshipKind === PERSON_RELATIONSHIP_KINDS.parent
      && randomUnit(randomSource) < TINY_CHILD_PARENT_VISIT_CHANCE;
  }
  if (person.lifeStage === PERSON_LIFE_STAGES.child) {
    return relationshipKind === PERSON_RELATIONSHIP_KINDS.parent
      && randomUnit(randomSource) < CHILD_PARENT_VISIT_CHANCE;
  }
  if (person.lifeStage === PERSON_LIFE_STAGES.teen) {
    return relationshipKind === PERSON_RELATIONSHIP_KINDS.parent
      && randomUnit(randomSource) < TEEN_CHILD_PARENT_VISIT_CHANCE;
  }
  return true;
}

function relationshipKindTo(person, relatedPersonId) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .find((relationship) => relationship.personId === relatedPersonId)?.kind ?? null;
}

function parentIdsForTeen(person) {
  return (Array.isArray(person?.relationships) ? person.relationships : [])
    .filter((relationship) => relationship.kind === PERSON_RELATIONSHIP_KINDS.child)
    .map((relationship) => relationship.personId);
}

function candidateSnapshot(candidate) { const { person: _person, ...snapshot } = candidate; return snapshot; }
function randomUnit(randomSource) {
  const value = Number(randomSource?.());
  return Number.isFinite(value) ? Math.min(0.999999999, Math.max(0, value)) : 0;
}
function stableUnit(key) {
  let hash = 2166136261;
  for (const character of String(key ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}
function round(value) { return Math.round(value * 1_000_000) / 1_000_000; }
