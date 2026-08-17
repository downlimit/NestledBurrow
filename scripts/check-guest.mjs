import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CharacterSystem } from "../src/character/characterSystem.js";
import { createCoinRuntime } from "../src/tavern/coinRuntime.js";
import {
  consumeServingReservation,
  normalizeKitchenState,
  releaseServingReservation,
  reserveServingItem,
} from "../src/tavern/cookingDomain.js";
import { createGuestController } from "../src/tavern/guestController.js";
import { GUEST_STATES, createGuestRuntime } from "../src/tavern/guestRuntime.js";
import { TAVERN_SIGN, TAVERN_SIGN_BUILD_KIND } from "../src/tavern/guestConfig.js";
import { createActorNavigation, createActorWalkability, findGridPath } from "../src/tavern/gridPathfinder.js";
import { createFreshGameSessionState } from "../src/session/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/session/sessionPersistence.js";
import { createTavernSignRuntime } from "../src/tavern/tavernSignRuntime.js";
import { getSalePrice } from "../src/tavern/saleProfileDomain.js";

const bounds = { left: 0, top: 0, right: 160, bottom: 160 };
const clearPath = findGridPath({ start: { x: 8, y: 14 }, goal: { x: 72, y: 78 }, bounds, isWalkable: () => true });
assert(clearPath.length > 0);
assert(clearPath.some((point) => point.x > 8 && point.y > 14), "A* uses eight-direction movement");

const blocked = new Set(["2,1", "2,2", "2,3"]);
const detour = findGridPath({
  start: { x: 8, y: 30 },
  goal: { x: 72, y: 30 },
  bounds,
  isWalkable: (cell) => !blocked.has(`${cell.x},${cell.y}`),
});
assert(detour.some((point) => point.y !== 30), "A* routes around obstacles");

const cornerBlocked = new Set(["1,0", "0,1"]);
assert.equal(findGridPath({
  start: { x: 8, y: 14 },
  goal: { x: 24, y: 30 },
  bounds: { left: 0, top: 0, right: 32, bottom: 32 },
  isWalkable: (cell) => !cornerBlocked.has(`${cell.x},${cell.y}`),
}), null, "A* cannot cross a closed diagonal corner");

let boxChecks = 0;
const walkability = createActorWalkability({
  bounds,
  cellSize: 8,
  isBlockedCell: () => false,
  isBlockedBox: (box) => { boxChecks += 1; return box.left >= 32 && box.left < 48; },
}, { cellSize: 16, footWidth: 8, footDepth: 4 });
assert.equal(walkability({ x: 0, y: 0 }), true);
assert.equal(walkability({ x: 2, y: 0 }), false);
assert(boxChecks >= 2);

const thinWall = { left: 46, right: 50, top: 16, bottom: 80 };
const navigation = createActorNavigation({
  bounds,
  cellSize: 8,
  isBlockedCell: () => false,
  isBlockedBox: (box) => box.right > thinWall.left && box.left < thinWall.right
    && box.bottom > thinWall.top && box.top < thinWall.bottom,
}, { cellSize: 16, footWidth: 8, footDepth: 4 });
assert(findGridPath({
  start: { x: 24, y: 30 },
  goal: { x: 72, y: 30 },
  bounds,
  ...navigation,
})?.some((point) => point.y < thinWall.top || point.y > thinWall.bottom));

const systemCharacter = { id: "guest", destroyCalls: 0, destroy() { this.destroyCalls += 1; } };
const system = new CharacterSystem({ collisionEnvironment: {} });
system.add(systemCharacter);
assert.equal(system.remove("guest"), true);
assert.equal(systemCharacter.destroyCalls, 1);
assert.equal(system.remove("guest"), false);

const legacy = createFreshGameSessionState();
legacy.version = 4;
delete legacy.gameplay.tavernOpen;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 4, state: legacy }));
assert.equal(SAVE_SCHEMA_VERSION, 19);
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.gameplay.tavernOpen, false);
assert.equal(migrated.state.gameplay.coins, 0);
assert.deepEqual(migrated.state.gameplay.tavernService.guests, []);

const signPng = readFileSync(new URL("../public/assets/project/facilities/NestledBurrow_TavernSign.png", import.meta.url));
assert.equal(signPng.readUInt32BE(16), 64);
assert.equal(signPng.readUInt32BE(20), 32);
assert.equal(signPng.byteLength, 2981);
assert.equal(createHash("sha256").update(signPng).digest("hex"), "47b15a21480a0096e4541900425dd0d870d9f50d1401d12832a6828abeaef154");

class SignSpriteStub {
  constructor(x, y, frame) { this.x = x; this.y = y; this.frame = frame; }
  setOrigin() { return this; }
  setDepth(value) { this.depth = value; return this; }
  setFrame(value) { this.frame = value; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setTint(value) { this.tint = value; return this; }
  setAlpha(value) { this.alpha = value; return this; }
  destroy() { this.destroyed = true; }
}
const signColliders = new Map();
const signWorld = {
  bounds: { left: 0, top: 0, right: 1200, bottom: 900 },
  setWorldObjectCollider(id, collider) { signColliders.set(id, collider); },
  clearWorldObjectCollider(id) { signColliders.delete(id); },
  getBlockingColliders(box) {
    return [...signColliders].filter(([, collider]) => box.left < collider.right && box.right > collider.left
      && box.top < collider.bottom && box.bottom > collider.top).map(([id]) => ({ id }));
  },
};
const signRuntime = createTavernSignRuntime({ add: { sprite: (x, y, _key, frame) => new SignSpriteStub(x, y, frame) } }, {
  getTavernOpen: () => false,
  worldLayout: signWorld,
});
const originalSign = signRuntime.getState();
assert(signRuntime.getBuildMoveTargetAt(originalSign.position), "the tavern sign is a build-mode move target");
const movedSign = signRuntime.moveBuildTarget({ x: originalSign.position.x + 32, y: originalSign.position.y + 16 });
assert(movedSign, "the tavern sign moves to a free build-grid point");
const movedSignState = signRuntime.getState();
assert.deepEqual(movedSignState.interactionPosition, {
  x: originalSign.interactionPosition.x + 32,
  y: originalSign.interactionPosition.y + 16,
}, "moving the sign moves its interaction point");
assert.deepEqual(movedSignState.guestCheckPoint, {
  x: originalSign.guestCheckPoint.x + 32,
  y: originalSign.guestCheckPoint.y + 16,
}, "moving the sign moves the guest check point");
assert.deepEqual(signRuntime.getStartingLayoutFurniture(), [{
  id: TAVERN_SIGN.id,
  kind: TAVERN_SIGN_BUILD_KIND,
  position: movedSignState.position,
}], "the moved sign participates in the canonical furniture layout");
assert.equal(signRuntime.restoreStartingLayoutFurniture([{
  id: TAVERN_SIGN.id,
  kind: TAVERN_SIGN_BUILD_KIND,
  position: originalSign.position,
}]), true);
assert.deepEqual(signRuntime.getState().position, originalSign.position, "starting-layout restore returns the sign to its authored point");
signRuntime.destroy();
assert.equal(signColliders.has(TAVERN_SIGN.id), false, "sign teardown clears its live collider");

const runtimeConfig = Object.freeze({
  id: "guest",
  signCheckMs: 20,
  signReactionMs: 10,
  eatingMs: 30,
  mealCompleteReactionMs: 10,
  blockedReplanMs: 30,
  maxReplans: 2,
  arrivalRadius: 5,
  createController: createGuestController,
  points: {
    spawn: { x: 24, y: 142 },
    sign: { x: 24, y: 110 },
    outsideDoor: { x: 24, y: 94 },
    insideDoor: { x: 24, y: 78 },
    exit: { x: 24, y: 142 },
  },
});

function scenario({
  open,
  itemId,
  quantity = 1,
  isBlockedBox = () => false,
  servicePoint = { x: 72, y: 46 },
  seatPoint = { x: 120, y: 78 },
  servingTables = null,
  servicePoints = null,
  seatPoints = null,
  serviceFormat = null,
}) {
  const tableStocks = servingTables ?? {
    "serving-1": { itemId, quantity, reservations: [] },
  };
  const resolvedServicePoints = servicePoints ?? Object.fromEntries(
    Object.keys(tableStocks).map((tableId) => [tableId, servicePoint]),
  );
  const resolvedSeatPoints = seatPoints ?? { "dining-1": seatPoint };
  const kitchen = normalizeKitchenState({
    servingTables: tableStocks,
  });
  const serviceState = { opportunityRemainingMs: 8_000, nextGuestId: 0, visitorHistoryByPersonId: {}, guests: [] };
  const actors = new Map();
  const controllers = new Map();
  const payments = [];
  const feedback = [];
  const states = [];
  const paymentStates = [];
  const stationsByGuest = new Map();
  const guestsByStation = new Map();
  const runtime = createGuestRuntime({
    config: runtimeConfig,
    serviceState,
    worldLayout: { bounds, cellSize: 8, isBlockedCell: () => false, isBlockedBox },
    createGuest(controller, id, position) {
      controllers.set(id, controller);
      const actor = {
        id,
        footWidth: 8,
        footDepth: 4,
        lastBlockedAxes: { x: false, y: false },
        motor: { position: { ...position } },
      };
      actors.set(id, actor);
      return actor;
    },
    removeGuest(id) { controllers.delete(id); return actors.delete(id); },
    getTavernOpen: () => open,
    claimServicePlace: (guestId, exactItemId, preferredId = null) => {
      const current = stationsByGuest.get(guestId);
      if (current) return { servingTableId: current };
      const candidates = Object.keys(resolvedServicePoints).filter((tableId) => !guestsByStation.has(tableId));
      const selected = (preferredId && candidates.includes(preferredId) ? preferredId : null)
        ?? candidates.find((tableId) => kitchen.servingTables[tableId]?.itemId === exactItemId)
        ?? candidates.find((tableId) => !kitchen.servingTables[tableId]?.itemId)
        ?? candidates[0];
      if (!selected) return null;
      stationsByGuest.set(guestId, selected);
      guestsByStation.set(selected, guestId);
      return { servingTableId: selected };
    },
    releaseServicePlace: (guestId) => {
      const tableId = stationsByGuest.get(guestId);
      stationsByGuest.delete(guestId);
      return tableId ? guestsByStation.delete(tableId) : false;
    },
    getServicePoint: (tableId) => resolvedServicePoints[tableId] ?? servicePoint,
    reserveExactItem: (guestId, tableId, exactItemId) => reserveServingItem(
      kitchen, guestId, [tableId], exactItemId,
    ),
    releaseReservation: (guestId, tableId) => releaseServingReservation(kitchen, guestId, tableId),
    consumeReservation: (guestId, tableId) => consumeServingReservation(kitchen, guestId, tableId),
    onPurchaseComplete: (purchase) => payments.push(purchase),
    getSalePrice,
    createFeedback: () => ({ set: (state) => feedback.push(state), update() {}, destroy() {} }),
  });
  function tick(ms = 10) {
    const paymentsBefore = payments.length;
    runtime.update(ms);
    for (const guest of runtime.getState().guests) {
      if (guest.order.status === "offered") runtime.acceptGuestOrder(guest.id);
    }
    if (payments.length > paymentsBefore) {
      paymentStates.push(runtime.getState().guests.find(({ id }) => id === payments.at(-1).guestId)?.state ?? null);
    }
    states.push(...runtime.getState().guests.map((guest) => guest.state));
    for (const [id, actor] of actors) {
      const direction = controllers.get(id).getCommand().moveDirection;
      actor.motor.position.x += direction.x * 6;
      actor.motor.position.y += direction.y * 6;
    }
  }
  function spawn(index = 1, exactItemId = itemId ?? Object.values(tableStocks).find((stock) => stock.itemId)?.itemId) {
    return runtime.spawnVisit(`person-test-${index}`, exactItemId, [exactItemId], { serviceFormat });
  }
  function finish(limit = 1200) {
    for (let index = 0; index < limit && runtime.getState().active; index += 1) tick();
  }
  return { kitchen, serviceState, runtime, payments, paymentStates, feedback, states, tick, finish, spawn };
}

function advanceScenarioUntil(activeScenario, predicate, limit = 600) {
  for (let index = 0; index < limit && !predicate(); index += 1) activeScenario.tick();
  assert(predicate(), "guest scenario reached its expected live-service state");
}

const closed = scenario({ open: false, itemId: "lemonade" });
assert.equal(closed.spawn(), "tavern-guest-1");
closed.finish();
assert(closed.states.includes(GUEST_STATES.checkingSign));
assert.equal(closed.states.includes(GUEST_STATES.entering), false);
assert.equal(closed.kitchen.servingTables["serving-1"].quantity, 1);
assert.deepEqual(closed.kitchen.servingTables["serving-1"].reservations, []);

const takeout = scenario({ open: true, itemId: "lemonade", serviceFormat: "takeaway" });
assert.equal(takeout.spawn(), "tavern-guest-1");
takeout.finish();
assert(takeout.feedback.includes("carrying-lemonade"));
assert.equal(takeout.states.includes(GUEST_STATES.eating), false);
assert.deepEqual(takeout.payments.map(({ itemId, value }) => ({ itemId, value })), [{ itemId: "lemonade", value: 2 }]);
assert.deepEqual(takeout.paymentStates, [GUEST_STATES.leaving], "takeout payment exists as soon as the guest starts leaving");

const dineIn = scenario({ open: true, itemId: "fried-potato-dish" });
assert.equal(dineIn.spawn(), "tavern-guest-1");
dineIn.finish();
assert(dineIn.states.includes(GUEST_STATES.eating));
assert.equal(dineIn.states.includes("carrying-to-seat"), false, "dine-in food never leaves its service-capable table");
assert.deepEqual(dineIn.payments.map(({ itemId, value }) => ({ itemId, value })), [{ itemId: "fried-potato-dish", value: 4 }]);

const blockedDoorTarget = scenario({
  open: true,
  itemId: "fried-potato-dish",
  servicePoint: { x: 72, y: 110 },
  isBlockedBox: (box) => box.right > 16 && box.left < 32 && box.bottom > 88 && box.top < 104,
});
assert.equal(blockedDoorTarget.spawn(), "tavern-guest-1");
blockedDoorTarget.finish();
assert.equal(blockedDoorTarget.states.includes(GUEST_STATES.entering), false, "guest does not enter the house before visiting an outdoor service point");
assert(blockedDoorTarget.states.includes(GUEST_STATES.approachingOrder), "guest walks directly from the sign to the outdoor service point");
assert(blockedDoorTarget.states.includes(GUEST_STATES.eating), "guest continues service while the unused door target is obstructed");

const multi = scenario({
  open: true,
  servingTables: {
    "serving-1": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
    "serving-2": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
  },
  servicePoints: {
    "serving-1": { x: 72, y: 46 },
    "serving-2": { x: 88, y: 46 },
  },
});
assert.equal(multi.spawn(), "tavern-guest-1");
assert.equal(multi.spawn(2), "tavern-guest-2");
advanceScenarioUntil(multi, () => Object.values(multi.kitchen.servingTables)
  .reduce((total, stock) => total + stock.reservations.length, 0) === 2);
assert.equal(multi.runtime.getState().activeCount, 2);
assert.deepEqual(multi.runtime.getState().guests.map(({ id }) => id), ["tavern-guest-1", "tavern-guest-2"]);
assert.equal(multi.kitchen.servingTables["serving-1"].reservations.length, 1);
assert.equal(multi.kitchen.servingTables["serving-2"].reservations.length, 1);

const multiTable = scenario({
  open: true,
  servingTables: {
    "serving-left": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
    "serving-right": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
  },
  servicePoints: {
    "serving-left": { x: 56, y: 46 },
    "serving-right": { x: 88, y: 46 },
  },
  seatPoints: {
    "dining-left": { x: 104, y: 78 },
    "dining-right": { x: 136, y: 78 },
  },
});
assert.equal(multiTable.spawn(), "tavern-guest-1");
assert.equal(multiTable.spawn(2), "tavern-guest-2");
advanceScenarioUntil(multiTable, () => multiTable.runtime.getState().guests.every(({ servingTableId }) => servingTableId));
const assigned = multiTable.runtime.getState().guests;
assert.deepEqual(assigned.map(({ servingTableId }) => servingTableId), ["serving-left", "serving-right"]);
assert.deepEqual(assigned.map(({ diningTableId }) => diningTableId), [null, null]);
multiTable.finish();
assert.equal(multiTable.payments.length, 2, "two guests finish service through distinct service-capable tables");

const takeoutWithBusyDining = scenario({
  open: true,
  servingTables: {
    "serving-meal": { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
    "serving-takeout": { itemId: "lemonade", quantity: 1, reservations: [] },
  },
  servicePoints: {
    "serving-meal": { x: 56, y: 46 },
    "serving-takeout": { x: 88, y: 46 },
  },
  seatPoints: {},
});
assert.equal(takeoutWithBusyDining.spawn(1, "lemonade"), "tavern-guest-1");
advanceScenarioUntil(takeoutWithBusyDining, () => (
  takeoutWithBusyDining.runtime.getState().guests[0]?.servingTableId === "serving-takeout"
));
const busyDiningGuest = takeoutWithBusyDining.runtime.getState().guests[0];
assert.equal(busyDiningGuest.itemId, "lemonade");
assert.equal(busyDiningGuest.servingTableId, "serving-takeout");
assert.equal(busyDiningGuest.diningTableId, null);

let playerPosition = { x: 0, y: 0 };
let collectedValue = 0;
const coinScene = {
  add: {
    graphics() {
      return {
        x: 0, y: 0,
        setDepth() { return this; },
        fillStyle() { return this; },
        fillRect() { return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        destroy() {},
      };
    },
  },
};
const coinRuntime = createCoinRuntime(coinScene, {
  getPlayerPosition: () => playerPosition,
  onCollect: ({ value }) => { collectedValue += value; },
});
coinRuntime.spawn({ x: 80, y: 80 }, 4);
for (let index = 0; index < 30 && !coinRuntime.getState()[0].landed; index += 1) coinRuntime.update(50);
const landedCoin = coinRuntime.getState()[0];
playerPosition = { x: landedCoin.x, y: landedCoin.y };
coinRuntime.update(16);
assert.equal(collectedValue, 4);
assert.equal(coinRuntime.getState().length, 0);

console.log("Guest/pathfinding checks passed: live multi-guest service places, table consumption and payment values");
