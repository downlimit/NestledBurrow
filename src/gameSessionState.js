import { DEBRIS_OBJECTS, DEFAULT_DEBRIS_MAX_HITS, DEFAULT_DEBRIS_ENERGY_PER_HIT } from "./debrisConfig.js";

export const SESSION_STATE_VERSION = 1;
export const DEFAULT_WORLD_ID = "village";
export const DEFAULT_PLAYER_ID = "player";
export const DEFAULT_ENTITY_IDS = Object.freeze(["home-npc", "street-npc"]);
export const DEFAULT_DEBRIS_ID = "fallen-log-01";
export const DEFAULT_MAXIMUM_ENERGY = 100;
export const DEFAULT_STARTING_ENERGY = 100;

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }
}

export function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function createDictionary() {
  return {};
}

function createSafeDictionary() {
  return Object.create(null);
}

function setOwn(record, key, value) {
  Object.defineProperty(record, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return value;
}

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function assertSafeId(value, label) {
  assertNonEmptyString(value, label);
  if (value === "__proto__" || value === "constructor" || value === "prototype") {
    throw new Error(`${label} is reserved: ${value}`);
  }
}

function createEntity(entityId) {
  assertNonEmptyString(entityId, "Entity ID");
  return { id: entityId, flags: createDictionary() };
}

function normalizeBooleanFlags(flags, label) {
  assertPlainRecord(flags, label);
  const normalized = createSafeDictionary();
  for (const [flagId, value] of Object.entries(flags)) {
    assertSafeId(flagId, `${label} flag ID`);
    assertBoolean(value, `${label}.${flagId}`);
    setOwn(normalized, flagId, value);
  }
  return normalized;
}

function normalizeEntities(entities) {
  assertPlainRecord(entities, "Session entities");
  const normalized = createSafeDictionary();
  for (const [entityId, entity] of Object.entries(entities)) {
    assertSafeId(entityId, "Entity ID");
    assertPlainRecord(entity, `Entity ${entityId}`);
    if (entity.id !== entityId) {
      throw new Error(`Entity ${entityId} must have matching id`);
    }
    setOwn(normalized, entityId, {
      id: entityId,
      flags: normalizeBooleanFlags(entity.flags ?? createDictionary(), `Entity ${entityId} flags`),
    });
  }
  return normalized;
}

function normalizeNonNegativeInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeGameplayState(value = {}) {
  assertPlainRecord(value, "Gameplay state");
  const maximumEnergy = normalizeNonNegativeInteger(value.maximumEnergy, DEFAULT_MAXIMUM_ENERGY, "Maximum energy");
  if (maximumEnergy <= 0) throw new Error("Maximum energy must be greater than 0");
  const currentEnergy = Math.min(maximumEnergy, normalizeNonNegativeInteger(value.currentEnergy, DEFAULT_STARTING_ENERGY, "Current energy"));
  const wood = normalizeNonNegativeInteger(value.wood, 0, "Wood");
  const elapsedGameSeconds = normalizeNonNegativeNumber(value.elapsedGameSeconds, 0, "Elapsed game seconds");
  const debrisInput = value.debris ?? {};
  assertPlainRecord(debrisInput, "Debris state");
  const debris = createDictionary();
  for (const definition of DEBRIS_OBJECTS) {
    const debrisState = hasOwn(debrisInput, definition.id) ? debrisInput[definition.id] : {};
    if (debrisState !== undefined) assertPlainRecord(debrisState, `Debris ${definition.id}`);
    const legacyCleared = Boolean(debrisState?.cleared);
    const remainingHits = legacyCleared ? 0 : normalizePositiveHitCount(debrisState?.remainingHits, DEFAULT_DEBRIS_MAX_HITS, `Debris ${definition.id}.remainingHits`);
    setOwn(debris, definition.id, { cleared: remainingHits <= 0, remainingHits });
  }
  for (const [debrisId, debrisState] of Object.entries(debrisInput)) {
    assertSafeId(debrisId, "Debris ID");
    if (hasOwn(debris, debrisId)) continue;
    assertPlainRecord(debrisState, `Debris ${debrisId}`);
    const cleared = Boolean(debrisState.cleared);
    const remainingHits = cleared ? 0 : normalizePositiveHitCount(debrisState.remainingHits, DEFAULT_DEBRIS_MAX_HITS, `Debris ${debrisId}.remainingHits`);
    setOwn(debris, debrisId, { cleared, remainingHits });
  }
  return { currentEnergy, maximumEnergy, wood, debris, elapsedGameSeconds };
}

function normalizeNonNegativeNumber(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
  return value;
}

function normalizePositiveHitCount(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return Math.min(DEFAULT_DEBRIS_MAX_HITS, value);
}

function createDialogueState(value = {}) {
  const targetId = value.targetId ?? null;
  const dialogueId = value.dialogueId ?? null;
  const lineIndex = value.lineIndex ?? 0;
  if (targetId !== null) assertNonEmptyString(targetId, "Dialogue target ID");
  if (dialogueId !== null) assertNonEmptyString(dialogueId, "Dialogue ID");
  if (!Number.isInteger(lineIndex) || lineIndex < 0) {
    throw new Error("Dialogue line index must be a non-negative integer");
  }
  return { targetId, dialogueId, lineIndex };
}

export function createFreshGameSessionState(options = {}) {
  const worldId = options.currentWorldId ?? options.worldId ?? DEFAULT_WORLD_ID;
  const playerId = options.playerId ?? DEFAULT_PLAYER_ID;
  assertNonEmptyString(worldId, "World ID");
  assertNonEmptyString(playerId, "Player ID");

  const state = {
    version: SESSION_STATE_VERSION,
    currentWorldId: worldId,
    playerId,
    entities: createDictionary(),
    flags: createDictionary(),
    dialogue: createDialogueState(),
    gameplay: normalizeGameplayState(),
  };

  ensureSessionEntity(state, playerId);
  for (const entityId of options.initialEntityIds ?? options.entityIds ?? DEFAULT_ENTITY_IDS) {
    ensureSessionEntity(state, entityId);
  }
  return state;
}

export function createGameSessionState(options = {}) {
  return createFreshGameSessionState({ ...options, initialEntityIds: options.initialEntityIds ?? options.entityIds ?? [] });
}

export function normalizeGameSessionState(value, options = {}) {
  assertPlainRecord(value, "Session state");
  if (value.version !== SESSION_STATE_VERSION) {
    throw new Error(`Unsupported session state version: ${String(value.version)}`);
  }
  assertNonEmptyString(value.currentWorldId, "World ID");
  assertSafeId(value.playerId, "Player ID");

  const normalized = {
    version: SESSION_STATE_VERSION,
    currentWorldId: value.currentWorldId,
    playerId: value.playerId,
    entities: normalizeEntities(value.entities),
    flags: normalizeBooleanFlags(value.flags, "Session flags"),
    dialogue: options.includeDialogue === false ? createDialogueState() : createDialogueState(value.dialogue ?? {}),
    gameplay: normalizeGameplayState(value.gameplay ?? {}),
  };

  ensureSessionEntity(normalized, normalized.playerId);
  for (const entityId of options.requiredEntityIds ?? DEFAULT_ENTITY_IDS) {
    ensureSessionEntity(normalized, entityId);
  }
  return normalized;
}

export function ensureSessionEntity(state, entityId) {
  assertNonEmptyString(entityId, "Entity ID");
  if (!hasOwn(state.entities, entityId)) {
    setOwn(state.entities, entityId, createEntity(entityId));
  }
  return state.entities[entityId];
}

export function getSessionEntity(state, entityId) {
  assertNonEmptyString(entityId, "Entity ID");
  return hasOwn(state.entities, entityId) ? state.entities[entityId] : null;
}

export function setSessionFlag(state, flagId, value) {
  assertNonEmptyString(flagId, "Flag ID");
  assertBoolean(value, "Session flag value");
  return setOwn(state.flags, flagId, value);
}

export function getSessionFlag(state, flagId) {
  assertNonEmptyString(flagId, "Flag ID");
  return hasOwn(state.flags, flagId) ? state.flags[flagId] : false;
}

export function setEntityFlag(state, entityId, flagId, value) {
  assertNonEmptyString(flagId, "Flag ID");
  assertBoolean(value, "Entity flag value");
  const entity = getSessionEntity(state, entityId);
  if (!entity) throw new Error(`Unknown session entity: ${entityId}`);
  return setOwn(entity.flags, flagId, value);
}

export function getEntityFlag(state, entityId, flagId) {
  assertNonEmptyString(flagId, "Flag ID");
  const entity = getSessionEntity(state, entityId);
  return entity && hasOwn(entity.flags, flagId) ? entity.flags[flagId] : false;
}

export function isDialogueActive(state) {
  return state.dialogue.targetId !== null && state.dialogue.dialogueId !== null;
}

export function startDialogue(state, { targetId, dialogueId }) {
  assertNonEmptyString(targetId, "Dialogue target ID");
  assertNonEmptyString(dialogueId, "Dialogue ID");
  if (!getSessionEntity(state, targetId)) throw new Error(`Unknown dialogue target entity: ${targetId}`);
  state.dialogue.targetId = targetId;
  state.dialogue.dialogueId = dialogueId;
  state.dialogue.lineIndex = 0;
  return { status: "started", targetId, dialogueId, lineIndex: 0 };
}

export function advanceDialogue(state, lineCount) {
  if (!Number.isInteger(lineCount) || lineCount <= 0) throw new Error("Dialogue line count must be a positive integer");
  if (!isDialogueActive(state)) return { status: "inactive", advanced: false, lineIndex: state.dialogue.lineIndex };
  const nextLineIndex = state.dialogue.lineIndex + 1;
  if (nextLineIndex < lineCount) {
    state.dialogue.lineIndex = nextLineIndex;
    return { status: "advanced", advanced: true, lineIndex: nextLineIndex };
  }
  closeDialogue(state);
  return { status: "closed", advanced: false, lineIndex: 0 };
}

export function closeDialogue(state) {
  state.dialogue.targetId = null;
  state.dialogue.dialogueId = null;
  state.dialogue.lineIndex = 0;
  return { status: "closed", lineIndex: 0 };
}


export function applyGameplayTuning(state, tuning) {
  const normalized = normalizeGameplayState({
    ...state.gameplay,
    maximumEnergy: tuning.maximumEnergy,
  });
  state.gameplay.maximumEnergy = normalized.maximumEnergy;
  state.gameplay.currentEnergy = Math.min(state.gameplay.currentEnergy, normalized.maximumEnergy);
  return { status: "updated", gameplay: state.gameplay };
}

export function refillEnergy(state) {
  state.gameplay.currentEnergy = state.gameplay.maximumEnergy;
  return { status: "updated", currentEnergy: state.gameplay.currentEnergy };
}

export function hitDebris(state, debrisId, { energyPerHit = DEFAULT_DEBRIS_ENERGY_PER_HIT, woodReward = 1, maxHits = DEFAULT_DEBRIS_MAX_HITS } = {}) {
  assertSafeId(debrisId, "Debris ID");
  if (!hasOwn(state.gameplay.debris, debrisId)) setOwn(state.gameplay.debris, debrisId, { cleared: false, remainingHits: maxHits });
  const debris = state.gameplay.debris[debrisId];
  if (debris.cleared || debris.remainingHits <= 0) return { status: "already-cleared", mutated: false };
  const cost = normalizeNonNegativeInteger(energyPerHit, 0, "Debris hit energy cost");
  const reward = normalizeNonNegativeInteger(woodReward, 0, "Wood reward");
  if (state.gameplay.currentEnergy < cost) return { status: "insufficient-energy", mutated: false };
  state.gameplay.currentEnergy -= cost;
  debris.remainingHits = Math.max(0, debris.remainingHits - 1);
  if (debris.remainingHits === 0) {
    debris.cleared = true;
    state.gameplay.wood += reward;
    return { status: "cleared", mutated: true, currentEnergy: state.gameplay.currentEnergy, wood: state.gameplay.wood, remainingHits: 0 };
  }
  return { status: "hit", mutated: true, currentEnergy: state.gameplay.currentEnergy, wood: state.gameplay.wood, remainingHits: debris.remainingHits };
}

export function clearDebris(state, debrisId, options = {}) {
  assertSafeId(debrisId, "Debris ID");
  if (!hasOwn(state.gameplay.debris, debrisId)) setOwn(state.gameplay.debris, debrisId, { cleared: false, remainingHits: DEFAULT_DEBRIS_MAX_HITS });
  const debris = state.gameplay.debris[debrisId];
  if (debris.cleared) return { status: "already-cleared", mutated: false };
  const cost = normalizeNonNegativeInteger(options.energyCost, 0, "Clearing energy cost");
  const reward = normalizeNonNegativeInteger(options.woodReward, 0, "Wood reward");
  if (state.gameplay.currentEnergy < cost) return { status: "insufficient-energy", mutated: false };
  state.gameplay.currentEnergy -= cost;
  state.gameplay.wood += reward;
  debris.remainingHits = 0;
  debris.cleared = true;
  return { status: "cleared", mutated: true, currentEnergy: state.gameplay.currentEnergy, wood: state.gameplay.wood, remainingHits: 0 };
}

export function drainAwakeEnergy(state, { amount }) {
  const drain = normalizeNonNegativeInteger(amount, 0, "Awake energy drain");
  const before = state.gameplay.currentEnergy;
  state.gameplay.currentEnergy = Math.max(0, before - drain);
  return { status: before === state.gameplay.currentEnergy ? "unchanged" : "updated", currentEnergy: state.gameplay.currentEnergy };
}

export function regenerateEnergy(state, { amount }) {
  const regen = normalizeNonNegativeNumber(amount, 0, "Sleep energy regeneration");
  const before = state.gameplay.currentEnergy;
  state.gameplay.currentEnergy = Math.min(state.gameplay.maximumEnergy, before + regen);
  if (Number.isInteger(state.gameplay.currentEnergy)) state.gameplay.currentEnergy = Math.round(state.gameplay.currentEnergy);
  return { status: before === state.gameplay.currentEnergy ? "unchanged" : "updated", currentEnergy: state.gameplay.currentEnergy };
}

export function advanceGameTime(state, realDeltaSeconds, timeScale = 1) {
  const delta = normalizeNonNegativeNumber(realDeltaSeconds, 0, "Real delta seconds");
  const scale = normalizeNonNegativeNumber(timeScale, 1, "Time scale");
  state.gameplay.elapsedGameSeconds += delta * scale;
  return { elapsedGameSeconds: state.gameplay.elapsedGameSeconds, timeScale: scale };
}
