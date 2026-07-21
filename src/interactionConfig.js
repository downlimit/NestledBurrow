import { NEIGHBOR_DIALOGUE_RESOLVER_ID, NEIGHBOR_QUEST_ENTITIES } from "./neighborQuest.js";

const createTalkInteraction = (id, entityId) => deepFreeze({
  id,
  entityId,
  kind: "dialogue",
  radius: 24,
  priority: 0,
  requiresFacing: true,
  facingDotThreshold: 0,
  prompt: "hud:interaction.talk",
  promptKey: "hud:interaction.talk",
  payload: {
    dialogueResolverId: NEIGHBOR_DIALOGUE_RESOLVER_ID,
  },
});

export const INTERACTION_DEFINITIONS = deepFreeze([
  createTalkInteraction("talk-home-npc", NEIGHBOR_QUEST_ENTITIES.homeNpc),
  createTalkInteraction("talk-street-npc", NEIGHBOR_QUEST_ENTITIES.streetNpc),
]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
