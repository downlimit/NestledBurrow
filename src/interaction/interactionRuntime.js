import { createInteractionTarget, findBestInteractionTarget } from "./interaction.js";
import {
  advanceDialogue,
  isDialogueActive as isSessionDialogueActive,
  startDialogue,
} from "../session/gameSessionState.js";

export function createInteractionRuntime({
  sessionState,
  characterSystem,
  interactionDefinitions = [],
  getInteractionDefinitions = () => interactionDefinitions,
  getDialogueDefinition,
  resolveDialogueId,
  completeDialogue,
  onPersistentMutation,
  worldInteractionCoordinator,
  resolveInteractionTarget = (definition) => definition,
  presenter,
}) {
  let destroyed = false;
  let currentCandidate = null;
  let currentCandidateDefinitions = [];

  function update({ actions = {} } = {}) {
    if (destroyed) return;
    const interact = Boolean(actions.interact);

    if (isSessionDialogueActive(sessionState)) {
      presenter?.hidePrompt?.();
      if (interact) advanceActiveDialogue();
      else showCurrentDialogueLine();
      return;
    }

    applySelection(findCandidate());
    if (currentCandidate) {
      if (!presenter?.isMessageVisible?.()) presenter?.showPrompt?.({ promptKey: currentCandidate.prompt });
    } else presenter?.hidePrompt?.();

    if (interact && currentCandidate) startSelectedInteraction();
  }

  function findCandidate() {
    const player = characterSystem.getSnapshot(sessionState.playerId);
    const targets = [];
    const definitionsByTargetId = new Map();
    const addTarget = (definition) => {
      if (!(worldInteractionCoordinator?.isInteractionAllowed?.(definition) ?? true)) return;
      const resolved = resolveInteractionTarget({ ...definition, __interactionProbe: true }, player);
      if (!resolved) return;
      const target = createInteractionTarget({ ...definition, ...resolved });
      targets.push(target);
      definitionsByTargetId.set(target.id, definition);
    };
    for (const definition of getInteractionDefinitions()) {
      if (!characterSystem.has(definition.entityId)) continue;
      const snapshot = characterSystem.getSnapshot(definition.entityId);
      addTarget({ ...definition, position: snapshot.position });
    }
    for (const definition of worldInteractionCoordinator?.getStaticInteractionDefinitions?.() ?? []) addTarget(definition);
    const candidate = findBestInteractionTarget(player, targets);
    const selectedDefinition = candidate ? definitionsByTargetId.get(candidate.targetId) : null;
    return candidate && selectedDefinition
      ? { candidate, definitions: [selectedDefinition] }
      : null;
  }

  function applySelection(selection) {
    currentCandidate = selection?.candidate ?? null;
    currentCandidateDefinitions = selection?.definitions ?? [];
  }

  function clearCandidate() {
    currentCandidate = null;
    currentCandidateDefinitions = [];
  }

  function startSelectedInteraction() {
    if (currentCandidateDefinitions.length === 0) {
      clearCandidate();
      presenter?.hidePrompt?.();
      return;
    }
    const player = characterSystem.getSnapshot(sessionState.playerId);
    const exactTargets = [];
    for (const definition of currentCandidateDefinitions) {
      if (!(worldInteractionCoordinator?.isInteractionAllowed?.(definition) ?? true)) continue;
      const resolved = resolveInteractionTarget(definition, player);
      if (resolved) exactTargets.push(createInteractionTarget({ ...definition, ...resolved }));
    }
    const candidate = findBestInteractionTarget(player, exactTargets);
    if (!candidate) {
      clearCandidate();
      presenter?.hidePrompt?.();
      return;
    }
    currentCandidate = candidate;
    startCandidateInteraction(candidate);
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
    if (candidate.kind !== "dialogue") {
      const result = worldInteractionCoordinator?.handle?.(candidate) ?? { status: "ignored" };
      if (result?.status === "cooldown") {
        currentCandidate = candidate;
        presenter?.showPrompt?.({ promptKey: candidate.prompt });
        return;
      }
      clearCandidate();
      if (result?.transientMessageShown) {
        currentCandidate = candidate;
        presenter?.showPrompt?.({ promptKey: candidate.prompt });
      } else if (result?.messageKey) {
        presenter?.showMessage?.({ messageKey: result.messageKey });
      } else if (result?.status === "insufficient-energy") {
        presenter?.showMessage?.({ messageKey: "hud:interaction.notEnoughEnergy" });
      } else if (result?.status === "wake-failed") {
        currentCandidate = candidate;
        presenter?.showPrompt?.({ promptKey: candidate.prompt });
      } else {
        presenter?.hidePrompt?.();
      }
      return;
    }
    const dialogueId = resolveCandidateDialogueId(candidate);
    const definition = getDialogueDefinition(dialogueId);
    startDialogue(sessionState, { targetId: candidate.entityId, dialogueId: definition.id });
    clearCandidate();
    presenter?.hidePrompt?.();
    showCurrentDialogueLine();
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
      clearCandidate();
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
      if (isSessionDialogueActive(sessionState)) {
        showCurrentDialogueLine();
        return;
      }
      applySelection(findCandidate());
      if (currentCandidate) presenter?.showPrompt?.({ promptKey: currentCandidate.prompt });
      else presenter?.hidePrompt?.();
    },
    resetCandidate() {
      clearCandidate();
      presenter?.hidePrompt?.();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearCandidate();
      presenter = null;
      characterSystem = null;
      sessionState = null;
    },
  };
}
