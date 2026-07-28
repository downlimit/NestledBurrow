import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CharacterSystem } from "../src/characterSystem.js";
import { createCoinRuntime } from "../src/coinRuntime.js";
import { createGuestController } from "../src/guestController.js";
import { GUEST_STATES, createGuestRuntime } from "../src/guestRuntime.js";
import { createActorNavigation, createActorWalkability, findGridPath } from "../src/gridPathfinder.js";
import { createFreshGameSessionState } from "../src/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/sessionPersistence.js";

const bounds = { left: 0, top: 0, right: 160, bottom: 160 };
const clearPath = findGridPath({ start: { x: 8, y: 14 }, goal: { x: 72, y: 78 }, bounds, isWalkable: () => true });
assert(clearPath.length > 0, "A* finds a path on a clear grid");
assert(clearPath.some((point) => point.x > 8 && point.y > 14), "A* uses eight-direction movement");

const blocked = new Set(["2,1", "2,2", "2,3"]);
const detour = findGridPath({ start: { x: 8, y: 30 }, goal: { x: 72, y: 30 }, bounds, isWalkable: (cell) => !blocked.has(`${cell.x},${cell.y}`) });
assert(detour.some((point) => point.y !== 30), "A* routes around obstacles");
assert.equal(findGridPath({ start: { x: 8, y: 30 }, goal: { x: 72, y: 30 }, bounds, isWalkable: (cell) => cell.x < 2 || cell.x > 2 }), null, "A* returns null without a route");

const cornerBlocked = new Set(["1,0", "0,1"]);
const noCornerCut = findGridPath({ start: { x: 8, y: 14 }, goal: { x: 24, y: 30 }, bounds: { left: 0, top: 0, right: 32, bottom: 32 }, isWalkable: (cell) => !cornerBlocked.has(`${cell.x},${cell.y}`) });
assert.equal(noCornerCut, null, "A* cannot cross a closed diagonal corner");

const blockedStart = findGridPath({
  start: { x: 24, y: 30 },
  goal: { x: 72, y: 30 },
  bounds,
  isWalkable: (cell) => cell.x !== 1,
});
assert(blockedStart?.length > 0, "replan recovers from a current position whose cell center became blocked");

let boxChecks = 0;
const walkability = createActorWalkability({
  bounds,
  cellSize: 8,
  isBlockedCell: () => false,
  isBlockedBox: (box) => { boxChecks += 1; return box.left >= 32 && box.left < 48; },
}, { cellSize: 16, footWidth: 8, footDepth: 4 });
assert.equal(walkability({ x: 0, y: 0 }), true);
assert.equal(walkability({ x: 2, y: 0 }), false);
assert(boxChecks >= 2, "walkability checks the actor foot box through isBlockedBox");

const thinWall = { left: 46, right: 50, top: 16, bottom: 80 };
const thinWallNavigation = createActorNavigation({
  bounds,
  cellSize: 8,
  isBlockedCell: () => false,
  isBlockedBox: (box) => box.right > thinWall.left && box.left < thinWall.right
    && box.bottom > thinWall.top && box.top < thinWall.bottom,
}, { cellSize: 16, footWidth: 8, footDepth: 4 });
const thinWallDetour = findGridPath({
  start: { x: 24, y: 30 },
  goal: { x: 72, y: 30 },
  bounds,
  ...thinWallNavigation,
});
assert(thinWallDetour?.some((point) => point.y < thinWall.top || point.y > thinWall.bottom), "A* detects a thin build-wall edge between cell centers and routes around an end");

const systemCharacter = { id: "guest", destroyCalls: 0, destroy() { this.destroyCalls += 1; } };
const system = new CharacterSystem({ collisionEnvironment: {} });
system.add(systemCharacter);
assert.equal(system.remove("guest"), true);
assert.equal(systemCharacter.destroyCalls, 1);
assert.equal(system.remove("guest"), false, "CharacterSystem removal is stable by ID");

const legacy = createFreshGameSessionState();
legacy.version = 4;
delete legacy.gameplay.tavernOpen;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 4, state: legacy }));
assert.equal(SAVE_SCHEMA_VERSION, 7);
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.gameplay.tavernOpen, false, "v4 saves migrate tavernOpen to closed");
assert.equal(migrated.state.gameplay.coins, 0, "older saves migrate the coin counter to zero");
assert.equal(createFreshGameSessionState().gameplay.tavernOpen, false, "fresh taverns start closed");

const signPng = readFileSync(new URL("../public/assets/project/facilities/NestledBurrow_TavernSign.png", import.meta.url));
assert.equal(signPng.readUInt32BE(16), 64, "tavern sign sheet contains two 32px frames");
assert.equal(signPng.readUInt32BE(20), 32, "tavern sign matches the 2x2-tile authored size");
assert.equal(signPng.byteLength, 2981, "accepted tavern sign bytes are unchanged");
assert.equal(createHash("sha256").update(signPng).digest("hex"), "47b15a21480a0096e4541900425dd0d870d9f50d1401d12832a6828abeaef154", "accepted tavern sign pixels are unchanged");

const runtimeConfig = Object.freeze({
  id: "guest",
  initialSpawnDelayMs: 10,
  subsequentSpawnDelayMinMs: 100,
  subsequentSpawnDelayMaxMs: 100,
  signCheckMs: 30,
  dishWaitMs: 80,
  eatingMs: 40,
  blockedReplanMs: 30,
  maxReplans: 2,
  arrivalRadius: 5,
  createController: createGuestController,
  points: {
    spawn: { x: 24, y: 142 }, sign: { x: 24, y: 110 }, outsideDoor: { x: 24, y: 94 },
    insideDoor: { x: 24, y: 78 }, service: { x: 72, y: 46 }, seat: { x: 120, y: 78 }, exit: { x: 24, y: 142 },
  },
});

function scenario({ open = false, dish = false } = {}) {
  let character = null;
  let controller = null;
  let consumed = 0;
  let reservations = 0;
  const kitchen = { servingTableHasDish: dish };
  const states = [];
  const feedbackStates = [];
  let servicePoint = { ...runtimeConfig.points.service };
  let seatPoint = { ...runtimeConfig.points.seat };
  const runtime = createGuestRuntime({
    config: runtimeConfig,
    worldLayout: { bounds, cellSize: 8, isBlockedCell: () => false, isBlockedBox: () => false },
    createGuest(nextController) {
      controller = nextController;
      character = {
        id: "guest", footWidth: 8, footDepth: 4, lastBlockedAxes: { x: false, y: false },
        motor: { position: { ...runtimeConfig.points.spawn } },
      };
      return character;
    },
    removeGuest: () => { character = null; return true; },
    getTavernOpen: () => open,
    getKitchenState: () => kitchen,
    getServicePoint: () => servicePoint,
    getSeatPoint: () => seatPoint,
    onReservationChange: (active) => { reservations += active ? 1 : -1; },
    onDishConsumed: () => { consumed += 1; },
    randomSource: () => 0,
    createFeedback: () => ({ set: (value) => feedbackStates.push(value), update() {}, destroy() {} }),
  });
  function tick(ms = 10) {
    runtime.update(ms);
    const state = runtime.getState();
    states.push(state.state);
    if (character && controller) {
      const direction = controller.getCommand().moveDirection;
      character.motor.position.x += direction.x * 6;
      character.motor.position.y += direction.y * 6;
    }
  }
  return { runtime, kitchen, states, feedbackStates, tick, setOpen: (value) => { open = value; }, setServicePoint: (point) => { servicePoint = { ...point }; }, setSeatPoint: (point) => { seatPoint = { ...point }; }, get position() { return character?.motor?.position ?? null; }, get consumed() { return consumed; }, get reservations() { return reservations; } };
}

const closed = scenario();
for (let i = 0; i < 400 && (i < 2 || closed.runtime.getState().active); i += 1) closed.tick();
assert(closed.states.includes(GUEST_STATES.checkingSign));
assert(closed.states.includes(GUEST_STATES.leaving));
assert(closed.feedbackStates.includes("closed-reaction"), "closed sign decision shows the sad reaction");
assert.equal(closed.states.includes(GUEST_STATES.entering), false, "closed guest checks the sign and leaves");

const served = scenario({ open: true, dish: true });
served.tick(20);
assert.equal(served.runtime.forceSpawn(), false, "only one guest can be active");
for (let i = 0; i < 800 && served.runtime.getState().active; i += 1) served.tick();
assert(served.states.includes(GUEST_STATES.entering));
assert(served.states.includes(GUEST_STATES.eating));
assert(served.feedbackStates.includes("checking") && served.feedbackStates.includes("open-reaction"), "sign check shows an ellipsis before the happy reaction");
assert(served.feedbackStates.includes("carrying"), "reserved dish switches on the carried presentation");
assert.equal(served.consumed, 1);
assert.equal(served.kitchen.servingTableHasDish, false, "successful eating consumes exactly one persistent dish");
assert.equal(served.reservations, 0, "successful visit releases its runtime reservation");

const waiting = scenario({ open: true });
for (let i = 0; i < 400 && !waiting.states.includes(GUEST_STATES.waitingForDish); i += 1) waiting.tick();
assert(waiting.states.includes(GUEST_STATES.waitingForDish));
assert(waiting.feedbackStates.includes("empty-reaction"), "empty serving table shows the angry reaction");
waiting.kitchen.servingTableHasDish = true;
for (let i = 0; i < 500 && waiting.runtime.getState().active; i += 1) waiting.tick();
assert.equal(waiting.consumed, 1, "a dish appearing during the wait continues service");

const movedService = scenario({ open: true });
for (let i = 0; i < 500 && movedService.runtime.getState().state !== GUEST_STATES.approachingService; i += 1) movedService.tick();
movedService.setServicePoint({ x: 120, y: 46 });
for (let i = 0; i < 500 && movedService.runtime.getState().state !== GUEST_STATES.waitingForDish; i += 1) movedService.tick();
assert(Math.abs(movedService.position.x - 120) <= runtimeConfig.arrivalRadius + 1, "guest follows a serving table after it moves instead of visiting its old point");

const movedDiningTable = scenario({ open: true, dish: true });
for (let i = 0; i < 600 && movedDiningTable.runtime.getState().state !== GUEST_STATES.carryingToSeat; i += 1) movedDiningTable.tick();
movedDiningTable.setSeatPoint({ x: 40, y: 110 });
for (let i = 0; i < 600 && movedDiningTable.runtime.getState().state !== GUEST_STATES.eating; i += 1) movedDiningTable.tick();
assert(Math.hypot(movedDiningTable.position.x - 40, movedDiningTable.position.y - 110) <= runtimeConfig.arrivalRadius + 1, "guest carrying a dish replans to the dining table's live eating zone");

const guestConfigSource = readFileSync(new URL("../src/guestConfig.js", import.meta.url), "utf8");
assert(!guestConfigSource.includes("service: footPoint") && !guestConfigSource.includes("seat: footPoint"), "movable furniture targets are never duplicated as static guest coordinates");

const timeout = scenario({ open: true });
for (let i = 0; i < 800 && (i < 2 || timeout.runtime.getState().active); i += 1) timeout.tick();
assert(timeout.states.includes(GUEST_STATES.waitingForDish));
assert(timeout.states.includes(GUEST_STATES.leaving), "dish wait times out into leaving");

const teardown = scenario({ open: true, dish: true });
for (let i = 0; i < 500 && teardown.runtime.getState().state !== GUEST_STATES.eating; i += 1) teardown.tick();
assert.equal(teardown.runtime.getState().reservedDish, true);
teardown.runtime.destroy();
assert.equal(teardown.kitchen.servingTableHasDish, true, "teardown before eating preserves the persistent dish");
assert.equal(teardown.reservations, 0, "teardown releases the runtime reservation");

assert(served.feedbackStates.includes("meal-complete"), "completed eating shows the thumbs-up reaction");

let playerPosition = { x: 0, y: 0 };
let collectedCoins = 0;
const coinVisuals = [];
const coinScene = {
  add: {
    graphics() {
      const visual = {
        x: 0, y: 0, destroyed: false,
        setDepth() { return this; }, fillStyle() { return this; }, fillRect() { return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; }, destroy() { this.destroyed = true; },
      };
      coinVisuals.push(visual);
      return visual;
    },
  },
};
const coinRuntime = createCoinRuntime(coinScene, {
  getPlayerPosition: () => playerPosition,
  onCollect: () => { collectedCoins += 1; },
});
coinRuntime.spawn({ x: 80, y: 80 });
const startCoinY = coinRuntime.getState()[0].y;
coinRuntime.update(100);
assert(coinRuntime.getState()[0].y < startCoinY, "coin launches upward before falling");
for (let i = 0; i < 30 && !coinRuntime.getState()[0].landed; i += 1) coinRuntime.update(50);
const landedCoin = coinRuntime.getState()[0];
assert(landedCoin.landed && landedCoin.x > 80, "coin follows an outward arc and lands on the floor");
playerPosition = { x: landedCoin.x, y: landedCoin.y };
coinRuntime.update(16);
assert.equal(collectedCoins, 1, "touching the landed coin collects it exactly once");
assert.equal(coinRuntime.getState().length, 0);

console.log("Guest/pathfinding contract check passed.");
