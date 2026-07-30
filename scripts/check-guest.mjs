import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CharacterSystem } from "../src/characterSystem.js";
import { createCoinRuntime } from "../src/coinRuntime.js";
import {
  consumeServingReservation,
  normalizeKitchenState,
  releaseServingReservation,
  reserveServingItem,
} from "../src/cookingDomain.js";
import { createGuestController } from "../src/guestController.js";
import { GUEST_STATES, createGuestRuntime } from "../src/guestRuntime.js";
import { createActorNavigation, createActorWalkability, findGridPath } from "../src/gridPathfinder.js";
import { createFreshGameSessionState } from "../src/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/sessionPersistence.js";

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
assert.equal(SAVE_SCHEMA_VERSION, 11);
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.gameplay.tavernOpen, false);
assert.equal(migrated.state.gameplay.coins, 0);
assert.deepEqual(migrated.state.gameplay.tavernService.guests, []);

const signPng = readFileSync(new URL("../public/assets/project/facilities/NestledBurrow_TavernSign.png", import.meta.url));
assert.equal(signPng.readUInt32BE(16), 64);
assert.equal(signPng.readUInt32BE(20), 32);
assert.equal(signPng.byteLength, 2981);
assert.equal(createHash("sha256").update(signPng).digest("hex"), "47b15a21480a0096e4541900425dd0d870d9f50d1401d12832a6828abeaef154");

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

function scenario({ open, itemId, quantity = 1 }) {
  const kitchen = normalizeKitchenState({
    servingTable: { itemId, quantity, reservations: [] },
  });
  const serviceState = { spawnRemainingMs: 8_000, nextGuestId: 0, guests: [] };
  const actors = new Map();
  const controllers = new Map();
  const payments = [];
  const feedback = [];
  const states = [];
  const paymentStates = [];
  const runtime = createGuestRuntime({
    config: runtimeConfig,
    serviceState,
    worldLayout: { bounds, cellSize: 8, isBlockedCell: () => false, isBlockedBox: () => false },
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
    getServicePoint: () => ({ x: 72, y: 46 }),
    getSeatPoint: () => ({ x: 120, y: 78 }),
    getAvailablePortions: () => kitchen.servingTable.quantity - kitchen.servingTable.reservations.length,
    reserveItem: (guestId) => reserveServingItem(kitchen, guestId),
    releaseReservation: (guestId) => releaseServingReservation(kitchen, guestId),
    consumeReservation: (guestId) => consumeServingReservation(kitchen, guestId),
    onPurchaseComplete: (purchase) => payments.push(purchase),
    randomSource: () => 0,
    createFeedback: () => ({ set: (state) => feedback.push(state), update() {}, destroy() {} }),
  });
  function tick(ms = 10) {
    const paymentsBefore = payments.length;
    runtime.update(ms);
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
  function finish(limit = 1200) {
    for (let index = 0; index < limit && runtime.getState().active; index += 1) tick();
  }
  return { kitchen, serviceState, runtime, payments, paymentStates, feedback, states, tick, finish };
}

const closed = scenario({ open: false, itemId: "lemonade" });
assert.equal(closed.runtime.forceSpawn(), "tavern-guest-1");
closed.finish();
assert(closed.states.includes(GUEST_STATES.checkingSign));
assert.equal(closed.states.includes(GUEST_STATES.entering), false);
assert.equal(closed.kitchen.servingTable.quantity, 1);
assert.deepEqual(closed.kitchen.servingTable.reservations, []);

const takeout = scenario({ open: true, itemId: "lemonade" });
assert.equal(takeout.runtime.forceSpawn(), "tavern-guest-1");
takeout.finish();
assert(takeout.feedback.includes("carrying-lemonade"));
assert.equal(takeout.states.includes(GUEST_STATES.eating), false);
assert.deepEqual(takeout.payments.map(({ itemId, value }) => ({ itemId, value })), [{ itemId: "lemonade", value: 2 }]);
assert.deepEqual(takeout.paymentStates, [GUEST_STATES.leaving], "takeout payment exists as soon as the guest starts leaving");

const dineIn = scenario({ open: true, itemId: "fried-potato-dish" });
assert.equal(dineIn.runtime.forceSpawn(), "tavern-guest-1");
dineIn.finish();
assert(dineIn.states.includes(GUEST_STATES.carryingToSeat));
assert(dineIn.states.includes(GUEST_STATES.eating));
assert.deepEqual(dineIn.payments.map(({ itemId, value }) => ({ itemId, value })), [{ itemId: "fried-potato-dish", value: 4 }]);

const multi = scenario({ open: true, itemId: "lemonade", quantity: 2 });
assert.equal(multi.runtime.forceSpawn(), "tavern-guest-1");
assert.equal(multi.runtime.forceSpawn(), "tavern-guest-2");
assert.equal(multi.runtime.getState().activeCount, 2);
assert.deepEqual(multi.runtime.getState().guests.map(({ id }) => id), ["tavern-guest-1", "tavern-guest-2"]);
assert.equal(multi.kitchen.servingTable.reservations.length, 2);

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

console.log("Guest/pathfinding checks passed: persisted multi-guest takeout, dine-in, reservations and payment values");
