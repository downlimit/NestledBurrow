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
  hitResourceNode,
  drainAwakeEnergy,
  regenerateEnergy,
  advanceGameTime,
} from "../src/gameSessionState.js";
import { DEFAULT_GAMEPLAY_TUNING, RESOURCE_OBJECTS } from "../src/resourceConfig.js";
import { getResourceProfile, resolveActionHp } from "../src/resourceDomain.js";

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

const session = createFreshGameSessionState();
assert.deepEqual(session.gameplay.needs, { novelty: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 }, "fresh state starts every persisted need at 100");
assert.equal(Object.keys(session.gameplay.resourceNodes).length, RESOURCE_OBJECTS.length, "fresh state has every resource node");
assert.equal(RESOURCE_OBJECTS.filter((item) => item.worldId === "village" && item.profileId === "log-small").length, 2, "village starts with exactly two small logs");
assert.equal(new Set(RESOURCE_OBJECTS.map((item) => item.id)).size, RESOURCE_OBJECTS.length, "resource IDs are unique");
assert(Object.values(session.gameplay.resourceNodes).every((item) => item.progress === 0 && item.cleared === false), "fresh resources start at zero progress");
assert.equal(session.gameplay.stone, 0, "fresh stone counter starts at zero");
for (const profileId of ["log-small", "log-large", "stone-small", "stone-large", "ruby-node"]) {
  const profile = getResourceProfile(profileId);
  assert(Object.isFrozen(profile) && Object.isFrozen(profile.actionHp), `${profileId} profile is immutable`);
  assert.deepEqual(Object.keys(profile.actionHp), ["chop", "mine", "mow"], `${profileId} exposes every work action`);
}
assert.equal(session.gameplay.worldTimeSeconds, 21600, "fresh state starts at 06:00");
assert(getSessionEntity(session, "seed-merchant"), "fresh state contains the stationary seed merchant");
assert.equal(getSessionEntity(session, "home-npc"), null, "obsolete home NPC is absent");
assert.equal(getSessionEntity(session, "street-npc"), null, "obsolete street NPC is absent");

const storage = createMemoryStorage();
storage.setItem("nestledburrow.language", "ru");
storage.setItem("unrelated", "keep");
const persistence = createSessionPersistence({ storage });
assert.equal(persistence.load().status, "empty", "empty storage reports empty");
const fresh = createFreshGameSessionState();
assert(getSessionEntity(fresh, "player"), "fresh fallback contains player");
assert(getSessionEntity(fresh, "seed-merchant"), "fresh fallback contains seed merchant");
setSessionFlag(fresh, "test.persisted", true);
setEntityFlag(fresh, "seed-merchant", "visited", true);
startDialogue(fresh, { targetId: "seed-merchant", dialogueId: "transient-test" });
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
assert.equal(getSessionFlag(loaded.state, "test.persisted"), true, "session flags persist");
assert.equal(getEntityFlag(loaded.state, "seed-merchant", "visited"), true, "entity flags persist");
assert.deepEqual(loaded.state.gameplay.needs, fresh.gameplay.needs, "needs survive save/load exactly");
const oldSaveLoad = deserializeSessionEnvelope(JSON.stringify({
  schemaVersion: 1,
  state: {
    version: 1,
    currentWorldId: "village",
    playerId: "player",
    entities: { player: { id: "player", flags: {} }, "home-npc": { id: "home-npc", flags: { visited: true } } },
    flags: { old: true },
  },
}));
assert.equal(Object.keys(oldSaveLoad.state.gameplay.resourceNodes).length, RESOURCE_OBJECTS.length, "version-1 save without gameplay loads resource defaults");
assert.equal(oldSaveLoad.state.gameplay.worldTimeSeconds, 21600, "version-1 save without gameplay starts at 06:00");
assert.equal(getSessionFlag(oldSaveLoad.state, "old"), true, "old save session flags survive gameplay normalization");
assert.equal(getSessionEntity(oldSaveLoad.state, "home-npc"), null, "old home NPC is removed by sequential migration");
assert(getSessionEntity(oldSaveLoad.state, "seed-merchant"), "old saves receive the seed merchant");
assert.deepEqual(oldSaveLoad.state.gameplay.needs, { novelty: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 }, "schema-v1 migrates through v2 and adds full needs");
const versionTwo = clone(fresh);
versionTwo.version = 2;
delete versionTwo.gameplay.needs;
versionTwo.gameplay.currentEnergy = 63;
versionTwo.gameplay.worldTimeSeconds = 32100;
versionTwo.gameplay.wood = 7;
const v2Load = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 2, state: versionTwo }));
assert.equal(v2Load.status, "loaded", "schema-v2 migrates explicitly");
assert.deepEqual(v2Load.state.gameplay.needs, { novelty: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 });
assert.deepEqual(
  { energy: v2Load.state.gameplay.currentEnergy, time: v2Load.state.gameplay.worldTimeSeconds, wood: v2Load.state.gameplay.wood },
  { energy: 63, time: 32100, wood: 7 },
  "schema-v2 migration preserves prior gameplay",
);
const partialLegacy = deserializeSessionEnvelope(JSON.stringify({
  schemaVersion: 1,
  state: {
    version: 1, currentWorldId: "village", playerId: "player",
    entities: { player: { id: "player", flags: {} }, "home-npc": { id: "home-npc", flags: {} }, "street-npc": { id: "street-npc", flags: {} } }, flags: {},
    gameplay: { currentEnergy: 75, maximumEnergy: 100, wood: 4, rubies: 2, debris: { "fallen-log-01": { cleared: false, remainingHits: 3 } }, rubyNodes: { "yard-ruby-01": { cleared: true, remainingHits: 0 } }, worldTimeSeconds: 30000 },
  },
}));
assert.equal(partialLegacy.status, "loaded", "schema-v1 gameplay migrates explicitly");
assert.equal(partialLegacy.state.gameplay.resourceNodes["fallen-log-01"].progress, 0.4, "legacy partial hits become normalized progress against the old maximum");
assert.equal(partialLegacy.state.gameplay.resourceNodes["yard-ruby-01"].cleared, true, "legacy cleared ruby stays cleared");
assert.deepEqual({ wood: partialLegacy.state.gameplay.wood, stone: partialLegacy.state.gameplay.stone, rubies: partialLegacy.state.gameplay.rubies }, { wood: 4, stone: 0, rubies: 2 }, "migration preserves rewards and initializes stone without duplicate grants");
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
  ["invalid entity shape", JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state: { ...clone(fresh), entities: { "seed-merchant": { id: "different", flags: {} } } } })],
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

const clearState = createFreshGameSessionState();
assert.deepEqual(hitResourceNode(clearState, "fallen-log-01", { damage: 7, energyPerHit: 20, tuning: DEFAULT_GAMEPLAY_TUNING }).status, "cleared", "resource clears once");
assert.equal(clearState.gameplay.currentEnergy, 80, "clearing spends energy");
assert.equal(clearState.gameplay.wood, 1, "clearing awards wood");
assert.equal(hitResourceNode(clearState, "fallen-log-01", { damage: 7, energyPerHit: 20, tuning: DEFAULT_GAMEPLAY_TUNING }).mutated, false, "repeat clearing does not mutate");
const lowEnergy = createFreshGameSessionState();
lowEnergy.gameplay.currentEnergy = 10;
const lowBefore = clone(lowEnergy);
assert.equal(hitResourceNode(lowEnergy, "fallen-log-01", { damage: 7, energyPerHit: 20, tuning: DEFAULT_GAMEPLAY_TUNING }).status, "insufficient-energy", "low energy blocks clearing");
assert.deepEqual(clone(lowEnergy), lowBefore, "low energy creates no partial mutation");
const clearRoundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(clearState));
assert.equal(clearRoundTrip.state.gameplay.resourceNodes["fallen-log-01"].cleared, true, "cleared state persists");
assert.equal(clearRoundTrip.state.gameplay.currentEnergy, 80, "energy persists");
assert.equal(clearRoundTrip.state.gameplay.wood, 1, "wood persists");
assert.equal(Object.keys(createFreshGameSessionState().gameplay.resourceNodes).length, RESOURCE_OBJECTS.length, "New Game fresh state returns all resource defaults");
assert.deepEqual(JSON.parse(JSON.stringify(clearState)), clearState, "gameplay state remains JSON-safe");

const serialized = serializeSessionEnvelope(fresh);
const parsed = JSON.parse(serialized);
assert.equal(parsed.schemaVersion, SAVE_SCHEMA_VERSION, "save envelope is versioned");
assert.equal(parsed.state.version, fresh.version, "session model version is inside state");
assert.equal(parsed.state.currentWorldId, fresh.currentWorldId, "current world saved");
assert.equal(parsed.state.playerId, fresh.playerId, "player ID saved");
assert(!("dialogue" in parsed.state), "transient dialogue is not in persistence state");
assert(!serialized.includes("[object"), "serialized result contains JSON data only");


const hitState = createFreshGameSessionState();
assert.equal(hitResourceNode(hitState, "fallen-log-01", { damage: 1, energyPerHit: 1, tuning: DEFAULT_GAMEPLAY_TUNING }).progress, 1 / 7, "one hit stores normalized progress");
assert.equal(hitState.gameplay.currentEnergy, 99, "one hit spends one energy");
for (let i = 0; i < 5; i += 1) hitResourceNode(hitState, "fallen-log-01", { damage: 1, energyPerHit: 1, tuning: DEFAULT_GAMEPLAY_TUNING });
assert.equal(hitState.gameplay.resourceNodes["fallen-log-01"].cleared, false, "six hits do not clear a small log");
assert.equal(hitResourceNode(hitState, "fallen-log-01", { damage: 1, energyPerHit: 1, tuning: DEFAULT_GAMEPLAY_TUNING }).status, "cleared", "seventh hit clears a small log");
assert.equal(hitState.gameplay.wood, 1, "wood is awarded once on full clearing");
assert.equal(hitResourceNode(hitState, "fallen-log-01", { damage: 1, energyPerHit: 1, tuning: DEFAULT_GAMEPLAY_TUNING }).mutated, false, "cleared resource cannot be hit again");
const partialRoundTrip = deserializeSessionEnvelope(serializeSessionEnvelope(hitState));
assert.equal(partialRoundTrip.state.gameplay.resourceNodes["fallen-log-01"].cleared, true, "hit state persists through round-trip");
const lowHit = createFreshGameSessionState();
lowHit.gameplay.currentEnergy = 3;
const lowHitBefore = clone(lowHit);
assert.equal(hitResourceNode(lowHit, "fallen-log-01", { damage: 1, energyPerHit: 4, tuning: DEFAULT_GAMEPLAY_TUNING }).status, "insufficient-energy", "low energy blocks hit");
assert.deepEqual(clone(lowHit), lowHitBefore, "low-energy hit is atomic");
const energyState = createFreshGameSessionState();
drainAwakeEnergy(energyState, { amount: 1 });
assert.equal(energyState.gameplay.currentEnergy, 99, "awake drain spends one energy");
energyState.gameplay.currentEnergy = 0;
drainAwakeEnergy(energyState, { amount: 5 });
assert.equal(energyState.gameplay.currentEnergy, 0, "awake drain clamps at zero");
regenerateEnergy(energyState, { amount: 10 });
assert.equal(energyState.gameplay.currentEnergy, 10, "sleep regen restores ten energy");
regenerateEnergy(energyState, { amount: 0.5 });
assert.equal(deserializeSessionEnvelope(serializeSessionEnvelope(energyState)).state.gameplay.currentEnergy, 10.5, "fractional game-hour regeneration survives save round-trip");
regenerateEnergy(energyState, { amount: 1000 });
assert.equal(energyState.gameplay.currentEnergy, energyState.gameplay.maximumEnergy, "sleep regen clamps at maximum");
const beforeTime = energyState.gameplay.worldTimeSeconds;
advanceGameTime(energyState, 1, DEFAULT_GAMEPLAY_TUNING.sleepTimeScale);
assert.equal(energyState.gameplay.worldTimeSeconds - beforeTime, 1920, "sleep simulation scale advances world time at x32 with the 60x clock");
assert.equal(resolveActionHp(getResourceProfile("log-large"), "chop", DEFAULT_GAMEPLAY_TUNING), 11, "large HP is rounded from the 1.6 multiplier");
const rewardState = createFreshGameSessionState();
assert.equal(hitResourceNode(rewardState, "yard-log-04", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING }).reward.amount, 3, "large log awards +3 wood");
assert.equal(hitResourceNode(rewardState, "yard-stone-01", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING }).reward.amount, 3, "large stone awards +3 stone");
assert.equal(hitResourceNode(rewardState, "yard-stone-02", { damage: 99, energyPerHit: 0, tuning: DEFAULT_GAMEPLAY_TUNING }).reward.amount, 1, "small stone awards +1 stone");
assert.deepEqual({ wood: rewardState.gameplay.wood, stone: rewardState.gameplay.stone }, { wood: 3, stone: 4 }, "size rewards update canonical counters");

console.log("progress checks passed");

import { applyGameplayTuning, refillEnergy } from "../src/gameSessionState.js";
import { GAMEPLAY_DEBUG_STORAGE_KEY, loadGameplayDebugTuning, saveGameplayDebugTuning } from "../src/gameplayDebugTuning.js";
const tuningStorage = createMemoryStorage();
const normalizedTuning = loadGameplayDebugTuning({ enabled: true, storage: { getItem: () => JSON.stringify({ maximumEnergy: 12.4, clearingEnergyCost: -1, hitsPerLog: 9 }) } });
assert.equal(normalizedTuning.maximumEnergy, 12, "developer tuning normalizes maximum energy");
assert.equal(normalizedTuning.energyPerHit, 0, "developer tuning migrates clearing cost to energy per hit");
assert.equal(normalizedTuning.smallLogChopHp, 9, "legacy debug HP migrates to the resource tuning field");
const tunedState = createFreshGameSessionState();
tunedState.gameplay.currentEnergy = 90;
applyGameplayTuning(tunedState, { maximumEnergy: 50 });
assert.equal(tunedState.gameplay.currentEnergy, 50, "maximum energy clamps current energy");
tunedState.gameplay.currentEnergy = 1;
refillEnergy(tunedState);
assert.equal(tunedState.gameplay.currentEnergy, 50, "refill restores current energy to maximum");
saveGameplayDebugTuning({ maximumEnergy: 77, energyPerHit: 6, smallLogChopHp: 8 }, tuningStorage);
assert(tuningStorage.getItem(GAMEPLAY_DEBUG_STORAGE_KEY).includes("maximumEnergy"), "debug tuning persists to separate key");
assert.equal(tuningStorage.getItem(DEFAULT_STORAGE_KEY), null, "debug tuning does not write gameplay save key");
assert.deepEqual(loadGameplayDebugTuning({ enabled: true, storage: { getItem: () => { throw new Error("blocked"); } } }), DEFAULT_GAMEPLAY_TUNING, "blocked debug localStorage falls back safely");
