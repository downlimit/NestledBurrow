import { SELLABLE_ITEM_IDS } from "./cookingDomain.js";

export const ORDER_STATUS = Object.freeze({
  planned: "planned",
  offered: "offered",
  accepted: "accepted",
  reserved: "reserved",
  served: "served",
  completed: "completed",
  failed: "failed",
});

export const ORDER_ACCEPTANCE_TIMEOUT_MS = 30_000;
export const ORDER_FULFILLMENT_TIMEOUT_MS = 120_000;

const TRANSITIONS = Object.freeze({
  [ORDER_STATUS.planned]: Object.freeze([ORDER_STATUS.offered]),
  [ORDER_STATUS.offered]: Object.freeze([ORDER_STATUS.accepted]),
  [ORDER_STATUS.accepted]: Object.freeze([ORDER_STATUS.reserved, ORDER_STATUS.failed]),
  [ORDER_STATUS.reserved]: Object.freeze([ORDER_STATUS.served]),
  [ORDER_STATUS.served]: Object.freeze([ORDER_STATUS.completed]),
  [ORDER_STATUS.completed]: Object.freeze([]),
  [ORDER_STATUS.failed]: Object.freeze([]),
});

export function createPlannedOrder(itemId) {
  if (!SELLABLE_ITEM_IDS.includes(itemId)) throw new Error("Planned order requires a canonical sellable item");
  return { itemId, status: ORDER_STATUS.planned, statusElapsedMs: 0 };
}

export function normalizeOrder(value, { fallbackItemId = null, fallbackStatus = ORDER_STATUS.planned } = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const itemId = SELLABLE_ITEM_IDS.includes(source.itemId)
    ? source.itemId
    : SELLABLE_ITEM_IDS.includes(fallbackItemId) ? fallbackItemId : null;
  if (!itemId) return null;
  const status = Object.values(ORDER_STATUS).includes(source.status) ? source.status : fallbackStatus;
  const statusElapsedMs = Number(source.statusElapsedMs);
  return {
    itemId,
    status,
    statusElapsedMs: Number.isFinite(statusElapsedMs) && statusElapsedMs >= 0 ? statusElapsedMs : 0,
  };
}

export function transitionOrder(order, nextStatus) {
  const normalized = normalizeOrder(order);
  if (!normalized) return { status: "invalid-order", mutated: false, order: null };
  if (!(TRANSITIONS[normalized.status] ?? []).includes(nextStatus)) {
    return { status: "invalid-transition", mutated: false, order: normalized };
  }
  order.itemId = normalized.itemId;
  order.status = nextStatus;
  order.statusElapsedMs = 0;
  return { status: nextStatus, mutated: true, order: { ...order } };
}

export function advanceOrderTimer(order, deltaMs) {
  const normalized = normalizeOrder(order);
  if (!normalized) return { status: "invalid-order", mutated: false, timedOut: false };
  if (![ORDER_STATUS.offered, ORDER_STATUS.accepted].includes(normalized.status)) {
    order.statusElapsedMs = normalized.statusElapsedMs;
    return { status: normalized.status, mutated: false, timedOut: false };
  }
  const delta = Math.max(0, Number(deltaMs) || 0);
  order.statusElapsedMs = normalized.statusElapsedMs + delta;
  const timeoutMs = normalized.status === ORDER_STATUS.offered
    ? ORDER_ACCEPTANCE_TIMEOUT_MS
    : ORDER_FULFILLMENT_TIMEOUT_MS;
  return {
    status: normalized.status,
    mutated: delta > 0,
    timedOut: order.statusElapsedMs >= timeoutMs,
    remainingMs: Math.max(0, timeoutMs - order.statusElapsedMs),
  };
}
