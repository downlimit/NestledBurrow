const HOME_NPC_GREETING = deepFreeze({
  id: "home-npc-greeting",
  speaker: "HOME NPC",
  lines: [
    "HELLO THERE.",
    "THE VILLAGE IS QUIET TODAY.",
    "SEE YOU AROUND.",
  ],
});

export const DIALOGUE_DEFINITIONS = deepFreeze({
  [HOME_NPC_GREETING.id]: HOME_NPC_GREETING,
});

export function getDialogueDefinition(dialogueId) {
  if (!Object.hasOwn(DIALOGUE_DEFINITIONS, dialogueId)) {
    throw new Error(`Unknown dialogue definition ID: ${dialogueId}`);
  }
  return DIALOGUE_DEFINITIONS[dialogueId];
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
