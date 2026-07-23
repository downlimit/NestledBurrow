import assert from "node:assert/strict";
import {
  DEFAULT_STORAGE_KEY,
  SAVE_SCHEMA_VERSION,
  createSessionPersistence,
  deserializeSessionEnvelope,
  serializeSessionEnvelope,
} from "../src/sessionPersistence.js";
import {
  createFreshGameSessionState,
  getEntityFlag,
  getSessionEntity,
  getSessionFlag,
  normalizeGameSessionState,
  setEntityFlag,
  setSessionFlag,
  startDialogue,
} from "../src/gameSessionState.js";
import {
  NEIGHBOR_DIALOGUE_IDS,
  NEIGHBOR_QUEST_ENTITIES,
  NEIGHBOR_QUEST_FLAGS,
  NEIGHBOR_QUEST_STAGES,
  completeNeighborDialogue,
  getNeighborQuestStage,
  resolveNeighborDialogueId,
} from "../src/neighborQuest.js";

function createMemoryStorage({ failGet = false, failSet = false, failRemove = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem(key) { if (failGet) throw new Error("read failed"); return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { if (failSet) throw new Error("write failed"); data.set(key, String(value)); },
    removeItem(key) { if (failRemove) throw new Error("clear failed"); data.delete(key); },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertStage(state, stage, homeDialogue, streetDialogue) {
  const before = clone(state);
  assert.equal(getNeighborQuestStage(state), stage, `stage ${stage}`);
  assert.equal(resolveNeighborDialogueId(state, NEIGHBOR_QUEST_ENTITIES.homeNpc), homeDialogue, `home dialogue at ${stage}`);
  assert.equal(resolveNeighborDialogueId(state, NEIGHBOR_QUEST_ENTITIES.streetNpc), streetDialogue, `street dialogue at ${stage}`);
  assert.deepEqual(clone(state), before, `resolver is pure at ${stage}`);
}

const session = createFreshGameSessionState();
assertStage(session, NEIGHBOR_QUEST_STAGES.notStarted, NEIGHBOR_DIALOGUE_IDS.homeIntro, NEIGHBOR_DIALOGUE_IDS.streetBefore);
assert.deepEqual(completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.streetResponse).status, "ignored", "street response cannot skip intro");
assert.equal(getNeighborQuestStage(session), NEIGHBOR_QUEST_STAGES.notStarted, "cannot reach completed before start");
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeIntro);
assertStage(session, NEIGHBOR_QUEST_STAGES.talkToStreet, NEIGHBOR_DIALOGUE_IDS.homeReminder, NEIGHBOR_DIALOGUE_IDS.streetResponse);
const afterIntro = clone(session);
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeIntro);
assert.deepEqual(clone(session), afterIntro, "home intro completion is idempotent");
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeReminder);
assert.deepEqual(clone(session), afterIntro, "home reminder repeat does not change flags");
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.streetResponse);
assertStage(session, NEIGHBOR_QUEST_STAGES.returnHome, NEIGHBOR_DIALOGUE_IDS.homeCompletion, NEIGHBOR_DIALOGUE_IDS.streetAfter);
const afterStreet = clone(session);
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.streetAfter);
assert.deepEqual(clone(session), afterStreet, "street after repeat does not change flags");
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeCompletion);
assertStage(session, NEIGHBOR_QUEST_STAGES.completed, NEIGHBOR_DIALOGUE_IDS.homeAfter, NEIGHBOR_DIALOGUE_IDS.streetAfter);
const afterCompletion = clone(session);
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeCompletion);
assert.deepEqual(clone(session), afterCompletion, "home completion is idempotent");
completeNeighborDialogue(session, NEIGHBOR_DIALOGUE_IDS.homeAfter);
assert.deepEqual(clone(session), afterCompletion, "home after repeat does not change flags");
assert.throws(() => resolveNeighborDialogueId(session, "missing-npc"), /Neighbor quest domain error: unknown entity ID/, "invalid entity fails clearly");
assert.throws(() => completeNeighborDialogue(session, "missing-dialogue"), /Neighbor quest domain error: unknown dialogue ID/, "invalid dialogue fails clearly");
assert.equal(getNeighborQuestStage(JSON.parse(JSON.stringify(session))), NEIGHBOR_QUEST_STAGES.completed, "JSON round-trip keeps quest progress");

const storage = createMemoryStorage();
storage.setItem("nestledburrow.language", "ru");
storage.setItem("unrelated", "keep");
const persistence = createSessionPersistence({ storage });
assert.equal(persistence.load().status, "empty", "empty storage reports empty");
const fresh = createFreshGameSessionState();
assert(getSessionEntity(fresh, "player"), "fresh fallback contains player");
assert(getSessionEntity(fresh, "home-npc"), "fresh fallback contains home NPC");
assert(getSessionEntity(fresh, "street-npc"), "fresh fallback contains street NPC");
setSessionFlag(fresh, NEIGHBOR_QUEST_FLAGS.started, true);
setEntityFlag(fresh, "home-npc", "visited", true);
startDialogue(fresh, { targetId: "home-npc", dialogueId: NEIGHBOR_DIALOGUE_IDS.homeReminder });
const beforeSave = clone(fresh);
assert.equal(persistence.save(fresh).status, "saved", "valid state saves");
assert.deepEqual(clone(fresh), beforeSave, "save does not mutate state");
const rawSave = storage.getItem(DEFAULT_STORAGE_KEY);
assert(!rawSave.includes("targetId"), "active dialogue target is not saved");
assert(!rawSave.includes("lineIndex"), "active dialogue line is not saved");
assert(!rawSave.includes("Phaser"), "serialized save has no Phaser values");
const loaded = persistence.load();
assert.equal(loaded.status, "loaded", "valid save loads");
assert.equal(loaded.state.dialogue.targetId, null, "loaded game has no active dialogue target");
assert.equal(getSessionFlag(loaded.state, NEIGHBOR_QUEST_FLAGS.started), true, "session flags persist");
assert.equal(getEntityFlag(loaded.state, "home-npc", "visited"), true, "entity flags persist");
assert.equal(Object.getPrototypeOf(loaded.state.flags), null, "loaded session flags use null prototype");
assert.equal(Object.getPrototypeOf(loaded.state.entities), null, "loaded entities use null prototype");
assert.equal(persistence.clear().status, "cleared", "clear removes progress key");
assert.equal(storage.getItem(DEFAULT_STORAGE_KEY), null, "progress key removed");
assert.equal(storage.getItem("nestledburrow.language"), "ru", "language key preserved");
assert.equal(storage.getItem("unrelated"), "keep", "unrelated key preserved");

for (const [label, raw] of [
  ["corrupted JSON", "{"],
  ["array", "[]"],
  ["null", "null"],
  ["missing version", JSON.stringify({ state: fresh })],
  ["invalid booleans", JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: { ...clone(fresh), flags: { bad: "true" } } })],
  ["invalid entity shape", JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: { ...clone(fresh), entities: { "home-npc": { id: "different", flags: {} } } } })],
]) {
  const result = deserializeSessionEnvelope(raw);
  assert.equal(result.status, label === "missing version" ? "unsupported" : "recovered", `${label} handled safely`);
  if (result.state) assert(getSessionEntity(result.state, "player"), `${label} fallback has player`);
}
assert.equal(deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 999, state: clone(fresh) })).status, "unsupported", "future version unsupported");
assert.equal(deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 0, state: clone(fresh) })).status, "unsupported", "old unknown version unsupported");
assert.equal(createSessionPersistence({ storage: createMemoryStorage({ failGet: true }) }).load().diagnostic.kind, "storage-read", "read exception controlled");
assert.equal(createSessionPersistence({ storage: createMemoryStorage({ failSet: true }) }).save(fresh).diagnostic.kind, "storage-write", "write exception controlled");
assert.equal(createSessionPersistence({ storage: createMemoryStorage({ failRemove: true }) }).clear().diagnostic.kind, "storage-clear", "clear exception controlled");
assert.equal(createSessionPersistence({ storage }).save({ ...fresh, version: "1" }).status, "error", "save accepts only valid canonical state");

for (const poisonedKey of ["__proto__", "constructor", "prototype"]) {
  assert.throws(() => normalizeGameSessionState({ ...clone(fresh), flags: { [poisonedKey]: true } }), /reserved/, `${poisonedKey} flag rejected`);
  assert.throws(() => normalizeGameSessionState({ ...clone(fresh), entities: { [poisonedKey]: { id: poisonedKey, flags: {} } } }), /reserved|Entity/, `${poisonedKey} entity rejected`);
}

const serialized = serializeSessionEnvelope(fresh);
const parsed = JSON.parse(serialized);
assert.equal(parsed.schemaVersion, SAVE_SCHEMA_VERSION, "save envelope is versioned");
assert.equal(parsed.state.version, fresh.version, "session model version is inside state");
assert.equal(parsed.state.currentWorldId, fresh.currentWorldId, "current world saved");
assert.equal(parsed.state.playerId, fresh.playerId, "player ID saved");
assert(!("dialogue" in parsed.state), "transient dialogue is not in persistence state");
assert(!serialized.includes("[object"), "serialized result contains JSON data only");


const oldV1 = clone(fresh);
delete oldV1.gameplay;
oldV1.flags[NEIGHBOR_QUEST_FLAGS.completed] = true;
oldV1.entities["home-npc"].flags.visited = true;
const oldLoaded = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: oldV1 }));
assert.equal(oldLoaded.status, "loaded", "old v1 save without gameplay fields loads");
assert.equal(oldLoaded.state.gameplay.energy.current, 100, "old v1 save gets starting energy default");
assert.equal(oldLoaded.state.gameplay.energy.max, 100, "old v1 save gets max energy default");
assert.equal(oldLoaded.state.gameplay.resources.wood, 0, "old v1 save gets wood default");
assert.equal(oldLoaded.state.gameplay.debris["fallen-log-001"].cleared, false, "old v1 save restores debris default");
assert.equal(getSessionFlag(oldLoaded.state, NEIGHBOR_QUEST_FLAGS.completed), true, "old v1 save normalization preserves quest flags");
assert.equal(getEntityFlag(oldLoaded.state, "home-npc", "visited"), true, "old v1 save normalization preserves entity flags");

const gameplayRoundTrip = createFreshGameSessionState();
gameplayRoundTrip.gameplay.energy.current = 55;
gameplayRoundTrip.gameplay.resources.wood = 3;
gameplayRoundTrip.gameplay.debris["fallen-log-001"].cleared = true;
const gameplayLoaded = deserializeSessionEnvelope(serializeSessionEnvelope(gameplayRoundTrip));
assert.equal(gameplayLoaded.state.gameplay.energy.current, 55, "energy current persists");
assert.equal(gameplayLoaded.state.gameplay.resources.wood, 3, "wood persists");
assert.equal(gameplayLoaded.state.gameplay.debris["fallen-log-001"].cleared, true, "cleared debris persists");
assert.deepEqual(createFreshGameSessionState().gameplay, { energy: { current: 100, max: 100 }, resources: { wood: 0 }, debris: { "fallen-log-001": { cleared: false } } }, "New Game fresh state returns gameplay defaults");
assert.equal(JSON.stringify(JSON.parse(JSON.stringify(gameplayRoundTrip))), JSON.stringify(gameplayRoundTrip), "gameplay state remains JSON-safe");

console.log("progress checks passed");
