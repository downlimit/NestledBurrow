import { createInteractionTarget, findBestInteractionTarget } from "./interaction.js";
import {
  advanceDialogue,
  isDialogueActive as isSessionDialogueActive,
  setEntityFlag,
  startDialogue,
} from "./gameSessionState.js";

export function createInteractionRuntime({
  sessionState,
  characterSystem,
  interactionDefinitions,
  getDialogueDefinition,
  presenter,
}) {
  let destroyed = false;
  let currentCandidate = null;
  let activeEntityId = null;

  function update({ actions = {} } = {}) {
    if (destroyed) return;
    const interact = Boolean(actions.interact);

    if (isSessionDialogueActive(sessionState)) {
      presenter?.hidePrompt?.();
      if (interact) advanceActiveDialogue();
      else showCurrentDialogueLine();
      return;
    }

    activeEntityId = null;
    currentCandidate = findCandidate();
    if (currentCandidate) presenter?.showPrompt?.({ prompt: currentCandidate.prompt });
    else presenter?.hidePrompt?.();

    if (interact && currentCandidate) startCandidateDialogue(currentCandidate);
  }

  function findCandidate() {
    const player = characterSystem.getSnapshot(sessionState.playerId);
    const targets = [];
    for (const definition of interactionDefinitions) {
      const snapshot = characterSystem.getSnapshot(definition.entityId);
      targets.push(createInteractionTarget({
        ...definition,
        position: snapshot.position,
      }));
    }
    return findBestInteractionTarget(player, targets);
  }

  function startCandidateDialogue(candidate) {
    if (candidate.kind !== "dialogue") return;
    const dialogueId = candidate.payload?.dialogueId;
    const definition = getDialogueDefinition(dialogueId);
    startDialogue(sessionState, { targetId: candidate.entityId, dialogueId: definition.id });
    activeEntityId = candidate.entityId;
    currentCandidate = null;
    presenter?.hidePrompt?.();
    showCurrentDialogueLine();
  }

  function showCurrentDialogueLine() {
    const { dialogueId, lineIndex } = sessionState.dialogue;
    if (!dialogueId) return;
    const definition = getDialogueDefinition(dialogueId);
    presenter?.showDialogue?.({
      speaker: definition.speaker,
      text: definition.lines[lineIndex],
      continuePrompt: lineIndex >= definition.lines.length - 1 ? "CLOSE" : "NEXT",
    });
  }

  function advanceActiveDialogue() {
    const { targetId, dialogueId } = sessionState.dialogue;
    const definition = getDialogueDefinition(dialogueId);
    const result = advanceDialogue(sessionState, definition.lines.length);
    if (result.status === "closed") {
      if (dialogueId === "home-npc-greeting") {
        setEntityFlag(sessionState, targetId, "greeted", true);
      }
      activeEntityId = null;
      currentCandidate = null;
      presenter?.hideDialogue?.();
      presenter?.hidePrompt?.();
      return;
    }
    showCurrentDialogueLine();
  }

  return {
    update,
    isDialogueActive() { return !destroyed && isSessionDialogueActive(sessionState); },
    isEntityInActiveDialogue(entityId) {
      return !destroyed && isSessionDialogueActive(sessionState) && sessionState.dialogue.targetId === entityId;
    },
    getCurrentCandidate() { return currentCandidate ? { ...currentCandidate, payload: { ...currentCandidate.payload } } : null; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      currentCandidate = null;
      activeEntityId = null;
      presenter?.hidePrompt?.();
      presenter?.hideDialogue?.();
      presenter = null;
      characterSystem = null;
      sessionState = null;
    },
  };
}
