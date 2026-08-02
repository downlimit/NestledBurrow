export const INVENTORY_SLOT_COUNT = 10;
export const COMBAT_LOADOUT_SLOT_COUNT = 10;
export const LOADOUT_PANELS = Object.freeze({
  PEACEFUL: "peaceful",
  COMBAT: "combat",
});
export const COMBAT_ACTION_SLOT_INDEXES = Object.freeze({
  space: 0,
  lmb: 1,
  rmb: 2,
  shift: 3,
});
export const COMBAT_NUMBER_SLOT_INDEXES = Object.freeze([4, 5, 6, 7, 8, 9]);
export const COMBAT_ITEM_ACTION_PREFERENCES = Object.freeze({
  sword: "lmb",
  "battle-axe": "rmb",
  bow: "space",
  crossbow: "space",
  amulet: "shift",
  "blink-amulet": "shift",
});
export const INVENTORY_TOOL_IDS = Object.freeze(["axe", "pickaxe", "hoe", "water-bucket", "sword", "battle-axe"]);
export const INVENTORY_ITEM_IDS = Object.freeze([
  ...INVENTORY_TOOL_IDS,
  "wood", "stone", "ruby", "berry", "potato-seed", "potato", "lemon-seed", "lemon",
  "sliced-potato", "lemonade", "fried-potato-dish",
]);
export const INVENTORY_ITEM_KINDS = Object.freeze({
  axe: "tool",
  pickaxe: "tool",
  hoe: "tool",
  "water-bucket": "tool",
  sword: "tool",
  "battle-axe": "tool",
  wood: "loot",
  stone: "loot",
  ruby: "loot",
  berry: "loot",
  "potato-seed": "loot",
  potato: "loot",
  "lemon-seed": "loot",
  lemon: "loot",
  "sliced-potato": "loot",
  lemonade: "loot",
  "fried-potato-dish": "loot",
});
export const INVENTORY_STACK_LIMITS = Object.freeze({
  berry: 99,
  "potato-seed": 99,
  potato: 99,
  "lemon-seed": 99,
  lemon: 99,
  "sliced-potato": 99,
  lemonade: 99,
  "fried-potato-dish": 99,
});

const RESERVED_IDS = new Set(["__proto__", "constructor", "prototype"]);

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function normalizeItemId(value, label = "Inventory item ID") {
  if (typeof value !== "string" || value.trim() === "" || RESERVED_IDS.has(value)) {
    throw new Error(`${label} must be a safe non-empty string`);
  }
  return value;
}

function itemKind(itemId) {
  return INVENTORY_ITEM_KINDS[itemId] ?? "loot";
}

export function inventoryStackLimit(itemId) {
  const id = normalizeItemId(itemId);
  return itemKind(id) === "tool" ? 1 : INVENTORY_STACK_LIMITS[id] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeQuantity(value, fallback = 1, label = "Inventory quantity") {
  const quantity = value === undefined || value === null ? fallback : value;
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return quantity;
}

export function createInventoryItem(itemId, quantity = 1) {
  const id = normalizeItemId(itemId);
  const kind = itemKind(id);
  const normalizedQuantity = kind === "tool" ? 1 : normalizeQuantity(quantity);
  if (normalizedQuantity > inventoryStackLimit(id)) {
    throw new Error(`Inventory stack exceeds limit ${inventoryStackLimit(id)}: ${id}`);
  }
  return { id, kind, quantity: normalizedQuantity };
}

export function cloneInventoryItem(item) {
  return item ? { id: item.id, kind: item.kind, quantity: item.quantity } : null;
}

export function createFreshInventory() {
  return {
    slots: [
      createInventoryItem("axe"),
      createInventoryItem("pickaxe"),
      createInventoryItem("hoe"),
      createInventoryItem("water-bucket"),
      ...Array.from({ length: INVENTORY_SLOT_COUNT - 4 }, () => null),
    ],
  };
}

export function createNewGameInventory() {
  const inventory = createFreshInventory();
  inventory.slots[4] = createInventoryItem("potato-seed", 4);
  return inventory;
}

export function createEmptyCombatLoadout() {
  return {
    slots: Array.from({ length: COMBAT_LOADOUT_SLOT_COUNT }, () => null),
  };
}

export function normalizeCombatLoadout(value = {}, { reservedToolIds = [] } = {}) {
  assertPlainRecord(value, "Combat loadout");
  const source = value.slots ?? createEmptyCombatLoadout().slots;
  if (!Array.isArray(source)) throw new Error("Combat loadout slots must be an array");
  const slots = Array.from({ length: COMBAT_LOADOUT_SLOT_COUNT }, () => null);
  const seenTools = new Set(reservedToolIds);

  source.slice(0, COMBAT_LOADOUT_SLOT_COUNT).forEach((raw, index) => {
    if (raw === null || raw === undefined) return;
    assertPlainRecord(raw, `Combat loadout slot ${index}`);
    const id = normalizeItemId(raw.id);
    const kind = itemKind(id);
    const quantity = kind === "tool" ? 1 : normalizeQuantity(raw.quantity);
    if (quantity > inventoryStackLimit(id)) {
      throw new Error(`Combat loadout stack exceeds limit ${inventoryStackLimit(id)}: ${id}`);
    }
    if (kind === "tool") {
      if (seenTools.has(id)) return;
      seenTools.add(id);
    }
    slots[index] = { id, kind, quantity };
  });

  return { slots };
}

export function normalizeInventory(value = {}) {
  assertPlainRecord(value, "Inventory");
  const source = value.slots ?? createFreshInventory().slots;
  if (!Array.isArray(source)) throw new Error("Inventory slots must be an array");
  const slots = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
  const seenTools = new Set();

  source.slice(0, INVENTORY_SLOT_COUNT).forEach((raw, index) => {
    if (raw === null || raw === undefined) return;
    assertPlainRecord(raw, `Inventory slot ${index}`);
    const id = normalizeItemId(raw.id);
    const kind = itemKind(id);
    const rawQuantity = kind === "tool" ? 1 : normalizeQuantity(raw.quantity);
    const item = { id, kind, quantity: rawQuantity };
    if (item.kind === "tool") {
      if (seenTools.has(item.id)) return;
      seenTools.add(item.id);
      slots[index] = item;
      return;
    }
    let remaining = item.quantity;
    const limit = inventoryStackLimit(item.id);
    for (let slotIndex = 0; slotIndex < slots.length && remaining > 0; slotIndex += 1) {
      const existing = slots[slotIndex];
      if (existing?.id !== item.id || existing.kind !== "loot" || existing.quantity >= limit) continue;
      const added = Math.min(remaining, limit - existing.quantity);
      existing.quantity += added;
      remaining -= added;
    }
    const preferred = slots[index] === null ? index : -1;
    for (const slotIndex of [preferred, ...slots.map((_slot, slotIndex) => slotIndex)]) {
      if (remaining <= 0) break;
      if (slotIndex < 0 || slots[slotIndex] !== null) continue;
      const added = Math.min(remaining, limit);
      slots[slotIndex] = { id: item.id, kind: item.kind, quantity: added };
      remaining -= added;
    }
    if (remaining > 0) throw new Error(`Inventory exceeds ten-slot capacity: ${item.id}`);
  });

  return { slots };
}

export function createInventoryFromLegacyCounters({ wood = 0, stone = 0, rubies = 0 } = {}) {
  const inventory = createFreshInventory();
  const legacy = [
    ["wood", wood],
    ["stone", stone],
    ["ruby", rubies],
  ];
  for (const [itemId, rawQuantity] of legacy) {
    if (!Number.isInteger(rawQuantity) || rawQuantity < 0) {
      throw new Error(`Legacy inventory quantity must be a non-negative integer: ${itemId}`);
    }
    if (rawQuantity > 0) addInventoryItem(inventory, createInventoryItem(itemId, rawQuantity));
  }
  return inventory;
}

export function getInventoryQuantity(inventory, itemId) {
  const id = normalizeItemId(itemId);
  return normalizeInventory(inventory).slots
    .filter((item) => item?.id === id)
    .reduce((total, item) => total + item.quantity, 0);
}

export function addInventoryItem(inventory, item, { preferredIndex = null } = {}) {
  assertPlainRecord(inventory, "Inventory");
  const normalized = createInventoryItem(item.id, item.quantity);
  const slots = inventory.slots;
  if (!Array.isArray(slots) || slots.length !== INVENTORY_SLOT_COUNT) {
    throw new Error(`Inventory must contain exactly ${INVENTORY_SLOT_COUNT} slots`);
  }
  if (normalized.kind === "tool" && slots.some((slot) => slot?.id === normalized.id)) {
    return { status: "duplicate-tool", mutated: false, item: cloneInventoryItem(normalized) };
  }
  const initialQuantity = normalized.quantity;
  let remaining = initialQuantity;
  if (normalized.kind === "loot") {
    for (let index = 0; index < slots.length && remaining > 0; index += 1) {
      const existing = slots[index];
      if (existing?.id !== normalized.id || existing.kind !== "loot") continue;
      const capacity = inventoryStackLimit(existing.id) - existing.quantity;
      if (capacity <= 0) continue;
      const added = Math.min(capacity, remaining);
      existing.quantity += added;
      remaining -= added;
      if (remaining === 0) {
        return {
          status: "stacked",
          mutated: true,
          itemId: normalized.id,
          quantity: initialQuantity,
          slotIndex: index,
          slotIndexes: [index],
        };
      }
    }
  }
  const indexes = preferredIndex === null
    ? slots.map((_slot, index) => index)
    : [preferredIndex, ...slots.map((_slot, index) => index).filter((index) => index !== preferredIndex)];
  const inserted = [];
  for (const index of indexes) {
    if (remaining <= 0) break;
    if (slots[index] !== null) continue;
    const amount = Math.min(remaining, inventoryStackLimit(normalized.id));
    slots[index] = createInventoryItem(normalized.id, amount);
    inserted.push(index);
    remaining -= amount;
  }
  if (remaining > 0) {
    for (const index of inserted) slots[index] = null;
    return { status: "inventory-full", mutated: false, item: cloneInventoryItem(normalized) };
  }
  return {
    status: "inserted",
    mutated: true,
    itemId: normalized.id,
    quantity: initialQuantity,
    slotIndex: inserted[0],
    slotIndexes: inserted,
  };
}

export function takeInventorySlot(inventory, index, quantity = null) {
  assertPlainRecord(inventory, "Inventory");
  if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SLOT_COUNT) {
    throw new Error(`Inventory slot index out of range: ${index}`);
  }
  const item = inventory.slots[index];
  if (!item) return { status: "empty", mutated: false, item: null };
  const takeQuantity = quantity === null ? item.quantity : normalizeQuantity(quantity);
  if (takeQuantity > item.quantity) throw new Error("Cannot take more items than a slot contains");
  const taken = createInventoryItem(item.id, takeQuantity);
  if (takeQuantity === item.quantity) inventory.slots[index] = null;
  else item.quantity -= takeQuantity;
  return { status: "taken", mutated: true, item: taken, slotIndex: index };
}

export function swapInventorySlots(inventory, fromIndex, toIndex) {
  if (fromIndex === toIndex) return { status: "unchanged", mutated: false };
  if (![fromIndex, toIndex].every((index) => Number.isInteger(index) && index >= 0 && index < INVENTORY_SLOT_COUNT)) {
    throw new Error("Inventory swap indexes must be valid");
  }
  [inventory.slots[fromIndex], inventory.slots[toIndex]] = [inventory.slots[toIndex], inventory.slots[fromIndex]];
  return { status: "swapped", mutated: true, fromIndex, toIndex };
}

export function swapLoadoutSlots({ inventory, combatLoadout }, source, target) {
  const panels = {
    [LOADOUT_PANELS.PEACEFUL]: inventory?.slots,
    [LOADOUT_PANELS.COMBAT]: combatLoadout?.slots,
  };
  const sourceSlots = panels[source?.panel];
  const targetSlots = panels[target?.panel];
  if (!sourceSlots || !targetSlots) return { status: "invalid-panel", mutated: false };
  if (!Number.isInteger(source.index) || !Number.isInteger(target.index)
    || source.index < 0 || source.index >= sourceSlots.length
    || target.index < 0 || target.index >= targetSlots.length) {
    return { status: "invalid-slot", mutated: false };
  }
  if (source.panel === target.panel && source.index === target.index) return { status: "unchanged", mutated: false };
  const sourceItem = sourceSlots[source.index];
  const targetItem = targetSlots[target.index];
  if (!sourceItem && !targetItem) return { status: "empty", mutated: false };
  sourceSlots[source.index] = targetItem;
  targetSlots[target.index] = sourceItem;
  return { status: "swapped", mutated: true, source, target };
}

export function preferredCombatActionIdForItem(itemId) {
  return COMBAT_ITEM_ACTION_PREFERENCES[itemId] ?? null;
}

export function routePickedInventoryItem({ inventory, combatLoadout }, item, { combatMode = false } = {}) {
  const normalized = createInventoryItem(item.id, item.quantity);
  const preferredActionId = preferredCombatActionIdForItem(normalized.id);
  const preferredIndex = preferredActionId ? COMBAT_ACTION_SLOT_INDEXES[preferredActionId] : null;
  const combatIndexes = preferredIndex === null
    ? COMBAT_NUMBER_SLOT_INDEXES
    : [preferredIndex, ...COMBAT_NUMBER_SLOT_INDEXES];
  if (preferredIndex !== null || combatMode) {
    for (const index of combatIndexes) {
      if (combatLoadout.slots[index] !== null) continue;
      combatLoadout.slots[index] = normalized;
      return { status: "inserted", mutated: true, panel: LOADOUT_PANELS.COMBAT, slotIndex: index, itemId: normalized.id, quantity: normalized.quantity };
    }
  }
  const result = addInventoryItem(inventory, normalized);
  return result.mutated
    ? { ...result, panel: LOADOUT_PANELS.PEACEFUL }
    : { ...result, panel: null };
}

export function normalizeWorldItems(value = []) {
  if (!Array.isArray(value)) throw new Error("World items must be an array");
  return value.map((entry, index) => {
    assertPlainRecord(entry, `World item ${index}`);
    const item = createInventoryItem(entry.item?.id, entry.item?.quantity);
    const x = Number(entry.x);
    const y = Number(entry.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`World item ${index} must have finite coordinates`);
    return {
      id: normalizeItemId(entry.id, `World item ${index} ID`),
      item,
      x,
      y,
    };
  });
}
