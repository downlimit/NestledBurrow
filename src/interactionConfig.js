const TALK_HOME_NPC = deepFreeze({
  id: "talk-home-npc",
  entityId: "home-npc",
  kind: "dialogue",
  radius: 24,
  priority: 0,
  requiresFacing: true,
  facingDotThreshold: 0,
  prompt: "TALK",
  payload: {
    dialogueId: "home-npc-greeting",
  },
});

export const INTERACTION_DEFINITIONS = deepFreeze([TALK_HOME_NPC]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
