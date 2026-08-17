import { RESOURCE_OBJECTS } from "../resources/resourceConfig.js";
import { applyResourceWork, getResourceProfile } from "../resources/resourceDomain.js";
import { DEFAULT_START_TIME_SECONDS, LEGACY_ELAPSED_GAME_SECONDS_MULTIPLIER, advanceWorldTimeSeconds } from "./gameClock.js";
import { DEFAULT_NEEDS, normalizeNeeds } from "../needs/needsDomain.js";
import { normalizePopulation } from "../character/populationDomain.js";
import { normalizeKitchenState } from "../tavern/cookingDomain.js";
import { createFreshFarmState, normalizeFarmState } from "../resources/farmingDomain.js";
import { normalizeTavernServiceState } from "../tavern/tavernServiceDomain.js";
import { normalizeTavernFeedbackState } from "../tavern/tavernFeedbackDomain.js";
import { normalizeVenueOffer } from "../tavern/venueOfferDomain.js";
import {
  addInventoryItem,
  canAddInventoryItem,
  createEmptyCombatLoadout,
  createInventoryFromLegacyCounters,
  createInventoryItem,
  createNewGameInventory,
  getInventoryQuantity,
  normalizeInventory,
  normalizeCombatLoadout,
  normalizeWorldItems,
  resetInventory,
} from "../inventory/inventoryDomain.js";

export const SESSION_STATE_VERSION = 18;
export const DEFAULT_WORLD_ID = "village";
export const DEFAULT_PLAYER_ID = "player";
export const DEFAULT_ENTITY_IDS = Object.freeze(["seed-merchant"]);
export const DEFAULT_DEBRIS_ID = "fallen-log-01";
export const DEFAULT_MAXIMUM_ENERGY = 100;
export const DEFAULT_STARTING_ENERGY = 100;

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
}

function assertBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
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
  Object.defineProperty(record, key, { value, enumerable: true, configurable: true, writable: true });
  return value;
}

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object`);
}

function assertSafeId(value, label) {
  assertNonEmptyString(value, label);
  if (value === "__proto__" || value === "constructor" || value === "prototype") throw new Error(`${label} is reserved: ${value}`);
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
    if (entity.id !== entityId) throw new Error(`Entity ${entityId} must have matching id`);
    setOwn(normalized, entityId, { id: entityId, flags: normalizeBooleanFlags(entity.flags ?? createDictionary(), `Entity ${entityId} flags`) });
  }
  return normalized;
}

function normalizeNonNegativeInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`);
  return value;
}

function normalizeBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function normalizeNonNegativeNumber(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a non-negative finite number`);
  return value;
}

function normalizeProgress(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be in 0..1`);
  return value;
}

function resourceItemId(resource) {
  return resource === "rubies" ? "ruby" : resource;
}

function attachLegacyResourceGetters(gameplay) {
  Object.defineProperties(gameplay, {
    wood: { enumerable: false, configurable: true, get: () => getInventoryQuantity(gameplay.inventory, "wood") },
    stone: { enumerable: false, configurable: true, get: () => getInventoryQuantity(gameplay.inventory, "stone") },
    rubies: { enumerable: false, configurable: true, get: () => getInventoryQuantity(gameplay.inventory, "ruby") },
  });
  return gameplay;
}

function normalizeGameplayState(value = {}) {
  assertPlainRecord(value, "Gameplay state");
  const maximumEnergy = normalizeNonNegativeInteger(value.maximumEnergy, DEFAULT_MAXIMUM_ENERGY, "Maximum energy");
  if (maximumEnergy <= 0) throw new Error("Maximum energy must be greater than 0");
  const currentEnergy = Math.min(maximumEnergy, normalizeNonNegativeNumber(value.currentEnergy, DEFAULT_STARTING_ENERGY, "Current energy"));
  const elapsedGameSeconds = normalizeNonNegativeNumber(value.elapsedGameSeconds, 0, "Elapsed game seconds");
  const worldTimeSeconds = normalizeNonNegativeNumber(value.worldTimeSeconds, DEFAULT_START_TIME_SECONDS + elapsedGameSeconds * LEGACY_ELAPSED_GAME_SECONDS_MULTIPLIER, "World time seconds");
  const nodeInput = value.resourceNodes ?? {};
  assertPlainRecord(nodeInput, "Resource node state");
  const resourceNodes = createDictionary();
  for (const definition of RESOURCE_OBJECTS) {
    const input = hasOwn(nodeInput, definition.id) ? nodeInput[definition.id] : {};
    assertPlainRecord(input, `Resource ${definition.id}`);
    const progress = normalizeProgress(input.progress, Boolean(input.cleared) ? 1 : 0, `Resource ${definition.id}.progress`);
    setOwn(resourceNodes, definition.id, { cleared: progress >= 1, progress });
  }
  for (const [resourceId, input] of Object.entries(nodeInput)) {
    assertSafeId(resourceId, "Resource ID");
    if (hasOwn(resourceNodes, resourceId)) continue;
    assertPlainRecord(input, `Resource ${resourceId}`);
    const progress = normalizeProgress(input.progress, Boolean(input.cleared) ? 1 : 0, `Resource ${resourceId}.progress`);
    setOwn(resourceNodes, resourceId, { cleared: progress >= 1, progress });
  }
  const inventory = value.inventory
    ? normalizeInventory(value.inventory)
    : createInventoryFromLegacyCounters({ wood: value.wood ?? 0, stone: value.stone ?? 0, rubies: value.rubies ?? 0 });
  const combatLoadout = normalizeCombatLoadout(value.combatLoadout ?? createEmptyCombatLoadout(), {
    reservedToolIds: inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id),
  });
  const kitchen = normalizeKitchenState(value.kitchen ?? {});
  const population = normalizePopulation(value.population, { worldTimeSeconds });
  const tavernService = normalizeTavernServiceState(value.tavernService ?? {}, { population });
  const tavernFeedback = normalizeTavernFeedbackState(value.tavernFeedback ?? {}, { population, worldTimeSeconds });
  const resumableReservations = new Map(tavernService.guests
    .filter((guest) => guest.reservationActive)
    .map((guest) => [guest.id, guest.servingTableId]));
  for (const [servingTableId, stock] of Object.entries(kitchen.servingTables)) {
    stock.reservations = stock.reservations.filter((reservation) => (
      resumableReservations.get(reservation.guestId) === servingTableId
    ));
  }
  return attachLegacyResourceGetters({
    currentEnergy,
    maximumEnergy,
    inventory,
    combatLoadout,
    worldItems: normalizeWorldItems(value.worldItems ?? []),
    resourceNodes,
    worldTimeSeconds,
    farm: normalizeFarmState(value.farm ?? createFreshFarmState(worldTimeSeconds), worldTimeSeconds),
    needs: normalizeNeeds(value.needs ?? DEFAULT_NEEDS),
    population,
    kitchen,
    tavernService,
    tavernFeedback,
    venueOffer: normalizeVenueOffer(value.venueOffer),
    tavernOpen: normalizeBoolean(value.tavernOpen, false, "Tavern open"),
    coins: normalizeNonNegativeInteger(value.coins, 3, "Coins"),
  });
}

function createDialogueState(value = {}) {
  const targetId = value.targetId ?? null;
  const dialogueId = value.dialogueId ?? null;
  const lineIndex = value.lineIndex ?? 0;
  if (targetId !== null) assertNonEmptyString(targetId, "Dialogue target ID");
  if (dialogueId !== null) assertNonEmptyString(dialogueId, "Dialogue ID");
  if (!Number.isInteger(lineIndex) || lineIndex < 0) throw new Error("Dialogue line index must be a non-negative integer");
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
    gameplay: normalizeGameplayState({
      inventory: createNewGameInventory(),
      worldItems: options.initialWorldItems ?? [],
    }),
  };
  ensureSessionEntity(state, playerId);
  for (const entityId of options.initialEntityIds ?? options.entityIds ?? DEFAULT_ENTITY_IDS) ensureSessionEntity(state, entityId);
  return state;
}

export function createGameSessionState(options = {}) {
  return createFreshGameSessionState({ ...options, initialEntityIds: options.initialEntityIds ?? options.entityIds ?? [] });
}

export function normalizeGameSessionState(value, options = {}) {
  assertPlainRecord(value, "Session state");
  if (value.version !== SESSION_STATE_VERSION) throw new Error(`Unsupported session state version: ${String(value.version)}`);
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
  for (const entityId of options.requiredEntityIds ?? DEFAULT_ENTITY_IDS) ensureSessionEntity(normalized, entityId);
  return normalized;
}

export function ensureSessionEntity(state, entityId) {
  assertNonEmptyString(entityId, "Entity ID");
  if (!hasOwn(state.entities, entityId)) setOwn(state.entities, entityId, createEntity(entityId));
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
  assertNonEmptyString(flagId, "Session flag ID");
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
  const normalized = normalizeGameplayState({ ...state.gameplay, maximumEnergy: tuning.maximumEnergy });
  state.gameplay.maximumEnergy = normalized.maximumEnergy;
  state.gameplay.currentEnergy = Math.min(state.gameplay.currentEnergy, normalized.maximumEnergy);
  return { status: "updated", gameplay: state.gameplay };
}

export function refillEnergy(state) {
  state.gameplay.currentEnergy = state.gameplay.maximumEnergy;
  return { status: "updated", currentEnergy: state.gameplay.currentEnergy };
}

export function hitResourceNode(state, resourceId, { action, damage = 1, energyPerHit = 1, tuning = {} } = {}) {
  assertSafeId(resourceId, "Resource ID");
  const definition = RESOURCE_OBJECTS.find((item) => item.id === resourceId);
  if (!definition) return { status: "unknown-resource", mutated: false };
  return hitResourceDefinition(state, definition, { action, damage, energyPerHit, tuning });
}

export function hitResourceDefinition(state, definition, { action, damage = 1, energyPerHit = 1, tuning = {} } = {}) {
  assertSafeId(definition?.id, "Resource ID");
  const profile = getResourceProfile(definition.profileId);
  const node = state.gameplay.resourceNodes[definition.id];
  if (!node || node.cleared) return { status: "already-cleared", mutated: false };
  const cost = normalizeNonNegativeNumber(energyPerHit, 0, "Resource hit energy cost");
  if (state.gameplay.currentEnergy < cost) return { status: "insufficient-energy", mutated: false };
  const resolvedAction = action ?? profile.preferredAction;
  const preview = applyResourceWork({ ...node }, profile, { action: resolvedAction, damage, tuning });
  if (!preview.mutated) return preview;
  const rewardItem = preview.status === "cleared"
    ? createInventoryItem(resourceItemId(profile.reward.resource), profile.reward.amount)
    : null;
  if (rewardItem) {
    const availability = canAddInventoryItem(state.gameplay.inventory, rewardItem);
    if (!availability.canAdd) return { status: availability.status, mutated: false, reward: profile.reward, item: rewardItem };
  }
  const result = applyResourceWork(node, profile, { action: resolvedAction, damage, tuning });
  state.gameplay.currentEnergy -= cost;
  const inventoryResult = rewardItem ? addInventoryItem(state.gameplay.inventory, rewardItem) : null;
  return {
    ...result,
    currentEnergy: state.gameplay.currentEnergy,
    reward: result.status === "cleared" ? profile.reward : null,
    inventory: inventoryResult,
  };
}

export function resetBalanceRun(state) {
  state.gameplay.currentEnergy = state.gameplay.maximumEnergy;
  state.gameplay.worldTimeSeconds = DEFAULT_START_TIME_SECONDS;
  resetInventory(state.gameplay.inventory);
  state.gameplay.worldItems.splice(0, state.gameplay.worldItems.length);
  state.gameplay.farm = createFreshFarmState(DEFAULT_START_TIME_SECONDS);
  state.gameplay.needs = normalizeNeeds();
  for (const node of Object.values(state.gameplay.resourceNodes)) {
    node.cleared = false;
    node.progress = 0;
  }
  return { status: "reset", gameplay: state.gameplay };
}

export function drainAwakeEnergy(state, { amount }) {
  const drain = normalizeNonNegativeNumber(amount, 0, "Awake energy drain");
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
  state.gameplay.worldTimeSeconds = advanceWorldTimeSeconds(state.gameplay.worldTimeSeconds, delta, scale);
  return { worldTimeSeconds: state.gameplay.worldTimeSeconds, timeScale: scale };
}
