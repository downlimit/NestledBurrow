export const INVENTORY_SLOT_COUNT = 10;
export const INVENTORY_TOOL_IDS = Object.freeze(["axe", "pickaxe", "hoe", "water-bucket"]);
export const INVENTORY_ITEM_IDS = Object.freeze([
  ...INVENTORY_TOOL_IDS,
  "wood", "stone", "ruby", "potato-seed", "potato", "lemon-seed", "lemon",
  "sliced-potato", "lemonade", "fried-potato-dish",
]);
export const INVENTORY_ITEM_KINDS = Object.freeze({
  axe: "tool",
  pickaxe: "tool",
  hoe: "tool",
  "water-bucket": "tool",
  wood: "loot",
  stone: "loot",
  ruby: "loot",
  "potato-seed": "loot",
  potato: "loot",
  "lemon-seed": "loot",
  lemon: "loot",
  "sliced-potato": "loot",
  lemonade: "loot",
  "fried-potato-dish": "loot",
});
export const INVENTORY_STACK_LIMITS = Object.freeze({
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

export function findInventoryStack(inventory, itemId) {
  const id = normalizeItemId(itemId);
  const limit = inventoryStackLimit(id);
  return inventory.slots.findIndex((item) => item?.id === id && item.kind === "loot" && item.quantity < limit);
}

export function findFirstEmptyInventorySlot(inventory) {
  return inventory.slots.findIndex((item) => item === null);
}

export function canAddInventoryItem(inventory, item) {
  const normalized = normalizeInventoryBatch(item);
  if (normalized.kind === "tool") {
    if (inventory.slots.some((slot) => slot?.id === normalized.id)) return { status: "duplicate-tool", canAdd: false };
    const slotIndex = findFirstEmptyInventorySlot(inventory);
    return slotIndex >= 0
      ? { status: "empty-slot", canAdd: true, slotIndex, plan: [{ slotIndex, added: 1, quantity: 1 }] }
      : { status: "inventory-full", canAdd: false };
  }
  const limit = inventoryStackLimit(normalized.id);
  let remaining = normalized.quantity;
  const plan = [];
  for (let slotIndex = 0; slotIndex < inventory.slots.length && remaining > 0; slotIndex += 1) {
    const slot = inventory.slots[slotIndex];
    if (slot?.id !== normalized.id || slot.kind !== "loot" || slot.quantity >= limit) continue;
    const added = Math.min(remaining, limit - slot.quantity);
    plan.push({ slotIndex, added, quantity: slot.quantity + added });
    remaining -= added;
  }
  for (let slotIndex = 0; slotIndex < inventory.slots.length && remaining > 0; slotIndex += 1) {
    if (inventory.slots[slotIndex] !== null) continue;
    const added = Math.min(remaining, limit);
    plan.push({ slotIndex, added, quantity: added });
    remaining -= added;
  }
  if (remaining > 0) return { status: "inventory-full", canAdd: false, remaining, plan: [] };
  const usesEmptySlot = plan.some(({ slotIndex }) => inventory.slots[slotIndex] === null);
  return {
    status: usesEmptySlot ? "empty-slot" : "stack",
    canAdd: true,
    slotIndex: plan[0]?.slotIndex ?? -1,
    quantity: plan[0]?.quantity ?? normalized.quantity,
    plan,
  };
}

export function addInventoryItem(inventory, item) {
  const normalized = normalizeInventoryBatch(item);
  const availability = canAddInventoryItem(inventory, normalized);
  if (!availability.canAdd) return { ...availability, mutated: false, item: normalized };
  const plan = (availability.plan ?? []).map((operation) => ({
    ...operation,
    wasEmpty: inventory.slots[operation.slotIndex] === null,
  }));
  for (const operation of plan) {
    const existing = inventory.slots[operation.slotIndex];
    inventory.slots[operation.slotIndex] = existing
      ? { ...existing, quantity: operation.quantity }
      : createInventoryItem(normalized.id, operation.quantity);
  }
  return {
    status: availability.status === "stack" ? "stacked" : "inserted",
    mutated: true,
    slotIndex: availability.slotIndex,
    slots: plan.map(({ slotIndex }) => slotIndex),
    plan,
    item: { ...normalized },
  };
}

export function inventoryCapacityFor(inventory, itemId) {
  const id = normalizeItemId(itemId);
  if (itemKind(id) === "tool") {
    return inventory.slots.some((slot) => slot?.id === id) ? 0 : Number(findFirstEmptyInventorySlot(inventory) >= 0);
  }
  const limit = inventoryStackLimit(id);
  return inventory.slots.reduce((total, slot) => {
    if (slot === null) return total + limit;
    if (slot.id === id && slot.kind === "loot") return total + Math.max(0, limit - slot.quantity);
    return total;
  }, 0);
}

export function addInventoryItemUpTo(inventory, item) {
  const normalized = normalizeInventoryBatch(item);
  const accepted = Math.min(normalized.quantity, inventoryCapacityFor(inventory, normalized.id));
  if (accepted <= 0) {
    return { status: "inventory-full", mutated: false, accepted: 0, remaining: normalized.quantity, item: normalized, plan: [] };
  }
  const result = addInventoryItem(inventory, { ...normalized, quantity: accepted });
  return { ...result, accepted, remaining: normalized.quantity - accepted };
}

function normalizeInventoryBatch(item) {
  assertPlainRecord(item, "Inventory item batch");
  const id = normalizeItemId(item.id);
  const kind = itemKind(id);
  return {
    id,
    kind,
    quantity: kind === "tool" ? 1 : normalizeQuantity(item.quantity),
  };
}

export function takeInventoryItem(inventory, itemId, quantity = 1) {
  const id = normalizeItemId(itemId);
  let remaining = normalizeQuantity(quantity);
  if (getInventoryQuantity(inventory, id) < remaining) {
    return { status: "insufficient-quantity", mutated: false, item: createInventoryItem(id, Math.min(remaining, inventoryStackLimit(id))) };
  }
  const slots = [];
  for (let slotIndex = inventory.slots.length - 1; slotIndex >= 0 && remaining > 0; slotIndex -= 1) {
    const slot = inventory.slots[slotIndex];
    if (slot?.id !== id) continue;
    const taken = Math.min(remaining, slot.quantity);
    slot.quantity -= taken;
    remaining -= taken;
    slots.push(slotIndex);
    if (slot.quantity === 0) inventory.slots[slotIndex] = null;
  }
  return { status: "taken", mutated: true, slots, item: { id, kind: itemKind(id), quantity } };
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
