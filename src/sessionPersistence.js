import { createFreshGameSessionState, normalizeGameSessionState, SESSION_STATE_VERSION } from "./gameSessionState.js";

export const SAVE_SCHEMA_VERSION = 6;
export const DEFAULT_STORAGE_KEY = "nestledburrow.save.v1";

function createDiagnostic(kind, error) {
  return { kind, message: error instanceof Error ? error.message : String(error) };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

export function serializeSessionEnvelope(sessionState) {
  const normalized = normalizeGameSessionState(sessionState, { includeDialogue: false });
  const state = cloneJsonSafe(normalized);
  delete state.dialogue;
  return JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, state });
}

export function deserializeSessionEnvelope(rawValue, { createFreshState = createFreshGameSessionState } = {}) {
  let envelope;
  try {
    envelope = JSON.parse(rawValue);
  } catch (error) {
    return { status: "recovered", state: createFreshState(), diagnostic: createDiagnostic("invalid-json", error) };
  }

  if (!isPlainObject(envelope)) {
    return { status: "recovered", state: createFreshState(), diagnostic: { kind: "invalid-envelope", message: "Save envelope must be an object" } };
  }
  if (envelope.schemaVersion === 1) envelope = migrateV1Envelope(envelope);
  if (envelope.schemaVersion === 2) envelope = migrateV2Envelope(envelope);
  if (envelope.schemaVersion === 3) envelope = migrateV3Envelope(envelope);
  if (envelope.schemaVersion === 4) envelope = migrateV4Envelope(envelope);
  if (envelope.schemaVersion === 5) envelope = migrateV5Envelope(envelope);
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) {
    return { status: "unsupported", schemaVersion: envelope.schemaVersion, diagnostic: { kind: "unsupported-schema", message: `Unsupported save schema version: ${String(envelope.schemaVersion)}` } };
  }

  try {
    const state = normalizeGameSessionState(envelope.state, { includeDialogue: false });
    return { status: "loaded", state, schemaVersion: SAVE_SCHEMA_VERSION };
  } catch (error) {
    return { status: "recovered", state: createFreshState(), diagnostic: createDiagnostic("invalid-state", error) };
  }
}

const migrationRegistry = new Map([
  [1, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [2, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [3, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [4, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [5, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [SAVE_SCHEMA_VERSION, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
]);

function migrateV1Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const resourceNodes = {};
  for (const [id, node] of Object.entries(gameplay.debris ?? {})) {
    const remaining = Number.isInteger(node?.remainingHits) ? Math.min(5, Math.max(0, node.remainingHits)) : 5;
    resourceNodes[id] = { progress: node?.cleared ? 1 : (5 - remaining) / 5, cleared: Boolean(node?.cleared) || remaining === 0 };
  }
  for (const [id, node] of Object.entries(gameplay.rubyNodes ?? {})) {
    const remaining = Number.isInteger(node?.remainingHits) ? Math.min(5, Math.max(0, node.remainingHits)) : 5;
    resourceNodes[id] = { progress: node?.cleared ? 1 : (5 - remaining) / 5, cleared: Boolean(node?.cleared) || remaining === 0 };
  }
  delete gameplay.debris;
  delete gameplay.rubyNodes;
  gameplay.resourceNodes = resourceNodes;
  gameplay.stone = 0;
  state.gameplay = gameplay;
  state.version = 2;
  return { schemaVersion: 2, state };
}

function migrateV2Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.needs = { novelty: 100, satiety: 100, toilet: 100, lustre: 100, dialogue: 100 };
  state.gameplay = gameplay;
  state.version = 3;
  return { schemaVersion: 3, state };
}

function migrateV3Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.kitchen = {
    rawPotatoes: 5,
    preparedPotatoes: 0,
    cookedDishes: 0,
    servingTableHasDish: false,
  };
  state.gameplay = gameplay;
  state.version = 4;
  return { schemaVersion: 4, state };
}

function migrateV4Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.tavernOpen = false;
  state.gameplay = gameplay;
  state.version = 5;
  return { schemaVersion: 5, state };
}

function migrateV5Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.coins = 0;
  state.gameplay = gameplay;
  state.version = SESSION_STATE_VERSION;
  return { schemaVersion: SAVE_SCHEMA_VERSION, state };
}

export function migrateSessionEnvelope(envelope, options = {}) {
  if (!isPlainObject(envelope)) return { status: "unsupported", diagnostic: { kind: "invalid-envelope", message: "Save envelope must be an object" } };
  const migrate = migrationRegistry.get(envelope.schemaVersion);
  if (!migrate) {
    return { status: "unsupported", schemaVersion: envelope.schemaVersion, diagnostic: { kind: "unsupported-schema", message: `Unsupported save schema version: ${String(envelope.schemaVersion)}` } };
  }
  return migrate(envelope, options);
}

export function createSessionPersistence({ storage, storageKey = DEFAULT_STORAGE_KEY, createFreshState = createFreshGameSessionState } = {}) {
  if (!storage) throw new Error("Session persistence requires a Storage-compatible adapter");

  return {
    load() {
      let rawValue;
      try {
        rawValue = storage.getItem(storageKey);
      } catch (error) {
        return { status: "recovered", state: createFreshState(), diagnostic: createDiagnostic("storage-read", error) };
      }
      if (rawValue === null) return { status: "empty", state: createFreshState() };
      return deserializeSessionEnvelope(rawValue, { createFreshState });
    },

    save(sessionState) {
      let serialized;
      try {
        serialized = serializeSessionEnvelope(sessionState);
      } catch (error) {
        return { status: "error", diagnostic: createDiagnostic("validation", error) };
      }
      try {
        storage.setItem(storageKey, serialized);
        return { status: "saved", schemaVersion: SAVE_SCHEMA_VERSION, stateVersion: SESSION_STATE_VERSION };
      } catch (error) {
        return { status: "error", diagnostic: createDiagnostic("storage-write", error) };
      }
    },

    clear() {
      try {
        storage.removeItem(storageKey);
        return { status: "cleared" };
      } catch (error) {
        return { status: "error", diagnostic: createDiagnostic("storage-clear", error) };
      }
    },
  };
}
