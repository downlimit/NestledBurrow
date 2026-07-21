const SESSION_VERSION = 1;
const DEFAULT_WORLD_ID = "village";
const DEFAULT_PLAYER_ID = "player";

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

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record, key);
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

function createEntity(entityId) {
  assertNonEmptyString(entityId, "Entity ID");
  return { id: entityId, flags: {} };
}

export function createGameSessionState(options = {}) {
  const worldId = options.currentWorldId ?? options.worldId ?? DEFAULT_WORLD_ID;
  const playerId = options.playerId ?? DEFAULT_PLAYER_ID;
  assertNonEmptyString(worldId, "World ID");
  assertNonEmptyString(playerId, "Player ID");

  const state = {
    version: SESSION_VERSION,
    currentWorldId: worldId,
    playerId,
    entities: {},
    flags: {},
    dialogue: {
      targetId: null,
      dialogueId: null,
      lineIndex: 0,
    },
  };

  ensureSessionEntity(state, playerId);
  for (const entityId of options.initialEntityIds ?? options.entityIds ?? []) {
    ensureSessionEntity(state, entityId);
  }

  return state;
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
  if (!entity) {
    throw new Error(`Unknown session entity: ${entityId}`);
  }
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
  if (!getSessionEntity(state, targetId)) {
    throw new Error(`Unknown dialogue target entity: ${targetId}`);
  }
  state.dialogue.targetId = targetId;
  state.dialogue.dialogueId = dialogueId;
  state.dialogue.lineIndex = 0;
  return { status: "started", targetId, dialogueId, lineIndex: 0 };
}

export function advanceDialogue(state, lineCount) {
  if (!Number.isInteger(lineCount) || lineCount <= 0) {
    throw new Error("Dialogue line count must be a positive integer");
  }
  if (!isDialogueActive(state)) {
    return { status: "inactive", advanced: false, lineIndex: state.dialogue.lineIndex };
  }

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
