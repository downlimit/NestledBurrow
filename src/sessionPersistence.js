import { createFreshGameSessionState, normalizeGameSessionState, SESSION_STATE_VERSION } from "./gameSessionState.js";

export const SAVE_SCHEMA_VERSION = 1;
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
  [SAVE_SCHEMA_VERSION, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
]);

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
