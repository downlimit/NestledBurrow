import assert from "node:assert/strict";
import { getDialogueDefinition } from "../src/dialogueConfig.js";
import { INTERACTION_DEFINITIONS } from "../src/interactionConfig.js";
import { createInteractionRuntime } from "../src/interactionRuntime.js";
import { createGameSessionState, getEntityFlag, startDialogue } from "../src/gameSessionState.js";

const definition = getDialogueDefinition("home-npc-greeting");
assert.equal(definition.id, "home-npc-greeting", "dialogue ID is stable");
assert.equal(definition.speakerKey, "dialogue:homeGreeting.speaker", "speaker key is stable");
assert.deepEqual(definition.lines.map((line) => line.textKey), ["dialogue:homeGreeting.lines.hello", "dialogue:homeGreeting.lines.quietVillage", "dialogue:homeGreeting.lines.goodbye"], "dialogue has validation line keys");
assert.equal(definition.lines.length, 3, "dialogue has exactly three lines");
assert.equal(getDialogueDefinition(definition.id), definition, "lookup returns canonical definition");
assert.throws(() => getDialogueDefinition("missing"), /Unknown dialogue definition ID: missing/, "unknown dialogue IDs fail clearly");
for (const inheritedId of ["__proto__", "constructor", "toString"]) {
  assert.throws(
    () => getDialogueDefinition(inheritedId),
    new RegExp(`Unknown dialogue definition ID: ${inheritedId}`),
    `inherited object key ${inheritedId} is not treated as a dialogue definition`,
  );
}
assert(Object.isFrozen(definition), "definition is immutable");
assert(Object.isFrozen(definition.lines), "definition lines are immutable");
assert.throws(() => { definition.lines.push("NOPE"); }, TypeError, "line array cannot mutate");
const stateForShape = createGameSessionState({ initialEntityIds: ["home-npc"] });
startDialogue(stateForShape, { targetId: "home-npc", dialogueId: definition.id });
assert.deepEqual(stateForShape.dialogue, { targetId: "home-npc", dialogueId: definition.id, lineIndex: 0 }, "session stores only dialogue ID and index");
assert(!JSON.stringify(stateForShape.dialogue).includes("homeGreeting.lines"), "session dialogue does not store localization keys or text");

assert(Object.isFrozen(INTERACTION_DEFINITIONS), "interaction definitions are immutable");
const talkDefinition = INTERACTION_DEFINITIONS[0];
assert.equal(talkDefinition.id, "talk-home-npc", "interaction ID is stable");
assert.equal(talkDefinition.entityId, "home-npc", "only home NPC is targeted");
assert(!("position" in talkDefinition), "interaction config has no static position");
assert(Object.isFrozen(talkDefinition.payload), "interaction payload is immutable");

function createFakeCharacterSystem() {
  const snapshots = new Map([
    ["player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } }],
    ["home-npc", { id: "home-npc", position: { x: 100, y: 0 }, facingDirection: { x: -1, y: 0 } }],
    ["street-npc", { id: "street-npc", position: { x: 0, y: 100 }, facingDirection: { x: 0, y: -1 } }],
  ]);
  return {
    set(id, snapshot) { snapshots.set(id, snapshot); },
    getSnapshot(id) { return snapshots.get(id); },
  };
}

function createPresenter() {
  return {
    prompts: [], dialogues: [], hiddenPrompts: 0, hiddenDialogues: 0,
    showPrompt(value) { this.prompts.push(value); },
    hidePrompt() { this.hiddenPrompts += 1; },
    showDialogue(value) { this.dialogues.push(value); },
    hideDialogue() { this.hiddenDialogues += 1; },
  };
}

const characterSystem = createFakeCharacterSystem();
const session = createGameSessionState({ currentWorldId: "village", playerId: "player", initialEntityIds: ["home-npc", "street-npc"] });
const presenter = createPresenter();
const runtime = createInteractionRuntime({ sessionState: session, characterSystem, interactionDefinitions: INTERACTION_DEFINITIONS, getDialogueDefinition, presenter });
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate(), null, "player far away has no prompt");
characterSystem.set("home-npc", { id: "home-npc", position: { x: 10, y: 0 }, facingDirection: { x: -1, y: 0 } });
characterSystem.set("player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: -1, y: 0 } });
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate(), null, "wrong facing hides prompt");
characterSystem.set("player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } });
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate().prompt, "hud:interaction.talk", "facing nearby NPC shows talk prompt key");
runtime.update({ actions: { interact: true } });
assert.equal(runtime.isDialogueActive(), true, "interact starts dialogue");
assert.equal(presenter.dialogues.at(-1).line.textKey, "dialogue:homeGreeting.lines.hello", "first line descriptor is displayed");
assert.equal(runtime.getCurrentCandidate(), null, "candidate prompt clears during dialogue");
assert.equal(runtime.isEntityInActiveDialogue("home-npc"), true, "targeted NPC is paused");
assert.equal(runtime.isEntityInActiveDialogue("street-npc"), false, "other NPC is not paused");
runtime.update({ actions: { interact: true } });
assert.equal(presenter.dialogues.at(-1).line.textKey, "dialogue:homeGreeting.lines.quietVillage", "second line descriptor displays");
assert.equal(presenter.dialogues.at(-1).continuePromptKey, "hud:interaction.next", "middle lines use next key");
runtime.update({ actions: { interact: true } });
assert.equal(presenter.dialogues.at(-1).line.textKey, "dialogue:homeGreeting.lines.goodbye", "third line descriptor displays");
assert.equal(presenter.dialogues.at(-1).continuePromptKey, "hud:interaction.close", "last line uses close key");
runtime.update({ actions: { interact: true } });
assert.equal(runtime.isDialogueActive(), false, "final interact closes dialogue");
assert.equal(getEntityFlag(session, "home-npc", "greeted"), true, "completion flag is stored after final line");
assert.equal(runtime.isEntityInActiveDialogue("home-npc"), false, "targeted NPC resumes after close");
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate().prompt, "hud:interaction.talk", "candidate can appear again after close");
runtime.update({ actions: { interact: true } });
assert.equal(session.dialogue.lineIndex, 0, "repeat conversation restarts at line zero");

const noCandidateSession = createGameSessionState({ initialEntityIds: ["home-npc", "street-npc"] });
const noCandidateSystem = createFakeCharacterSystem();
const noCandidateRuntime = createInteractionRuntime({ sessionState: noCandidateSession, characterSystem: noCandidateSystem, interactionDefinitions: INTERACTION_DEFINITIONS, getDialogueDefinition, presenter: createPresenter() });
noCandidateRuntime.update({ actions: { interact: true } });
assert.equal(noCandidateRuntime.isDialogueActive(), false, "interact without candidate does nothing");
const brokenRuntime = createInteractionRuntime({ sessionState: createGameSessionState({ initialEntityIds: ["home-npc"] }), characterSystem, interactionDefinitions: [{ ...talkDefinition, payload: { dialogueId: "missing" } }], getDialogueDefinition, presenter: createPresenter() });
assert.throws(() => brokenRuntime.update({ actions: { interact: true } }), /Unknown dialogue definition ID: missing/, "unknown dialogue ID fails clearly");
characterSystem.set("home-npc", { id: "home-npc", position: { x: 30, y: 0 }, facingDirection: { x: -1, y: 0 } });
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate(), null, "target position updates from current snapshot, not spawn");
assert.deepEqual(INTERACTION_DEFINITIONS[0], talkDefinition, "runtime does not mutate definitions");
assert.deepEqual(JSON.parse(JSON.stringify(session)), session, "session survives JSON round-trip after dialogue");
runtime.destroy();
runtime.destroy();
assert.equal(runtime.getCurrentCandidate(), null, "destroy is idempotent");
console.log("dialogue checks passed");
