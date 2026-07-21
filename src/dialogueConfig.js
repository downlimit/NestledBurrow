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
  const definition = DIALOGUE_DEFINITIONS[dialogueId];
  if (!definition) {
    throw new Error(`Unknown dialogue definition ID: ${dialogueId}`);
  }
  return definition;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
