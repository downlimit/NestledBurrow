import assert from "node:assert/strict";
import { DIALOGUE_DEFINITIONS, getDialogueDefinition } from "../src/dialogueConfig.js";
import { createFreshGameSessionState, getSessionFlag } from "../src/gameSessionState.js";
import { INTERACTION_DEFINITIONS } from "../src/interactionConfig.js";
import { createInteractionRuntime } from "../src/interactionRuntime.js";
import {
  completeNeighborDialogue,
  getNeighborQuestStage,
  NEIGHBOR_DIALOGUE_IDS,
  NEIGHBOR_DIALOGUE_RESOLVER_ID,
  NEIGHBOR_QUEST_FLAGS,
  NEIGHBOR_QUEST_STAGES,
  resolveNeighborDialogueId,
} from "../src/neighborQuest.js";

assert.deepEqual(Object.keys(DIALOGUE_DEFINITIONS).sort(), Object.values(NEIGHBOR_DIALOGUE_IDS).sort(), "all quest dialogue IDs have definitions");
for (const definition of Object.values(DIALOGUE_DEFINITIONS)) {
  assert(Object.isFrozen(definition), `${definition.id} definition is immutable`);
  assert(Object.isFrozen(definition.lines), `${definition.id} lines are immutable`);
  assert(definition.speakerKey.startsWith("dialogue:neighbor."), `${definition.id} speaker uses localization key`);
  assert(definition.lines.every((line) => line.textKey.startsWith("dialogue:neighbor.")), `${definition.id} lines use localization keys`);
}
for (const inheritedId of ["__proto__", "constructor", "toString"]) {
  assert.throws(() => getDialogueDefinition(inheritedId), /Unknown dialogue definition ID/, `inherited key ${inheritedId} is rejected`);
}
assert.equal(INTERACTION_DEFINITIONS.length, 2, "home and street NPC both expose dialogue interactions");
assert(INTERACTION_DEFINITIONS.every((definition) => definition.payload.dialogueResolverId === NEIGHBOR_DIALOGUE_RESOLVER_ID), "both interactions use the canonical resolver ID");

const snapshots = new Map([
  ["player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } }],
  ["home-npc", { id: "home-npc", position: { x: 10, y: 0 }, facingDirection: { x: -1, y: 0 } }],
  ["street-npc", { id: "street-npc", position: { x: 100, y: 0 }, facingDirection: { x: -1, y: 0 } }],
]);
const characterSystem = {
  getSnapshot(id) { return snapshots.get(id); },
  set(id, snapshot) { snapshots.set(id, snapshot); },
};
const presenter = {
  prompts: [], dialogues: [], hiddenPrompts: 0, hiddenDialogues: 0,
  showPrompt(value) { this.prompts.push(value); },
  hidePrompt() { this.hiddenPrompts += 1; },
  showDialogue(value) { this.dialogues.push(value); },
  hideDialogue() { this.hiddenDialogues += 1; },
};
const session = createFreshGameSessionState();
const saves = [];
const runtime = createInteractionRuntime({
  sessionState: session,
  characterSystem,
  interactionDefinitions: INTERACTION_DEFINITIONS,
  getDialogueDefinition,
  resolveDialogueId(resolverId, state, entityId) {
    assert.equal(resolverId, NEIGHBOR_DIALOGUE_RESOLVER_ID, "runtime receives canonical resolver ID");
    return resolveNeighborDialogueId(state, entityId);
  },
  completeDialogue: completeNeighborDialogue,
  onPersistentMutation(event) { saves.push(event); },
  presenter,
});

function placeNear(entityId) {
  const target = snapshots.get(entityId);
  characterSystem.set("player", { id: "player", position: { x: target.position.x - 10, y: target.position.y }, facingDirection: { x: 1, y: 0 } });
  runtime.update({ actions: { interact: false } });
  assert.equal(runtime.getCurrentCandidate().entityId, entityId, `${entityId} becomes current candidate`);
  assert.equal(presenter.prompts.at(-1).promptKey, "hud:interaction.talk", "presenter receives localized prompt key");
}
function completeCurrentDialogue() {
  runtime.update({ actions: { interact: true } });
  assert(runtime.isDialogueActive(), "interaction starts dialogue");
  while (runtime.isDialogueActive()) runtime.update({ actions: { interact: true } });
}

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.talkToStreet, "home intro starts quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.started), "started flag is durable");
assert.equal(saves.length, 1, "first persistent transition saves once");
assert(presenter.dialogues.at(-1).speakerKey.startsWith("dialogue:neighbor."), "presenter receives speaker descriptor rather than rendered text");

placeNear("street-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.returnHome, "street response advances quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.streetAnswered), "street response flag is durable");
assert.equal(saves.length, 2, "second persistent transition saves once");

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.completed, "return home completes quest");
assert(getSessionFlag(session, NEIGHBOR_QUEST_FLAGS.completed), "completed flag is durable");
assert.equal(saves.length, 3, "third persistent transition saves once");

placeNear("home-npc");
completeCurrentDialogue();
assert.equal(saves.length, 3, "repeat dialogue does not write unchanged progress");
assert.deepEqual(JSON.parse(JSON.stringify(session)), session, "session remains JSON serializable after full loop");
runtime.destroy();
runtime.destroy();
assert.equal(runtime.getCurrentCandidate(), null, "destroy is idempotent");
console.log("dialogue checks passed: localized neighbor quest runtime, effects and autosave hooks are aligned");
