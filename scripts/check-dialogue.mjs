import assert from "node:assert/strict";
import { DIALOGUE_DEFINITIONS, getDialogueDefinition } from "../src/dialogueConfig.js";
import { createFreshGameSessionState } from "../src/gameSessionState.js";
import { INTERACTION_DEFINITIONS, SEED_MERCHANT_INTERACTION_KIND } from "../src/interactionConfig.js";
import { createInteractionRuntime } from "../src/interactionRuntime.js";

assert.deepEqual(Object.keys(DIALOGUE_DEFINITIONS), [], "obsolete neighbor dialogue definitions are removed");
for (const inheritedId of ["__proto__", "constructor", "toString"]) {
  assert.throws(
    () => getDialogueDefinition(inheritedId),
    /Unknown dialogue definition ID/,
    `inherited key ${inheritedId} is rejected`,
  );
}
assert.equal(INTERACTION_DEFINITIONS.length, 1, "only the stationary seed merchant remains");
assert.equal(INTERACTION_DEFINITIONS[0].entityId, "seed-merchant");
assert.equal(INTERACTION_DEFINITIONS[0].kind, SEED_MERCHANT_INTERACTION_KIND);
assert(Object.isFrozen(INTERACTION_DEFINITIONS[0]), "merchant interaction is immutable");

const snapshots = new Map([
  ["player", { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } }],
  ["seed-merchant", { id: "seed-merchant", position: { x: 10, y: 0 }, facingDirection: { x: -1, y: 0 } }],
]);
const presenter = {
  prompts: [], messages: [], hiddenPrompts: 0, hiddenDialogues: 0,
  showPrompt(value) { this.prompts.push(value); },
  hidePrompt() { this.hiddenPrompts += 1; },
  hideDialogue() { this.hiddenDialogues += 1; },
  isMessageVisible() { return false; },
  showMessage(value) { this.messages.push(value); },
};
const interactions = [];
const runtime = createInteractionRuntime({
  sessionState: createFreshGameSessionState(),
  characterSystem: { getSnapshot(id) { return snapshots.get(id); } },
  interactionDefinitions: INTERACTION_DEFINITIONS,
  getDialogueDefinition,
  runWorldObjectInteraction(candidate) {
    interactions.push(candidate);
    return { status: "merchant-opened", mutated: false };
  },
  presenter,
});
runtime.update({ actions: { interact: false } });
assert.equal(runtime.getCurrentCandidate()?.entityId, "seed-merchant");
assert.equal(presenter.prompts.at(-1).promptKey, "hud:interaction.openSeedShop");
runtime.update({ actions: { interact: true } });
assert.equal(interactions.length, 1, "merchant interaction is routed through the world-object owner");

const wakeRuntime = createInteractionRuntime({
  sessionState: createFreshGameSessionState(),
  characterSystem: { getSnapshot(id) { return snapshots.get(id); } },
  interactionDefinitions: [],
  getStaticInteractionDefinitions: () => [{
    id: "wake", entityId: "wake", roomId: "world", kind: "wake-exhausted",
    position: { x: 0, y: 0 }, radius: 24, priority: 100, requiresFacing: false,
    facingDotThreshold: -1, prompt: "hud:interaction.wake", payload: {},
  }],
  runWorldObjectInteraction: () => ({
    status: "wake-failed",
    messageKey: "hud:interaction.wakeFailed",
    transientMessageShown: true,
    mutated: false,
  }),
  presenter,
});
wakeRuntime.update({ actions: { interact: true } });
assert.deepEqual(presenter.messages, [], "wake failure does not replace the action label with duplicate status text");
assert.equal(presenter.prompts.at(-1).promptKey, "hud:interaction.wake", "wake action remains available after a failed attempt");
runtime.destroy();
wakeRuntime.destroy();
console.log("interaction checks passed: obsolete neighbor quest removed and seed merchant route is active");
