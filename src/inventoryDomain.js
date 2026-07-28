export const INVENTORY_SLOT_COUNT = 10;
export const INVENTORY_TOOL_IDS = Object.freeze(["axe", "hoe", "watering-can"]);
export const INVENTORY_ITEM_IDS = Object.freeze([...INVENTORY_TOOL_IDS, "wood", "stone", "ruby"]);
export const INVENTORY_ITEM_KINDS = Object.freeze({
  axe: "tool",
  hoe: "tool",
  "watering-can": "tool",
  wood: "loot",
  stone: "loot",
  ruby: "loot",
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
  return { id, kind, quantity: normalizedQuantity };
}

export function cloneInventoryItem(item) {
  return item ? { id: item.id, kind: item.kind, quantity: item.quantity } : null;
}

export function createFreshInventory() {
  return {
    slots: [
      createInventoryItem("axe"),
      createInventoryItem("hoe"),
      createInventoryItem("watering-can"),
      ...Array.from({ length: INVENTORY_SLOT_COUNT - 3 }, () => null),
    ],
  };
}

export function normalizeInventory(value = {}) {
  assertPlainRecord(value, "Inventory");
  const source = value.slots ?? createFreshInventory().slots;
  if (!Array.isArray(source)) throw new Error("Inventory slots must be an array");
  const slots = Array.from({ length: INVENTORY_SLOT_COUNT }, () => null);
  const seenTools = new Set();
  const seenLoot = new Map();

  source.slice(0, INVENTORY_SLOT_COUNT).forEach((raw, index) => {
    if (raw === null || raw === undefined) return;
    assertPlainRecord(raw, `Inventory slot ${index}`);
    const item = createInventoryItem(raw.id, raw.quantity);
    if (item.kind === "tool") {
      if (seenTools.has(item.id)) return;
      seenTools.add(item.id);
      slots[index] = item;
      return;
    }
    const existingIndex = seenLoot.get(item.id);
    if (existingIndex !== undefined) {
      const next = slots[existingIndex].quantity + item.quantity;
      if (!Number.isSafeInteger(next)) throw new Error(`Inventory stack overflow: ${item.id}`);
      slots[existingIndex].quantity = next;
      return;
    }
    seenLoot.set(item.id, index);
    slots[index] = item;
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

export function findInventoryStack(inventory, itemId) {
  const id = normalizeItemId(itemId);
  return inventory.slots.findIndex((item) => item?.id === id && item.kind === "loot");
}

export function findFirstEmptyInventorySlot(inventory) {
  return inventory.slots.findIndex((item) => item === null);
}

export function canAddInventoryItem(inventory, item) {
  const normalized = createInventoryItem(item.id, item.quantity);
  if (normalized.kind === "tool") {
    if (inventory.slots.some((slot) => slot?.id === normalized.id)) return { status: "duplicate-tool", canAdd: false };
    const slotIndex = findFirstEmptyInventorySlot(inventory);
    return slotIndex >= 0 ? { status: "empty-slot", canAdd: true, slotIndex } : { status: "inventory-full", canAdd: false };
  }
  const stackIndex = findInventoryStack(inventory, normalized.id);
  if (stackIndex >= 0) {
    const quantity = inventory.slots[stackIndex].quantity + normalized.quantity;
    return Number.isSafeInteger(quantity)
      ? { status: "stack", canAdd: true, slotIndex: stackIndex, quantity }
      : { status: "stack-overflow", canAdd: false };
  }
  const slotIndex = findFirstEmptyInventorySlot(inventory);
  return slotIndex >= 0 ? { status: "empty-slot", canAdd: true, slotIndex } : { status: "inventory-full", canAdd: false };
}

export function addInventoryItem(inventory, item) {
  const normalized = createInventoryItem(item.id, item.quantity);
  const availability = canAddInventoryItem(inventory, normalized);
  if (!availability.canAdd) return { ...availability, mutated: false, item: normalized };
  if (availability.status === "stack") {
    inventory.slots[availability.slotIndex].quantity = availability.quantity;
  } else {
    inventory.slots[availability.slotIndex] = normalized;
  }
  return { status: availability.status === "stack" ? "stacked" : "inserted", mutated: true, slotIndex: availability.slotIndex, item: cloneInventoryItem(normalized) };
}

export function swapInventorySlots(inventory, fromIndex, toIndex) {
  assertSlotIndex(fromIndex);
  assertSlotIndex(toIndex);
  if (fromIndex === toIndex) return { status: "unchanged", mutated: false };
  const item = inventory.slots[fromIndex];
  inventory.slots[fromIndex] = inventory.slots[toIndex];
  inventory.slots[toIndex] = item;
  return { status: "swapped", mutated: true, fromIndex, toIndex };
}

export function takeInventorySlot(inventory, slotIndex) {
  assertSlotIndex(slotIndex);
  const item = inventory.slots[slotIndex];
  if (!item) return { status: "empty-slot", mutated: false, item: null };
  inventory.slots[slotIndex] = null;
  return { status: "taken", mutated: true, slotIndex, item: cloneInventoryItem(item) };
}

export function resetInventory(inventory) {
  const fresh = createFreshInventory();
  inventory.slots.splice(0, inventory.slots.length, ...fresh.slots);
  return { status: "reset", mutated: true };
}

export function createWorldItemId(worldItems = []) {
  let maximum = 0;
  for (const item of worldItems) {
    const match = /^dropped-item-(\d+)$/.exec(String(item?.id ?? ""));
    if (match) maximum = Math.max(maximum, Number(match[1]));
  }
  return `dropped-item-${maximum + 1}`;
}

export function normalizeWorldItems(value = []) {
  if (!Array.isArray(value)) throw new Error("World items must be an array");
  const ids = new Set();
  return value.map((raw, index) => {
    assertPlainRecord(raw, `World item ${index}`);
    const id = normalizeItemId(raw.id, `World item ${index} ID`);
    if (ids.has(id)) throw new Error(`Duplicate world item ID: ${id}`);
    ids.add(id);
    const x = Number(raw.x);
    const y = Number(raw.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`World item ${id} position must be finite`);
    return { id, item: createInventoryItem(raw.item?.id, raw.item?.quantity), x, y };
  });
}

function assertSlotIndex(index) {
  if (!Number.isInteger(index) || index < 0 || index >= INVENTORY_SLOT_COUNT) {
    throw new Error(`Inventory slot index must be in 0..${INVENTORY_SLOT_COUNT - 1}`);
  }
}
