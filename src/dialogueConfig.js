export const DIALOGUE_DEFINITIONS = Object.freeze({});

export function getDialogueDefinition(dialogueId) {
  if (!Object.hasOwn(DIALOGUE_DEFINITIONS, dialogueId)) {
    throw new Error(`Unknown dialogue definition ID: ${dialogueId}`);
  }
  return DIALOGUE_DEFINITIONS[dialogueId];
}
