import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  consumeServingReservation,
  normalizeKitchenState,
  reserveServingItem,
} from "../src/tavern/cookingDomain.js";
import { createGuestController } from "../src/tavern/guestController.js";
import { createGuestRuntime } from "../src/tavern/guestRuntime.js";
import {
  advanceOrderTimer,
  createPlannedOrder,
  normalizeOrder,
  ORDER_ACCEPTANCE_TIMEOUT_MS,
  ORDER_FULFILLMENT_TIMEOUT_MS,
  ORDER_STATUS,
  transitionOrder,
} from "../src/tavern/orderDomain.js";
import {
  normalizeTavernServiceState,
  recordCompletedVisit,
  recordFailedAcceptedOrder,
} from "../src/tavern/tavernServiceDomain.js";
import { recentVisitFactor } from "../src/tavern/visitDemandDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

assert.equal(SESSION_STATE_VERSION, 16);
assert.equal(SAVE_SCHEMA_VERSION, 16);
assert.equal(ORDER_ACCEPTANCE_TIMEOUT_MS, 30_000);
assert.equal(ORDER_FULFILLMENT_TIMEOUT_MS, 120_000);

const order = createPlannedOrder("lemonade");
for (const status of [ORDER_STATUS.offered, ORDER_STATUS.accepted, ORDER_STATUS.reserved, ORDER_STATUS.served, ORDER_STATUS.completed]) {
  assert.equal(transitionOrder(order, status).mutated, true);
  assert.equal(order.status, status);
  assert.equal(order.statusElapsedMs, 0);
}
assert.equal(transitionOrder(order, ORDER_STATUS.failed).mutated, false, "completed orders cannot fail retroactively");
assert.equal(normalizeOrder({ itemId: "unknown", status: "bad", statusElapsedMs: -1 }), null);
const waiting = createPlannedOrder("fried-potato-dish");
transitionOrder(waiting, ORDER_STATUS.offered);
assert.equal(advanceOrderTimer(waiting, ORDER_ACCEPTANCE_TIMEOUT_MS - 1).timedOut, false);
assert.equal(advanceOrderTimer(waiting, 1).timedOut, true);
transitionOrder(waiting, ORDER_STATUS.accepted);
assert.equal(advanceOrderTimer(waiting, ORDER_FULFILLMENT_TIMEOUT_MS).timedOut, true);

const kitchen = normalizeKitchenState({
  servingTables: {
    "serving-1": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
  },
});
assert.equal(reserveServingItem(kitchen, "guest-1", ["serving-1"], "lemonade"), null, "wrong item is never substituted");
assert.deepEqual(reserveServingItem(kitchen, "guest-1", ["serving-1"], "fried-potato-dish"), {
  guestId: "guest-1",
  itemId: "fried-potato-dish",
  servingTableId: "serving-1",
});
assert.equal(consumeServingReservation(kitchen, "guest-1", "serving-1").itemId, "fried-potato-dish");

const historyState = normalizeTavernServiceState({ visitorHistoryByPersonId: {} });
recordCompletedVisit(historyState, "person-test", 100);
recordFailedAcceptedOrder(historyState, "person-test", 200);
assert.deepEqual(historyState.visitorHistoryByPersonId["person-test"], {
  completedVisitCount: 1,
  lastCompletedVisitWorldTimeSeconds: 100,
  failedAcceptedOrderCount: 1,
  lastFailedAcceptedOrderWorldTimeSeconds: 200,
});
assert.equal(recentVisitFactor(historyState.visitorHistoryByPersonId["person-test"], 200).recentVisitFactor, 0.15);

const migratedSource = createFreshGameSessionState();
migratedSource.version = 15;
const migratedPersonId = migratedSource.gameplay.population[0].id;
migratedSource.gameplay.kitchen.servingTables["home-serving-table-01"] = {
  itemId: "lemonade",
  quantity: 1,
  reservations: [{ guestId: "tavern-guest-1", itemId: "lemonade" }],
};
migratedSource.gameplay.tavernService.guests = [{
  id: "tavern-guest-1",
  personId: migratedPersonId,
  state: "approaching-service",
  stateElapsedMs: 400,
  position: { x: 10, y: 20 },
  itemId: "lemonade",
  acceptableItemIds: ["fried-potato-dish", "lemonade"],
  servingTableId: "home-serving-table-01",
  diningTableId: null,
  reservationActive: true,
  mealCompleted: false,
  paid: false,
}];
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 15, state: migratedSource }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.schemaVersion, 16);
assert.deepEqual(migrated.state.gameplay.tavernService.guests[0].order, {
  itemId: "lemonade",
  status: "reserved",
  statusElapsedMs: 0,
});
assert.equal(migrated.state.gameplay.tavernService.guests[0].servingTableId, "home-serving-table-01");

const acceptedSave = createFreshGameSessionState();
const acceptedPersonId = acceptedSave.gameplay.population[0].id;
acceptedSave.gameplay.tavernService.guests = [{
  id: "tavern-guest-1",
  personId: acceptedPersonId,
  state: "accepted-order",
  stateElapsedMs: 0,
  position: { x: 40, y: 40 },
  itemId: "fried-potato-dish",
  order: { itemId: "fried-potato-dish", status: "accepted", statusElapsedMs: 42_000 },
  acceptableItemIds: ["fried-potato-dish", "lemonade"],
  servingTableId: "home-serving-table-01",
  diningTableId: null,
  reservationActive: false,
  mealCompleted: false,
  paid: false,
}];
const acceptedReload = deserializeSessionEnvelope(serializeSessionEnvelope(acceptedSave));
assert.deepEqual(acceptedReload.state.gameplay.tavernService.guests[0].order, {
  itemId: "fried-potato-dish",
  status: "accepted",
  statusElapsedMs: 42_000,
});

function liveScenario({ stockItemId = null } = {}) {
  let open = true;
  const table = { itemId: stockItemId, quantity: stockItemId ? 1 : 0, reservations: [] };
  const liveKitchen = normalizeKitchenState({ servingTables: { "serving-1": table } });
  const serviceState = { nextGuestId: 0, opportunityRemainingMs: 1_000, visitorHistoryByPersonId: {}, guests: [] };
  const actors = new Map();
  const controllers = new Map();
  const orderChanges = [];
  const failures = [];
  const purchases = [];
  const runtime = createGuestRuntime({
    config: {
      signCheckMs: 10,
      signReactionMs: 10,
      orderStationWaitMs: 50,
      eatingMs: 10,
      mealCompleteReactionMs: 10,
      blockedReplanMs: 100,
      maxReplans: 2,
      arrivalRadius: 3,
      createController: createGuestController,
      points: { spawn: { x: 8, y: 8 }, sign: { x: 16, y: 8 }, exit: { x: 0, y: 8 } },
    },
    serviceState,
    worldLayout: {
      bounds: { left: 0, top: 0, right: 80, bottom: 80 },
      cellSize: 8,
      isBlockedCell: () => false,
      isBlockedBox: () => false,
    },
    createGuest(controller, id, position) {
      controllers.set(id, controller);
      const actor = {
        id,
        footWidth: 4,
        footDepth: 2,
        lastBlockedAxes: { x: false, y: false },
        motor: { position: { ...position } },
      };
      actors.set(id, actor);
      return actor;
    },
    removeGuest(id) { controllers.delete(id); actors.delete(id); },
    getTavernOpen: () => open,
    isOrderItemActive: () => open,
    getServicePoint: () => ({ x: 32, y: 8 }),
    claimServicePlace: () => ({ servingTableId: "serving-1" }),
    releaseServicePlace: () => true,
    reserveExactItem: (guestId, tableId, itemId) => reserveServingItem(liveKitchen, guestId, [tableId], itemId),
    releaseReservation: () => false,
    consumeReservation: (guestId, tableId) => consumeServingReservation(liveKitchen, guestId, tableId),
    onOrderChange: (change) => orderChanges.push(change),
    onOrderFailure: (failure) => failures.push(failure),
    onPurchaseComplete: (purchase) => purchases.push(purchase),
    getSalePrice: () => 2,
    getPersonDisplayName: () => "Mira",
    getItemLabel: () => "Lemonade",
    createFeedback: () => ({ set() {}, setOrder() {}, update() {}, destroy() {} }),
  });
  function tick(ms = 10) {
    runtime.update(ms);
    for (const [id, actor] of actors) {
      const direction = controllers.get(id).getCommand().moveDirection;
      actor.motor.position.x += direction.x * 8;
      actor.motor.position.y += direction.y * 8;
    }
  }
  function until(predicate, limit = 600) {
    for (let index = 0; index < limit && !predicate(); index += 1) tick();
    assert(predicate(), "live order scenario reached the expected state");
  }
  return {
    runtime,
    liveKitchen,
    orderChanges,
    failures,
    purchases,
    tick,
    until,
    setOpen(value) { open = value; },
    setStock(itemId) {
      Object.assign(liveKitchen.servingTables["serving-1"], {
        itemId,
        quantity: itemId ? 1 : 0,
        reservations: [],
      });
    },
  };
}

const live = liveScenario({ stockItemId: "fried-potato-dish" });
const liveGuestId = live.runtime.spawnVisit("person-mira", "lemonade", ["fried-potato-dish", "lemonade"]);
live.until(() => live.runtime.getState().guests[0]?.order.status === "offered");
assert.equal(live.liveKitchen.servingTables["serving-1"].reservations.length, 0, "stock is not reserved before acceptance");
assert.equal(live.runtime.getInteractionDefinitions()[0].payload.guestId, liveGuestId);
assert.equal(live.runtime.acceptGuestOrder(liveGuestId).status, "order-accepted");
live.tick();
assert.equal(live.liveKitchen.servingTables["serving-1"].reservations.length, 0, "wrong stock remains unreserved");
live.setStock("lemonade");
live.until(() => live.purchases.length === 1);
assert.equal(live.purchases[0].itemId, "lemonade");
assert(live.orderChanges.some(({ order: changed }) => changed.status === "served"));
assert(live.orderChanges.some(({ order: changed }) => changed.status === "completed"));

const ignored = liveScenario();
const ignoredId = ignored.runtime.spawnVisit("person-ignored", "lemonade", ["lemonade"]);
ignored.until(() => ignored.runtime.getState().guests[0]?.order.status === "offered");
ignored.runtime.setOrderElapsedMs(ignoredId, ORDER_ACCEPTANCE_TIMEOUT_MS);
ignored.until(() => !ignored.runtime.getState().active);
assert.equal(ignored.failures.length, 0, "unaccepted timeout has no failed-service history");

const failed = liveScenario();
const failedId = failed.runtime.spawnVisit("person-failed", "lemonade", ["lemonade"]);
failed.until(() => failed.runtime.getState().guests[0]?.order.status === "offered");
failed.runtime.acceptGuestOrder(failedId);
failed.runtime.setOrderElapsedMs(failedId, ORDER_FULFILLMENT_TIMEOUT_MS);
failed.tick();
assert.equal(failed.failures.length, 1);
assert.equal(failed.purchases.length, 0);

const closedAfterAccept = liveScenario();
const committedId = closedAfterAccept.runtime.spawnVisit("person-committed", "lemonade", ["lemonade"]);
closedAfterAccept.until(() => closedAfterAccept.runtime.getState().guests[0]?.order.status === "offered");
closedAfterAccept.runtime.acceptGuestOrder(committedId);
closedAfterAccept.setOpen(false);
closedAfterAccept.setStock("lemonade");
closedAfterAccept.until(() => closedAfterAccept.purchases.length === 1);
assert.equal(closedAfterAccept.purchases[0].itemId, "lemonade", "accepted commitment survives menu deactivation");

const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const interactionSource = readFileSync("src/interaction/worldInteractionCoordinator.js", "utf8");
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const contract of [
  "decision.bestOfferItemId", "claimServicePlace", "reserveExactItem", "recordFailedAcceptedOrder",
  "getOrderInteractionDefinitions", "acceptGuestOrder",
]) assert(serviceSource.includes(contract), `service runtime exposes ${contract}`);
assert(interactionSource.includes("GUEST_ORDER_INTERACTION_KIND"));
for (const method of ["forceGuestOrder", "acceptGuestOrder", "setGuestOrderElapsedMs", "getGuestOrder"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}
for (const locale of ["en", "ru"]) {
  const hud = JSON.parse(readFileSync(`public/locales/${locale}/hud.json`, "utf8"));
  assert(hud.interaction.acceptOrderLemonade);
  assert(hud.interaction.acceptOrderFriedPotato);
}

console.log("Task #089 order/fulfillment contracts OK");
