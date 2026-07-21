import { getSessionFlag, setSessionFlag } from "./gameSessionState.js";

export const NEIGHBOR_DIALOGUE_RESOLVER_ID = "neighbor-quest";

export const NEIGHBOR_QUEST_STAGES = Object.freeze({
  notStarted: "not-started",
  talkToStreet: "talk-to-street",
  returnHome: "return-home",
  completed: "completed",
});

export const NEIGHBOR_QUEST_ENTITIES = Object.freeze({
  homeNpc: "home-npc",
  streetNpc: "street-npc",
});

export const NEIGHBOR_DIALOGUE_IDS = Object.freeze({
  homeIntro: "home-intro",
  homeReminder: "home-reminder",
  homeCompletion: "home-completion",
  homeAfter: "home-after",
  streetBefore: "street-before",
  streetResponse: "street-response",
  streetAfter: "street-after",
});

export const NEIGHBOR_QUEST_FLAGS = Object.freeze({
  started: "neighborQuest.started",
  streetAnswered: "neighborQuest.streetAnswered",
  completed: "neighborQuest.completed",
});

const REPEAT_DIALOGUE_IDS = new Set([
  NEIGHBOR_DIALOGUE_IDS.homeReminder,
  NEIGHBOR_DIALOGUE_IDS.homeAfter,
  NEIGHBOR_DIALOGUE_IDS.streetBefore,
  NEIGHBOR_DIALOGUE_IDS.streetAfter,
]);

function domainError(message, context) {
  const error = new Error(`Neighbor quest domain error: ${message}`);
  error.name = "NeighborQuestDomainError";
  error.context = context;
  return error;
}

function hasStarted(sessionState) {
  return getSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.started);
}

function hasStreetAnswered(sessionState) {
  return getSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.streetAnswered);
}

function hasCompleted(sessionState) {
  return getSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.completed);
}

export function getNeighborQuestStage(sessionState) {
  const started = hasStarted(sessionState);
  const streetAnswered = hasStreetAnswered(sessionState);
  const completed = hasCompleted(sessionState);

  if (completed && started && streetAnswered) return NEIGHBOR_QUEST_STAGES.completed;
  if (completed) return NEIGHBOR_QUEST_STAGES.returnHome;
  if (streetAnswered && started) return NEIGHBOR_QUEST_STAGES.returnHome;
  if (started) return NEIGHBOR_QUEST_STAGES.talkToStreet;
  return NEIGHBOR_QUEST_STAGES.notStarted;
}

export function resolveNeighborDialogueId(sessionState, entityId) {
  const stage = getNeighborQuestStage(sessionState);
  if (entityId === NEIGHBOR_QUEST_ENTITIES.homeNpc) {
    if (stage === NEIGHBOR_QUEST_STAGES.notStarted) return NEIGHBOR_DIALOGUE_IDS.homeIntro;
    if (stage === NEIGHBOR_QUEST_STAGES.talkToStreet) return NEIGHBOR_DIALOGUE_IDS.homeReminder;
    if (stage === NEIGHBOR_QUEST_STAGES.returnHome) return NEIGHBOR_DIALOGUE_IDS.homeCompletion;
    return NEIGHBOR_DIALOGUE_IDS.homeAfter;
  }
  if (entityId === NEIGHBOR_QUEST_ENTITIES.streetNpc) {
    if (stage === NEIGHBOR_QUEST_STAGES.notStarted) return NEIGHBOR_DIALOGUE_IDS.streetBefore;
    if (stage === NEIGHBOR_QUEST_STAGES.talkToStreet) return NEIGHBOR_DIALOGUE_IDS.streetResponse;
    return NEIGHBOR_DIALOGUE_IDS.streetAfter;
  }
  throw domainError(`unknown entity ID ${String(entityId)}`, { entityId });
}

export function completeNeighborDialogue(sessionState, dialogueId) {
  if (dialogueId === NEIGHBOR_DIALOGUE_IDS.homeIntro) {
    setSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.started, true);
    return { status: "updated", stage: getNeighborQuestStage(sessionState) };
  }
  if (dialogueId === NEIGHBOR_DIALOGUE_IDS.streetResponse) {
    if (!hasStarted(sessionState)) return { status: "ignored", stage: getNeighborQuestStage(sessionState) };
    setSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.streetAnswered, true);
    return { status: "updated", stage: getNeighborQuestStage(sessionState) };
  }
  if (dialogueId === NEIGHBOR_DIALOGUE_IDS.homeCompletion) {
    if (!hasStarted(sessionState) || !hasStreetAnswered(sessionState)) return { status: "ignored", stage: getNeighborQuestStage(sessionState) };
    setSessionFlag(sessionState, NEIGHBOR_QUEST_FLAGS.completed, true);
    return { status: "updated", stage: getNeighborQuestStage(sessionState) };
  }
  if (REPEAT_DIALOGUE_IDS.has(dialogueId)) {
    return { status: "unchanged", stage: getNeighborQuestStage(sessionState) };
  }
  throw domainError(`unknown dialogue ID ${String(dialogueId)}`, { dialogueId });
}
