import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  consumeServingReservation,
  normalizeKitchenState,
  releaseServingReservation,
  reserveServingItem,
} from "../src/tavern/cookingDomain.js";
import { createGuestController } from "../src/tavern/guestController.js";
import { createGuestRuntime } from "../src/tavern/guestRuntime.js";
import {
  chooseServiceFormat,
  getSaleProfile,
  isServiceFormatAllowed,
  SERVICE_FORMATS,
} from "../src/tavern/saleProfileDomain.js";
import {
  GUEST_ACTIVE_CAP,
  hasCapacityForVisitGroup,
  normalizeTavernServiceState,
} from "../src/tavern/tavernServiceDomain.js";
import { createFreshGameSessionState, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import {
  deserializeSessionEnvelope,
  SAVE_SCHEMA_VERSION,
  serializeSessionEnvelope,
} from "../src/session/sessionPersistence.js";

assert.equal(SESSION_STATE_VERSION, 19);
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.deepEqual(getSaleProfile("fried-potato-dish").serviceFormats, [
  SERVICE_FORMATS.assisted,
  SERVICE_FORMATS.selfService,
]);
assert.equal(isServiceFormatAllowed("fried-potato-dish", SERVICE_FORMATS.takeaway), false);
assert.equal(chooseServiceFormat("fried-potato-dish", {
  hasServicePlace: true,
  preferTakeaway: true,
}), SERVICE_FORMATS.assisted, "potato stays onsite even when takeaway is preferred");
assert.equal(chooseServiceFormat("lemonade", {
  hasServicePlace: true,
  preferTakeaway: true,
}), SERVICE_FORMATS.takeaway);
assert.equal(chooseServiceFormat("lemonade", {
  hasSelfServiceStock: true,
  hasServicePlace: true,
}), SERVICE_FORMATS.selfService);
assert.equal(chooseServiceFormat("lemonade"), null, "missing service infrastructure has no fictitious format");

const atomicKitchen = normalizeKitchenState({
  servingTables: { "serving-1": { itemId: "fried-potato-dish", quantity: 1, reservations: [] } },
});
assert(reserveServingItem(atomicKitchen, "guest-1", ["serving-1"], "fried-potato-dish"));
assert.equal(reserveServingItem(atomicKitchen, "guest-2", ["serving-1"], "fried-potato-dish"), null);
assert.equal(atomicKitchen.servingTables["serving-1"].reservations.length, 1);

function liveScenario({ itemId, serviceFormat = null, initialStock = null, infrastructure = true }) {
  const kitchen = normalizeKitchenState({
    servingTables: {
      "serving-1": {
        itemId: initialStock,
        quantity: initialStock ? 1 : 0,
        reservations: [],
      },
    },
  });
  const serviceState = { nextGuestId: 0, opportunityRemainingMs: 1_000, visitorHistoryByPersonId: {}, guests: [] };
  const actors = new Map();
  const controllers = new Map();
  const purchases = [];
  const failures = [];
  const openUnserved = [];
  let claimed = false;
  let runtime;
  const claimPlace = (guestId) => {
    if (!infrastructure || claimed) return null;
    claimed = guestId;
    return { servingTableId: "serving-1" };
  };
  runtime = createGuestRuntime({
    config: {
      signCheckMs: 10,
      signReactionMs: 10,
      orderStationWaitMs: 30,
      eatingMs: 10,
      drinkingMs: 10,
      satisfactionMs: 10,
      payingMs: 10,
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
    getTavernOpen: () => true,
    isOrderItemActive: () => true,
    getServicePoint: () => ({ x: 32, y: 8 }),
    claimServicePlace: (guestId) => claimed === guestId ? { servingTableId: "serving-1" } : claimPlace(guestId),
    claimVisitService: (guestId, exactItemId, options) => {
      if (!infrastructure || claimed) return null;
      const stock = kitchen.servingTables["serving-1"];
      const hasStock = stock.itemId === exactItemId && stock.quantity > stock.reservations.length;
      let selected = chooseServiceFormat(exactItemId, {
        hasSelfServiceStock: hasStock,
        hasServicePlace: true,
        preferTakeaway: options.preferTakeaway,
        requestedFormat: options.requestedFormat,
      });
      if (!selected) return null;
      let reservation = null;
      if (selected === SERVICE_FORMATS.selfService) {
        reservation = reserveServingItem(kitchen, guestId, ["serving-1"], exactItemId);
        if (!reservation) selected = chooseServiceFormat(exactItemId, {
          hasServicePlace: true,
          preferTakeaway: options.preferTakeaway,
        });
      }
      if (!selected) return null;
      claimed = guestId;
      return { servingTableId: "serving-1", serviceFormat: selected, reservation };
    },
    releaseServicePlace: (guestId) => {
      if (claimed !== guestId) return false;
      claimed = false;
      return true;
    },
    reserveExactItem: (guestId, tableId, exactItemId) => reserveServingItem(kitchen, guestId, [tableId], exactItemId),
    releaseReservation: (guestId, tableId) => releaseServingReservation(kitchen, guestId, tableId),
    consumeReservation: (guestId, tableId) => consumeServingReservation(kitchen, guestId, tableId),
    getPerson: (personId) => ({
      id: personId,
      needs: { novelty: 100, energy: 100, satiety: 25, toilet: 100, lustre: 100, dialogue: 100 },
      lastEvaluatedWorldTimeSeconds: 0,
    }),
    onPurchaseComplete: (purchase) => purchases.push(purchase),
    onOrderFailure: (failure) => failures.push(failure),
    onOpenUnserved: (outcome) => openUnserved.push(outcome),
    getSalePrice: (exactItemId) => getSaleProfile(exactItemId)?.price ?? 0,
    createFeedback: () => ({ set() {}, setOrder() {}, setThought() {}, setProgress() {}, update() {}, destroy() {} }),
  });
  function tick(ms = 10) {
    runtime.update(ms);
    for (const [id, actor] of actors) {
      const direction = controllers.get(id).getCommand().moveDirection;
      actor.motor.position.x += direction.x * 8;
      actor.motor.position.y += direction.y * 8;
    }
  }
  function until(predicate, limit = 800) {
    for (let index = 0; index < limit && !predicate(); index += 1) tick();
    assert(predicate(), "service-format scenario reached its expected state");
  }
  function setStock(exactItemId) {
    Object.assign(kitchen.servingTables["serving-1"], {
      itemId: exactItemId,
      quantity: exactItemId ? 1 : 0,
      reservations: [],
    });
  }
  const guestId = runtime.spawnVisit("person-format-test", itemId, [itemId], { serviceFormat });
  return { runtime, kitchen, purchases, failures, openUnserved, guestId, tick, until, setStock };
}

for (const [itemId, serviceFormat] of [
  ["fried-potato-dish", SERVICE_FORMATS.assisted],
  ["lemonade", SERVICE_FORMATS.takeaway],
]) {
  const scenario = liveScenario({ itemId, serviceFormat });
  scenario.until(() => scenario.runtime.getState().guests[0]?.order.status === "offered");
  assert.equal(scenario.runtime.getState().guests[0].serviceFormat, serviceFormat);
  assert.equal(scenario.runtime.acceptGuestOrder(scenario.guestId).status, "order-accepted");
  scenario.setStock(itemId);
  scenario.until(() => scenario.purchases.length === 1);
  assert.equal(scenario.purchases[0].itemId, itemId);
  for (let index = 0; index < 50; index += 1) scenario.tick();
  assert.equal(scenario.purchases.length, 1, `${serviceFormat} pays exactly once`);
  assert.equal(scenario.failures.length, 0);
}

const selfService = liveScenario({ itemId: "fried-potato-dish", initialStock: "fried-potato-dish" });
selfService.until(() => selfService.runtime.getState().guests[0]?.serviceFormat === SERVICE_FORMATS.selfService);
assert.equal(selfService.runtime.getInteractionDefinitions().length, 0, "self-service creates no take-order action");
assert.equal(selfService.runtime.acceptGuestOrder(selfService.guestId).status, "order-not-offered");
selfService.until(() => selfService.purchases.length === 1);
assert.equal(selfService.kitchen.servingTables["serving-1"].quantity, 0);
for (let index = 0; index < 50; index += 1) selfService.tick();
assert.equal(selfService.purchases.length, 1);

const unavailable = liveScenario({ itemId: "lemonade", infrastructure: false });
unavailable.until(() => unavailable.openUnserved.length === 1);
assert.equal(unavailable.openUnserved[0].reason, "service-capacity-unavailable");
assert.equal(unavailable.purchases.length, 0);

const activeSave = createFreshGameSessionState();
const personId = activeSave.gameplay.population[0].id;
activeSave.gameplay.tavernService.guests = [{
  id: "tavern-guest-1",
  personId,
  state: "accepted-order",
  stateElapsedMs: 100,
  position: { x: 40, y: 40 },
  itemId: "lemonade",
  order: { itemId: "lemonade", status: "accepted", statusElapsedMs: 1_500 },
  acceptableItemIds: ["lemonade"],
  servingTableId: "home-serving-table-01",
  serviceFormat: SERVICE_FORMATS.takeaway,
  servicePlaceActive: true,
  reservationActive: false,
  mealCompleted: false,
  paid: false,
}];
const reloaded = deserializeSessionEnvelope(serializeSessionEnvelope(activeSave));
assert.equal(reloaded.status, "loaded");
assert.equal(reloaded.state.gameplay.tavernService.guests[0].serviceFormat, SERVICE_FORMATS.takeaway);
assert.equal(reloaded.state.gameplay.tavernService.guests[0].servicePlaceActive, true);

const v18 = structuredClone(activeSave);
v18.version = 18;
delete v18.gameplay.tavernService.guests[0].serviceFormat;
delete v18.gameplay.tavernService.guests[0].servicePlaceActive;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 18, state: v18 }));
assert.equal(migrated.schemaVersion, 19);
assert.equal(migrated.state.version, 19);
assert.equal(migrated.state.gameplay.tavernService.guests[0].serviceFormat, SERVICE_FORMATS.assisted);

assert.equal(hasCapacityForVisitGroup(GUEST_ACTIVE_CAP - 2, 2), true);
assert.equal(hasCapacityForVisitGroup(GUEST_ACTIVE_CAP - 1, 2), false);
const groupState = normalizeTavernServiceState({
  guests: [
    activeSave.gameplay.tavernService.guests[0],
    {
      ...activeSave.gameplay.tavernService.guests[0],
      id: "tavern-guest-2",
      personId: activeSave.gameplay.population[1].id,
      itemId: "fried-potato-dish",
      order: { itemId: "fried-potato-dish", status: "accepted", statusElapsedMs: 0 },
      serviceFormat: SERVICE_FORMATS.assisted,
      servingTableId: "home-serving-table-02",
    },
  ],
}, { population: activeSave.gameplay.population });
assert.deepEqual(groupState.guests.map(({ serviceFormat }) => serviceFormat), [
  SERVICE_FORMATS.takeaway,
  SERVICE_FORMATS.assisted,
]);

const serviceSource = readFileSync("src/tavern/tavernServiceRuntime.js", "utf8");
const guestSource = readFileSync("src/tavern/guestRuntime.js", "utf8");
const bridgeSource = readFileSync("src/devtools/e2eBridge.js", "utf8");
for (const contract of ["claimVisitService", "chooseServiceFormat", "reserveServingItem", "forceGuestGroup"]) {
  assert(serviceSource.includes(contract), `service runtime owns ${contract}`);
}
for (const contract of ["commitSelfService", "releaseVisitServicePlace", "servicePlaceActive"]) {
  assert(guestSource.includes(contract), `guest runtime preserves ${contract}`);
}
for (const method of ["forceGuestOrder", "forceGuestGroup", "getGuestOrder"]) {
  assert(bridgeSource.includes(`${method}:`), `E2E bridge exposes ${method}`);
}

console.log("Task #097 assisted, takeaway, self-service, capacity and persistence contracts OK");
