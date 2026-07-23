import { createInteractionTarget, findBestInteractionTarget } from "./interaction.js";
import {
  advanceDialogue,
  isDialogueActive as isSessionDialogueActive,
  startDialogue,
} from "./gameSessionState.js";

export function createInteractionRuntime({
  sessionState,
  characterSystem,
  interactionDefinitions,
  getStaticInteractionTargets = () => [],
  handleWorldObjectInteraction,
  getDialogueDefinition,
  resolveDialogueId,
  completeDialogue,
  onPersistentMutation,
  presenter,
}) {
  let destroyed = false;
  let currentCandidate = null;

  function update({ actions = {} } = {}) {
    if (destroyed) return;
    const interact = Boolean(actions.interact);

    if (isSessionDialogueActive(sessionState)) {
      presenter?.hidePrompt?.();
      if (interact) advanceActiveDialogue();
      else showCurrentDialogueLine();
      return;
    }

    currentCandidate = findCandidate();
    if (currentCandidate) presenter?.showPrompt?.({ promptKey: currentCandidate.prompt });
    else presenter?.hidePrompt?.();

    if (interact && currentCandidate) startCandidateInteraction(currentCandidate);
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
    for (const target of getStaticInteractionTargets()) targets.push(createInteractionTarget(target));
    return findBestInteractionTarget(player, targets);
  }

  function resolveCandidateDialogueId(candidate) {
    const fixedDialogueId = candidate.payload?.dialogueId;
    if (fixedDialogueId) return fixedDialogueId;

    const resolverId = candidate.payload?.dialogueResolverId;
    if (!resolverId || typeof resolveDialogueId !== "function") {
      throw new Error(`Interaction ${candidate.targetId} cannot resolve a dialogue ID`);
    }
    return resolveDialogueId(resolverId, sessionState, candidate.entityId);
  }

  function startCandidateInteraction(candidate) {
    if (candidate.kind === "dialogue") {
      const dialogueId = resolveCandidateDialogueId(candidate);
      const definition = getDialogueDefinition(dialogueId);
      startDialogue(sessionState, { targetId: candidate.entityId, dialogueId: definition.id });
      currentCandidate = null;
      presenter?.hidePrompt?.();
      showCurrentDialogueLine();
      return;
    }
    const result = handleWorldObjectInteraction?.(candidate);
    if (result?.mutated || result?.hidePrompt) {
      currentCandidate = null;
      presenter?.hidePrompt?.();
    }
    if (result?.messageKey) presenter?.showMessage?.({ textKey: result.messageKey });
  }

  function showCurrentDialogueLine() {
    const { dialogueId, lineIndex } = sessionState.dialogue;
    if (!dialogueId) return;
    const definition = getDialogueDefinition(dialogueId);
    presenter?.showDialogue?.({
      speakerKey: definition.speakerKey,
      line: definition.lines[lineIndex],
      continuePromptKey:
        lineIndex >= definition.lines.length - 1
          ? "hud:interaction.close"
          : "hud:interaction.next",
    });
  }

  function advanceActiveDialogue() {
    const { dialogueId } = sessionState.dialogue;
    const definition = getDialogueDefinition(dialogueId);
    const result = advanceDialogue(sessionState, definition.lines.length);
    if (result.status === "closed") {
      const completion = completeDialogue?.(sessionState, dialogueId);
      if (completion?.status === "updated") {
        onPersistentMutation?.({ dialogueId, completion });
      }
      currentCandidate = null;
      presenter?.hideDialogue?.();
      presenter?.hidePrompt?.();
      return;
    }
    showCurrentDialogueLine();
  }

  return {
    update,
    isDialogueActive() {
      return !destroyed && isSessionDialogueActive(sessionState);
    },
    isEntityInActiveDialogue(entityId) {
      return (
        !destroyed &&
        isSessionDialogueActive(sessionState) &&
        sessionState.dialogue.targetId === entityId
      );
    },
    getCurrentCandidate() {
      return currentCandidate
        ? { ...currentCandidate, payload: { ...currentCandidate.payload } }
        : null;
    },
    refresh() {
      if (destroyed) return;
      if (isSessionDialogueActive(sessionState)) showCurrentDialogueLine();
      else if (currentCandidate) presenter?.showPrompt?.({ promptKey: currentCandidate.prompt });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      currentCandidate = null;
      presenter?.hidePrompt?.();
      presenter?.hideDialogue?.();
      presenter = null;
      characterSystem = null;
      sessionState = null;
    },
  };
}
