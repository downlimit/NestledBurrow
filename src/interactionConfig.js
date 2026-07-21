const HOME_NPC_DIALOGUE_INTERACTION = deepFreeze({
  id: "talk-home-npc",
  entityId: "home-npc",
  kind: "dialogue",
  radius: 24,
  priority: 0,
  requiresFacing: true,
  facingDotThreshold: 0,
  prompt: "hud:interaction.talk",
  promptKey: "hud:interaction.talk",
  payload: {
    dialogueId: "home-npc-greeting",
  },
});

export const INTERACTION_DEFINITIONS = deepFreeze([HOME_NPC_DIALOGUE_INTERACTION]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
