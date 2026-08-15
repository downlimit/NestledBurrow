import { createFreshGameSessionState, normalizeGameSessionState, SESSION_STATE_VERSION } from "./gameSessionState.js";
import {
  addInventoryItem,
  addInventoryItemUpTo,
  createEmptyCombatLoadout,
  createInventoryItem,
  createInventoryFromLegacyCounters,
  createWorldItemId,
  inventoryStackLimit,
} from "../inventory/inventoryDomain.js";
import { DOOR_LEFT, DOOR_Y, TILE_SIZE } from "../world/worldConfig.js";
import { STARTER_WELL, WATER_BUCKET_CAPACITY } from "../resources/farmingConfig.js";
import { DEFAULT_SERVING_TABLE_ID } from "../tavern/cookingDomain.js";
import { createStage1Population, normalizePopulation } from "../character/populationDomain.js";
import { createDefaultVenueOffer, normalizeVenueOffer } from "../tavern/venueOfferDomain.js";

export const SAVE_SCHEMA_VERSION = 16;
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
  if (envelope.schemaVersion === 6) envelope = migrateV6Envelope(envelope);
  if (envelope.schemaVersion === 7) envelope = migrateV7Envelope(envelope);
  if (envelope.schemaVersion === 8) envelope = migrateV8Envelope(envelope);
  if (envelope.schemaVersion === 9) envelope = migrateV9Envelope(envelope);
  if (envelope.schemaVersion === 10) envelope = migrateV10Envelope(envelope);
  if (envelope.schemaVersion === 11) envelope = migrateV11Envelope(envelope);
  if (envelope.schemaVersion === 12) envelope = migrateV12Envelope(envelope);
  if (envelope.schemaVersion === 13) envelope = migrateV13Envelope(envelope);
  if (envelope.schemaVersion === 14) envelope = migrateV14Envelope(envelope);
  if (envelope.schemaVersion === 15) envelope = migrateV15Envelope(envelope);
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
  [6, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [7, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [8, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [9, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [10, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [11, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [12, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [13, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [14, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
  [15, (envelope, options) => deserializeSessionEnvelope(JSON.stringify(envelope), options)],
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
  gameplay.kitchen = { rawPotatoes: 5, preparedPotatoes: 0, cookedDishes: 0, servingTableHasDish: false };
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
  state.version = 6;
  return { schemaVersion: 6, state };
}

function migrateV6Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.inventory = createInventoryFromLegacyCounters({
    wood: gameplay.wood ?? 0,
    stone: gameplay.stone ?? 0,
    rubies: gameplay.rubies ?? 0,
  });
  gameplay.worldItems = [];
  delete gameplay.wood;
  delete gameplay.stone;
  delete gameplay.rubies;
  state.gameplay = gameplay;
  state.version = 7;
  return { schemaVersion: 7, state };
}

function migrateV7Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.farm = {
    soilCells: [],
    wateringCan: { capacity: 40, currentWater: 40 },
    wells: [],
    lastProcessedWorldTimeSeconds: Number(gameplay.worldTimeSeconds) || 0,
  };
  state.gameplay = gameplay;
  state.flags ??= {};
  for (const key of Object.keys(state.flags)) {
    if (key.startsWith("neighborQuest.")) delete state.flags[key];
  }
  state.entities ??= {};
  delete state.entities["home-npc"];
  delete state.entities["street-npc"];
  state.entities["seed-merchant"] = { id: "seed-merchant", flags: {} };
  delete state.dialogue;
  state.version = 8;
  return { schemaVersion: 8, state };
}

function migrateV8Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const kitchen = gameplay.kitchen ?? {};
  let remaining = Number.isSafeInteger(kitchen.rawPotatoes) && kitchen.rawPotatoes > 0
    ? kitchen.rawPotatoes
    : 0;
  delete kitchen.rawPotatoes;
  gameplay.kitchen = kitchen;
  gameplay.worldItems ??= [];
  if (remaining > 0 && gameplay.inventory?.slots) {
    const stackLimit = inventoryStackLimit("potato");
    const capacity = gameplay.inventory.slots.reduce((total, slot) => {
      if (slot === null) return total + stackLimit;
      if (slot?.id === "potato") return total + Math.max(0, stackLimit - slot.quantity);
      return total;
    }, 0);
    const inventoryQuantity = Math.min(remaining, capacity);
    if (inventoryQuantity > 0) {
      addInventoryItem(gameplay.inventory, { id: "potato", kind: "loot", quantity: inventoryQuantity });
      remaining -= inventoryQuantity;
    }
  }
  while (remaining > 0) {
    const quantity = Math.min(remaining, inventoryStackLimit("potato"));
    gameplay.worldItems.push({
      id: createWorldItemId(gameplay.worldItems),
      item: { id: "potato", kind: "loot", quantity },
      x: (DOOR_LEFT + 1.5) * TILE_SIZE,
      y: (DOOR_Y - 3) * TILE_SIZE,
    });
    remaining -= quantity;
  }
  state.gameplay = gameplay;
  state.version = 9;
  return { schemaVersion: 9, state };
}

function migrateV9Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.inventory ??= createInventoryFromLegacyCounters();
  gameplay.worldItems ??= [];
  migrateLegacyTools(gameplay);

  const farm = gameplay.farm ?? {};
  const legacyWater = Number.isSafeInteger(farm.wateringCan?.currentWater)
    ? farm.wateringCan.currentWater
    : 0;
  farm.waterBucket = {
    capacity: WATER_BUCKET_CAPACITY,
    currentWater: Math.min(WATER_BUCKET_CAPACITY, Math.max(0, legacyWater)),
  };
  delete farm.wateringCan;
  farm.wells = Array.isArray(farm.wells) ? farm.wells : [];
  const starterWellIndex = farm.wells.findIndex((well) => well?.id === STARTER_WELL.id);
  if (starterWellIndex >= 0) farm.wells[starterWellIndex] = { ...STARTER_WELL };
  else farm.wells.unshift({ ...STARTER_WELL });
  gameplay.farm = farm;

  const legacyKitchen = gameplay.kitchen ?? {};
  const preparedPotatoes = safeLegacyQuantity(legacyKitchen.preparedPotatoes);
  const cookedDishes = safeLegacyQuantity(legacyKitchen.cookedDishes);
  const servingTableHasDish = Boolean(legacyKitchen.servingTableHasDish);
  gameplay.kitchen = {
    starterLemons: 6,
    stoveRepaired: false,
    servingTable: {
      itemId: servingTableHasDish ? "fried-potato-dish" : null,
      quantity: servingTableHasDish ? 1 : 0,
      reservations: [],
    },
  };
  migrateLegacyQuantity(gameplay, "sliced-potato", preparedPotatoes);
  migrateLegacyQuantity(gameplay, "fried-potato-dish", cookedDishes);
  gameplay.tavernService = { nextGuestId: 0, spawnRemainingMs: 3_000, guests: [] };
  state.flags ??= {};
  state.flags["migration.task049WarningPending"] = true;
  state.gameplay = gameplay;
  state.version = 10;
  return { schemaVersion: 10, state };
}

function migrateV10Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.combatLoadout = createEmptyCombatLoadout();
  state.gameplay = gameplay;
  state.version = 11;
  return { schemaVersion: 11, state };
}

function migrateV11Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const kitchen = gameplay.kitchen ?? {};
  const legacyStock = isPlainObject(kitchen.servingTable) ? kitchen.servingTable : {};
  const itemId = legacyStock.itemId === "lemonade" || legacyStock.itemId === "fried-potato-dish"
    ? legacyStock.itemId
    : null;
  const legacyQuantity = itemId ? safeLegacyQuantity(legacyStock.quantity) : 0;
  const keptQuantity = Math.min(1, legacyQuantity);
  const keptReservations = Array.isArray(legacyStock.reservations)
    ? legacyStock.reservations.filter((reservation) => reservation?.itemId === itemId).slice(0, keptQuantity)
    : [];
  kitchen.servingTables = {
    [DEFAULT_SERVING_TABLE_ID]: {
      itemId: keptQuantity ? itemId : null,
      quantity: keptQuantity,
      reservations: keptReservations,
    },
  };
  delete kitchen.servingTable;
  gameplay.kitchen = kitchen;
  const overflow = legacyQuantity - keptQuantity;
  if (overflow > 0) {
    gameplay.inventory ??= createInventoryFromLegacyCounters();
    gameplay.worldItems ??= [];
    const returned = addInventoryItemUpTo(gameplay.inventory, createInventoryItem(itemId, overflow));
    const remaining = overflow - (returned.accepted ?? 0);
    if (remaining > 0) dropLegacyItem(gameplay, createInventoryItem(itemId, remaining));
  }
  const keptGuestIds = new Set(keptReservations.map((reservation) => String(reservation.guestId ?? "")));
  for (const guest of gameplay.tavernService?.guests ?? []) {
    guest.reservationActive = Boolean(guest.reservationActive && keptGuestIds.has(guest.id));
    guest.servingTableId = guest.reservationActive ? DEFAULT_SERVING_TABLE_ID : null;
    guest.diningTableId = null;
  }
  state.gameplay = gameplay;
  state.version = 12;
  return { schemaVersion: 12, state };
}

function migrateV12Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const worldTimeSeconds = Number.isFinite(Number(gameplay.worldTimeSeconds))
    ? Math.max(0, Number(gameplay.worldTimeSeconds))
    : 0;
  gameplay.population = Array.isArray(gameplay.population)
    ? normalizePopulation(gameplay.population, { worldTimeSeconds })
    : createStage1Population(worldTimeSeconds);
  state.gameplay = gameplay;
  state.version = 13;
  return { schemaVersion: 13, state };
}

function migrateV13Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  gameplay.venueOffer = gameplay.venueOffer === undefined
    ? createDefaultVenueOffer()
    : normalizeVenueOffer(gameplay.venueOffer);
  state.gameplay = gameplay;
  state.version = 14;
  return { schemaVersion: 14, state };
}

function migrateV14Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const worldTimeSeconds = Number.isFinite(Number(gameplay.worldTimeSeconds))
    ? Math.max(0, Number(gameplay.worldTimeSeconds))
    : 0;
  gameplay.population = normalizePopulation(gameplay.population, { worldTimeSeconds });
  gameplay.venueOffer = normalizeVenueOffer(gameplay.venueOffer);
  const service = isPlainObject(gameplay.tavernService) ? gameplay.tavernService : {};
  const usedPersonIds = new Set();
  const guests = Array.isArray(service.guests) ? service.guests.map((guest) => {
    const requestedPersonId = typeof guest?.personId === "string" ? guest.personId : null;
    const personId = gameplay.population.some((person) => person.id === requestedPersonId)
      && !usedPersonIds.has(requestedPersonId)
      ? requestedPersonId
      : gameplay.population.find((person) => !usedPersonIds.has(person.id))?.id ?? null;
    if (personId) usedPersonIds.add(personId);
    const acceptableItemIds = gameplay.venueOffer.foodItemIds.filter((itemId) => (
      !guest?.itemId || guest.itemId === itemId
    ));
    return {
      ...guest,
      personId,
      acceptableItemIds: acceptableItemIds.length > 0
        ? acceptableItemIds
        : [...gameplay.venueOffer.foodItemIds],
    };
  }) : [];
  gameplay.tavernService = {
    ...service,
    opportunityRemainingMs: Number.isFinite(service.opportunityRemainingMs)
      ? Math.max(0, service.opportunityRemainingMs)
      : Number.isFinite(service.spawnRemainingMs) ? Math.max(0, service.spawnRemainingMs) : 3_000,
    visitorHistoryByPersonId: isPlainObject(service.visitorHistoryByPersonId)
      ? service.visitorHistoryByPersonId
      : {},
    guests,
  };
  delete gameplay.tavernService.spawnRemainingMs;
  state.gameplay = gameplay;
  state.version = 15;
  return { schemaVersion: 15, state };
}

function migrateV15Envelope(envelope) {
  const state = cloneJsonSafe(envelope.state ?? {});
  const gameplay = state.gameplay ?? {};
  const service = isPlainObject(gameplay.tavernService) ? gameplay.tavernService : {};
  const offerItemIds = normalizeVenueOffer(gameplay.venueOffer).foodItemIds;
  service.guests = Array.isArray(service.guests) ? service.guests.map((guest) => {
    const requestedItems = [
      guest?.order?.itemId,
      guest?.itemId,
      ...(Array.isArray(guest?.acceptableItemIds) ? guest.acceptableItemIds : []),
      ...offerItemIds,
    ];
    const itemId = requestedItems.find((candidate) => ["fried-potato-dish", "lemonade"].includes(candidate))
      ?? "fried-potato-dish";
    const status = guest?.paid ? "completed"
      : ["carrying-to-seat", "eating"].includes(guest?.state) ? "served"
        : guest?.state === "leaving" && guest?.itemId ? "served"
          : guest?.reservationActive ? "reserved"
            : guest?.itemId ? "accepted" : "planned";
    return {
      ...guest,
      itemId,
      order: {
        itemId,
        status,
        statusElapsedMs: Number.isFinite(guest?.order?.statusElapsedMs)
          ? Math.max(0, guest.order.statusElapsedMs)
          : 0,
      },
    };
  }) : [];
  const history = isPlainObject(service.visitorHistoryByPersonId)
    ? service.visitorHistoryByPersonId
    : {};
  service.visitorHistoryByPersonId = Object.fromEntries(Object.entries(history).map(([personId, entry]) => [
    personId,
    {
      ...(isPlainObject(entry) ? entry : {}),
      failedAcceptedOrderCount: Number.isSafeInteger(entry?.failedAcceptedOrderCount)
        && entry.failedAcceptedOrderCount >= 0 ? entry.failedAcceptedOrderCount : 0,
      lastFailedAcceptedOrderWorldTimeSeconds: Number.isFinite(entry?.lastFailedAcceptedOrderWorldTimeSeconds)
        && entry.lastFailedAcceptedOrderWorldTimeSeconds >= 0
        ? entry.lastFailedAcceptedOrderWorldTimeSeconds
        : null,
    },
  ]));
  gameplay.tavernService = service;
  state.gameplay = gameplay;
  state.version = SESSION_STATE_VERSION;
  return { schemaVersion: SAVE_SCHEMA_VERSION, state };
}

function migrateLegacyTools(gameplay) {
  const slots = gameplay.inventory.slots ?? [];
  for (const slot of slots) {
    if (slot?.id === "watering-can") {
      slot.id = "water-bucket";
      slot.kind = "tool";
      slot.quantity = 1;
    }
  }
  const tools = ["axe", "pickaxe", "hoe", "water-bucket"];
  const seen = new Set();
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (!tools.includes(slot?.id)) continue;
    if (seen.has(slot.id)) {
      slots[index] = null;
      continue;
    }
    seen.add(slot.id);
    slot.kind = "tool";
    slot.quantity = 1;
  }
  for (const toolId of tools) {
    if (seen.has(toolId)) continue;
    let index = slots.findIndex((slot) => slot === null);
    if (index < 0) {
      index = slots.findLastIndex((slot) => slot?.kind !== "tool");
      if (index < 0) continue;
      dropLegacyItem(gameplay, slots[index]);
      slots[index] = null;
    }
    slots[index] = createInventoryItem(toolId);
    seen.add(toolId);
  }
}

function migrateLegacyQuantity(gameplay, itemId, quantity) {
  let remaining = quantity;
  while (remaining > 0) {
    const batch = Math.min(remaining, inventoryStackLimit(itemId));
    const result = addInventoryItemUpTo(gameplay.inventory, createInventoryItem(itemId, batch));
    remaining -= result.accepted ?? 0;
    if ((result.accepted ?? 0) === 0) {
      dropLegacyItem(gameplay, createInventoryItem(itemId, batch));
      remaining -= batch;
    }
  }
}

function dropLegacyItem(gameplay, item) {
  const index = gameplay.worldItems.length;
  const offsets = [
    [0, 0], [12, 0], [-12, 0], [0, 12], [0, -12], [12, 12], [-12, 12], [12, -12], [-12, -12],
  ];
  const [dx, dy] = offsets[index % offsets.length];
  gameplay.worldItems.push({
    id: createWorldItemId(gameplay.worldItems),
    item: { ...item },
    x: (DOOR_LEFT + 1.5) * TILE_SIZE + dx,
    y: (DOOR_Y - 3) * TILE_SIZE + dy,
  });
}

function safeLegacyQuantity(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
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
