import assert from "node:assert/strict";
import {
  advanceDialogue,
  closeDialogue,
  createGameSessionState,
  ensureSessionEntity,
  getEntityFlag,
  getSessionEntity,
  getSessionFlag,
  isDialogueActive,
  setEntityFlag,
  setSessionFlag,
  startDialogue,
} from "../src/gameSessionState.js";
import { createInteractionTarget, findBestInteractionTarget } from "../src/interaction.js";
import { DEBRIS_OBJECTS } from "../src/debrisConfig.js";

function assertPlainSerializable(value, label) {
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(value))), JSON.stringify(value), `${label} survives JSON round-trip`);
  const seen = [value];
  for (const item of seen) {
    assert(!(item instanceof Map), `${label} contains no Map`);
    assert(!(item instanceof Set), `${label} contains no Set`);
    assert.notEqual(typeof item, "function", `${label} contains no function`);
    if (item && typeof item === "object") {
      assert(!("sprite" in item), `${label} contains no sprite reference`);
      assert(!("scene" in item), `${label} contains no Phaser-like scene reference`);
      seen.push(...Object.values(item));
    }
  }
}

const state = createGameSessionState();
assert.equal(state.version, 1, "default state has canonical version");
assert.equal(state.currentWorldId, "village", "default state has canonical world");
assert.equal(state.playerId, "player", "default state has canonical player");
assert.deepEqual(state.entities, { player: { id: "player", flags: {} } }, "default state has player entity");
assert.deepEqual(state.flags, {}, "default state has no flags");
assert.deepEqual(state.dialogue, { targetId: null, dialogueId: null, lineIndex: 0 }, "default state has no active dialogue");
assert.equal(Object.keys(state.gameplay.debris).length, 43, "default state has all debris records");
assert.equal(Object.keys(state.gameplay.debris).length, DEBRIS_OBJECTS.length, "default debris state matches config");
assert(Object.values(state.gameplay.debris).every((item) => item.cleared === false && item.remainingHits === 5), "default debris starts uncleared with five hits");
const customState = createGameSessionState({ currentWorldId: "forest", playerId: "hero" });
assert.equal(customState.currentWorldId, "forest", "custom world is supported");
assert.equal(customState.playerId, "hero", "custom player is supported");
assert.deepEqual(customState.entities, { hero: { id: "hero", flags: {} } }, "custom player entity is registered");
assert.equal(Object.keys(customState.gameplay.debris).length, 43, "custom state has gameplay defaults");
assert.deepEqual(Object.keys(createGameSessionState({ initialEntityIds: ["npc-a", "npc-b"] }).entities), ["player", "npc-a", "npc-b"], "initial entities register");
assert.deepEqual(Object.keys(createGameSessionState({ initialEntityIds: ["npc-a", "npc-a"] }).entities), ["player", "npc-a"], "duplicate initial IDs do not duplicate data");
const ensured = ensureSessionEntity(state, "npc-a");
assert.equal(ensureSessionEntity(state, "npc-a"), ensured, "ensureSessionEntity is idempotent");
assert.equal(getSessionEntity(state, "missing"), null, "getSessionEntity does not create unknown entities");
assert.deepEqual(Object.keys(state.entities), ["player", "npc-a"], "unknown get leaves entities unchanged");

const reservedIdState = createGameSessionState({
  playerId: "constructor",
  initialEntityIds: ["__proto__", "toString"],
});
assert.equal(getSessionEntity(reservedIdState, "constructor").id, "constructor", "prototype-name player ID is stored as own entity data");
assert.equal(getSessionEntity(reservedIdState, "__proto__").id, "__proto__", "__proto__ entity ID is stored as own entity data");
assert.equal(getSessionEntity(reservedIdState, "toString").id, "toString", "inherited-name entity ID is stored as own entity data");
assert.equal(Object.getPrototypeOf(reservedIdState.entities), Object.prototype, "reserved entity IDs do not mutate the entities prototype");
setSessionFlag(reservedIdState, "__proto__", true);
setSessionFlag(reservedIdState, "constructor", false);
assert.equal(getSessionFlag(reservedIdState, "__proto__"), true, "__proto__ session flag round-trips as data");
assert.equal(getSessionFlag(reservedIdState, "constructor"), false, "constructor session flag round-trips as data");
assert.equal(Object.getPrototypeOf(reservedIdState.flags), Object.prototype, "reserved session flags do not mutate the flags prototype");
setEntityFlag(reservedIdState, "__proto__", "constructor", true);
assert.equal(getEntityFlag(reservedIdState, "__proto__", "constructor"), true, "reserved entity flag IDs round-trip as data");
assert.deepEqual(JSON.parse(JSON.stringify(reservedIdState)), reservedIdState, "reserved IDs survive session JSON round-trip");

assert.equal(setSessionFlag(state, "met-npc", true), true, "global flag setter returns value");
assert.equal(getSessionFlag(state, "met-npc"), true, "global flag reads true");
assert.equal(getSessionFlag(state, "unknown-flag"), false, "missing global flag reads false");
setEntityFlag(state, "npc-a", "greeted", true);
assert.equal(getEntityFlag(state, "npc-a", "greeted"), true, "entity flag reads true");
assert.equal(getEntityFlag(state, "npc-a", "missing-flag"), false, "missing entity flag reads false");
assert.throws(() => setEntityFlag(state, "missing", "flag", true), /Unknown session entity: missing/, "unknown entity flag set fails clearly");
assert.throws(() => createGameSessionState({ currentWorldId: "" }), /World ID/, "invalid world IDs fail");
assert.throws(() => createGameSessionState({ playerId: " " }), /Player ID/, "invalid player IDs fail");
assert.throws(() => ensureSessionEntity(state, ""), /Entity ID/, "invalid entity IDs fail");
assert.throws(() => setSessionFlag(state, "", true), /Flag ID/, "invalid flag IDs fail");
assert.throws(() => setSessionFlag(state, "x", "yes"), /boolean/, "flags must be boolean");
assert.deepEqual(startDialogue(state, { targetId: "npc-a", dialogueId: "home-npc-greeting" }), { status: "started", targetId: "npc-a", dialogueId: "home-npc-greeting", lineIndex: 0 }, "dialogue starts");
assert.equal(isDialogueActive(state), true, "started dialogue is active");
ensureSessionEntity(state, "npc-b");
startDialogue(state, { targetId: "npc-b", dialogueId: "replacement" });
assert.deepEqual(state.dialogue, { targetId: "npc-b", dialogueId: "replacement", lineIndex: 0 }, "repeated start replaces dialogue");
assert.deepEqual(advanceDialogue(state, 3), { status: "advanced", advanced: true, lineIndex: 1 }, "dialogue advances to next line");
assert.deepEqual(advanceDialogue(state, 3), { status: "advanced", advanced: true, lineIndex: 2 }, "dialogue advances while lines remain");
assert.deepEqual(advanceDialogue(state, 3), { status: "closed", advanced: false, lineIndex: 0 }, "dialogue closes after final line");
assert.equal(isDialogueActive(state), false, "final line closes dialogue");
startDialogue(state, { targetId: "npc-a", dialogueId: "manual-close" });
assert.deepEqual(closeDialogue(state), { status: "closed", lineIndex: 0 }, "explicit close reports closed");
assert.deepEqual(state.dialogue, { targetId: null, dialogueId: null, lineIndex: 0 }, "explicit close resets dialogue");
assert.deepEqual(advanceDialogue(state, 2), { status: "inactive", advanced: false, lineIndex: 0 }, "advance without dialogue is a no-op status");
assert.throws(() => advanceDialogue(state, 0), /positive integer/, "line count must be positive");
assert.throws(() => advanceDialogue(state, 1.5), /positive integer/, "line count must be an integer");
assert.deepEqual(JSON.parse(JSON.stringify(state)), state, "JSON stringify/parse preserves session state");
assertPlainSerializable(state, "session state");

const baseTarget = createInteractionTarget({
  id: "talk-home-npc",
  entityId: "home-npc",
  kind: "dialogue",
  position: { x: 10, y: 0 },
  radius: 16,
  prompt: "Talk",
  payload: { dialogueId: "home-npc-greeting", nested: { safe: true } },
});
assert.equal(baseTarget.priority, 0, "target priority defaults to 0");
assert.equal(baseTarget.requiresFacing, true, "target requires facing by default");
assert.equal(baseTarget.facingDotThreshold, 0, "target facing threshold defaults to 0");
assert.deepEqual(createInteractionTarget({ id: "empty-payload", entityId: "npc", kind: "dialogue", position: { x: 0, y: 0 }, radius: 1, prompt: "Talk" }).payload, {}, "payload defaults to empty object");
assert(Object.isFrozen(baseTarget), "descriptor is frozen");
assert(Object.isFrozen(baseTarget.position), "descriptor position is frozen");
assert(Object.isFrozen(baseTarget.payload), "descriptor payload is frozen");
assert(Object.isFrozen(baseTarget.payload.nested), "nested payload is frozen");
assert.throws(() => createInteractionTarget({ ...baseTarget, id: "" }), /target ID/, "target ID validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, entityId: "" }), /entity ID/, "entity ID validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, kind: "" }), /kind/, "kind validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, position: { x: Infinity, y: 0 } }), /position x/, "position x validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, radius: 0 }), /radius/, "radius validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, priority: NaN }), /priority/, "priority validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, requiresFacing: "yes" }), /requiresFacing/, "requiresFacing validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, facingDotThreshold: 2 }), /facingDotThreshold/, "facing threshold validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, prompt: "" }), /prompt/, "prompt validates");
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: [] }), /plain serializable/, "payload validates plain object");
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: { nested: new Map([["key", "value"]]) } }), /plain objects/, "nested Map payloads are rejected instead of being silently erased");
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: { createdAt: new Date() } }), /plain objects/, "nested class instances are rejected instead of changing shape");
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: { score: Number.NaN } }), /finite JSON numbers/, "non-finite payload numbers are rejected instead of becoming null");
const sparsePayload = { values: [] };
sparsePayload.values.length = 1;
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: sparsePayload }), /sparse arrays/, "sparse payload arrays are rejected instead of becoming null entries");
const circularPayload = {};
circularPayload.self = circularPayload;
assert.throws(() => createInteractionTarget({ ...baseTarget, payload: circularPayload }), /circular references/, "circular payloads fail clearly");

const source = { id: "player", position: { x: 0, y: 0 }, facingDirection: { x: 1, y: 0 } };
assert.equal(findBestInteractionTarget(source, [baseTarget]).targetId, "talk-home-npc", "target inside radius is selected");
assert.equal(findBestInteractionTarget(source, [createInteractionTarget({ ...baseTarget, id: "far", position: { x: 17, y: 0 } })]), null, "target outside radius is ignored");
assert.equal(findBestInteractionTarget(source, [baseTarget]).entityId, "home-npc", "target ahead is available");
assert.equal(findBestInteractionTarget(source, [createInteractionTarget({ ...baseTarget, id: "behind", position: { x: -1, y: 0 } })]), null, "target behind is unavailable");
assert.equal(findBestInteractionTarget(source, [createInteractionTarget({ ...baseTarget, id: "threshold", position: { x: 10, y: 10 }, facingDotThreshold: 0.8 })]), null, "custom facing threshold is applied");
assert.equal(findBestInteractionTarget({ ...source, facingDirection: { x: 0, y: 0 } }, [baseTarget]), null, "zero-length facing fails facing check");
assert.equal(findBestInteractionTarget({ ...source, facingDirection: { x: 0, y: 0 } }, [createInteractionTarget({ ...baseTarget, id: "same", position: { x: 0, y: 0 } })]).targetId, "same", "same-position ignores facing");
assert.equal(findBestInteractionTarget({ ...source, id: "home-npc" }, [baseTarget]), null, "source entity is excluded");
const closeLow = createInteractionTarget({ ...baseTarget, id: "close-low", position: { x: 1, y: 0 }, priority: 0 });
const farHigh = createInteractionTarget({ ...baseTarget, id: "far-high", position: { x: 8, y: 0 }, priority: 1 });
assert.equal(findBestInteractionTarget(source, [closeLow, farHigh]).targetId, "far-high", "priority beats distance");
const closeSame = createInteractionTarget({ ...baseTarget, id: "close-same", position: { x: 2, y: 0 } });
const farSame = createInteractionTarget({ ...baseTarget, id: "far-same", position: { x: 3, y: 0 } });
assert.equal(findBestInteractionTarget(source, [farSame, closeSame]).targetId, "close-same", "distance breaks equal priority");
const tieB = createInteractionTarget({ ...baseTarget, id: "b-target", position: { x: 4, y: 0 } });
const tieA = createInteractionTarget({ ...baseTarget, id: "a-target", position: { x: 4, y: 0 } });
assert.equal(findBestInteractionTarget(source, [tieB, tieA]).targetId, "a-target", "ID tie-break is deterministic");
assert.equal(findBestInteractionTarget(source, [tieA, tieB]).targetId, "a-target", "input order does not affect full tie");
const payloadInput = { dialogueId: "copy-test" };
const copied = createInteractionTarget({ ...baseTarget, id: "copy", payload: payloadInput });
payloadInput.dialogueId = "mutated";
const candidate = findBestInteractionTarget(source, [copied]);
assert.deepEqual(candidate.payload, { dialogueId: "copy-test" }, "payload is defensively copied into descriptor and candidate");
candidate.payload.dialogueId = "candidate-mutated";
assert.equal(copied.payload.dialogueId, "copy-test", "candidate payload does not expose descriptor reference");
const sourceBefore = JSON.stringify(source);
const targetsBefore = JSON.stringify([baseTarget]);
findBestInteractionTarget(source, [baseTarget]);
assert.equal(JSON.stringify(source), sourceBefore, "source is not mutated");
assert.equal(JSON.stringify([baseTarget]), targetsBefore, "targets are not mutated");
assert.equal(findBestInteractionTarget(source, []), null, "empty target list returns null");
assert.equal(findBestInteractionTarget(source, [createInteractionTarget({ ...baseTarget, id: "no-access", position: { x: -2, y: 0 } })]), null, "no accessible targets returns null");
assertPlainSerializable(baseTarget, "interaction target");
assertPlainSerializable(candidate, "interaction candidate");


const debrisTarget = createInteractionTarget({
  id: "fallen-log-01",
  entityId: "fallen-log-01",
  kind: "clear-debris",
  position: { x: 8, y: 0 },
  radius: 16,
  priority: 1,
  prompt: "hud:interaction.clear",
  payload: { debrisId: "fallen-log-01" },
});
assert.equal(findBestInteractionTarget(source, [baseTarget, debrisTarget]).targetId, "fallen-log-01", "static debris target participates in facing/radius selection and priority is deterministic");
assert.equal(findBestInteractionTarget(source, [baseTarget]).targetId, "talk-home-npc", "dialogue target selection still works without static object candidates");
assert.equal(findBestInteractionTarget(source, [debrisTarget, createInteractionTarget({ ...debrisTarget, id: "a-debris", position: { x: 8, y: 0 } })]).targetId, "a-debris", "static target competition uses stable ID tie-break");
assertPlainSerializable(debrisTarget, "debris interaction target");
