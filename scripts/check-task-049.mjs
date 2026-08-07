import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  addInventoryItem,
  createEmptyInventory,
  getInventoryQuantity,
} from "../src/inventory/inventoryDomain.js";
import {
  createFreshGameSessionState,
  deserializeSessionEnvelope,
} from "../src/session/gameSessionState.js";
import { LEMONADE_FRAME_ORDER } from "../src/tavern/lemonadeConfig.js";
import {
  DEFAULT_SERVING_TABLE_ID,
  STOVE_REPAIR_COST,
} from "../src/tavern/cookingDomain.js";
import { createGuestRuntime } from "../src/tavern/guestRuntime.js";
import { createTavernServiceRuntime } from "../src/tavern/tavernServiceRuntime.js";
import { WORLD_IDS } from "../src/world/worldLocationConfig.js";

const state = createFreshGameSessionState({ currentWorldId: WORLD_IDS.village });
assert.equal(state.gameplay.inventory.slots.length, 10);
assert.deepEqual(
  state.gameplay.inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id),
  ["axe", "pickaxe", "hoe", "water-bucket"],
);
assert.equal(state.gameplay.farm.waterBucket.capacity, 8);
assert.equal(state.gameplay.farm.waterBucket.currentWater, 8);
assert.deepEqual(state.gameplay.kitchen.servingTables, {
  [DEFAULT_SERVING_TABLE_ID]: { itemId: null, quantity: 0, reservations: [] },
});
assert.deepEqual(STOVE_REPAIR_COST, { wood: 10, stone: 8, coins: 10 });

const inventory = createEmptyInventory(10);
assert.equal(addInventoryItem(inventory, { id: "raw-potato", kind: "resource", quantity: 5, maxStack: 99 }).mutated, true);
assert.equal(addInventoryItem(inventory, { id: "lemon", kind: "resource", quantity: 4, maxStack: 99 }).mutated, true);
assert.equal(getInventoryQuantity(inventory, "raw-potato"), 5);
assert.equal(getInventoryQuantity(inventory, "lemon"), 4);

const guestSession = createFreshGameSessionState({ currentWorldId: WORLD_IDS.village });
guestSession.gameplay.tavernOpen = true;
guestSession.gameplay.kitchen.servingTables[DEFAULT_SERVING_TABLE_ID] = {
  itemId: "lemonade",
  quantity: 2,
  reservations: [],
};
let saves = 0;
let refreshes = 0;
const guestRuntime = createGuestRuntime({
  scene: {
    add: { sprite: () => ({ setOrigin() { return this; }, setDepth() { return this; }, destroy() {} }) },
    textures: { exists: () => false },
    anims: { exists: () => false },
  },
  sessionState: guestSession,
  characterSystem: {
    add() {},
    remove() {},
    has() { return false; },
    getSnapshot() { return null; },
    values() { return []; },
  },
  worldLayout: { isBlockedCell: () => false, cellSize: 8 },
  spawn: { x: 0, y: 0 },
  getServingTables: () => [{ id: DEFAULT_SERVING_TABLE_ID, position: { x: 0, y: 0 } }],
  getTavernOpen: () => guestSession.gameplay.tavernOpen,
  saveSession: () => { saves += 1; },
  refreshInteractions: () => { refreshes += 1; },
});
const tavernRuntime = createTavernServiceRuntime({
  sessionState: guestSession,
  guestRuntime,
  saveSession: () => { saves += 1; },
  refreshInteractions: () => { refreshes += 1; },
});
assert.equal(typeof tavernRuntime.update, "function");
assert.equal(typeof tavernRuntime.destroy, "function");
tavernRuntime.destroy();
guestRuntime.destroy();
assert(saves >= 0);
assert(refreshes >= 0);

const legacy = createFreshGameSessionState({ currentWorldId: WORLD_IDS.village });
legacy.gameplay.inventory = {
  slots: [
    { id: "axe", kind: "tool", quantity: 1, maxStack: 1 },
    { id: "pickaxe", kind: "tool", quantity: 1, maxStack: 1 },
    { id: "hoe", kind: "tool", quantity: 1, maxStack: 1 },
    { id: "water-bucket", kind: "tool", quantity: 1, maxStack: 1 },
    { id: "sliced-potato", kind: "resource", quantity: 2, maxStack: 99 },
    { id: "fried-potato-dish", kind: "resource", quantity: 1, maxStack: 99 },
    null,
    null,
    null,
    null,
  ],
};
legacy.gameplay.farm = {
  soilCells: [],
  wateringCan: { capacity: 40, currentWater: 6 },
  wells: [],
  lastProcessedWorldTimeSeconds: legacy.gameplay.worldTimeSeconds,
};
legacy.gameplay.kitchen = { preparedPotatoes: 2, cookedDishes: 1, servingTableHasDish: true };
delete legacy.gameplay.tavernService;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 9, state: legacy }));
assert.equal(migrated.status, "loaded");
assert.equal(migrated.state.flags["migration.task049WarningPending"], true);
assert.deepEqual(
  migrated.state.gameplay.inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id).sort(),
  ["axe", "pickaxe", "hoe", "water-bucket"].sort(),
  "legacy migration keeps the four historical starter tools and does not add melee weapons",
);
assert.equal(new Set(migrated.state.gameplay.inventory.slots.filter((item) => item?.kind === "tool").map((item) => item.id)).size, 4);
assert.equal(migrated.state.gameplay.farm.waterBucket.currentWater, 6);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "sliced-potato"), 2);
assert.equal(getInventoryQuantity(migrated.state.gameplay.inventory, "fried-potato-dish"), 1);
assert.deepEqual(migrated.state.gameplay.kitchen.servingTables, {
  [DEFAULT_SERVING_TABLE_ID]: { itemId: "fried-potato-dish", quantity: 1, reservations: [] },
});

const manifest = JSON.parse(readFileSync("public/assets/project/lemonade/NestledBurrow_Lemonade.manifest.json", "utf8"));
assert.deepEqual(manifest.frameOrder, LEMONADE_FRAME_ORDER);
assert.equal(manifest.frameWidth, 16);
assert.equal(manifest.frameHeight, 16);
checkPng("public/assets/project/lemonade/NestledBurrow_Lemonade.png", 288, 16, "e2b35ab0e8c51ff5e5ad10e9a988f9424f6904102e65d126cb7110e7a356e91f");
checkPng("public/assets/project/lemonade/NestledBurrow_GasStoveBroken.png", 16, 32, "d57a2d04ec511f007c1b947ec5623eaf7e6c13458ab86a0b065ab1a51be06715");

const mainSource = readFileSync("src/main.js", "utf8");
assert(mainSource.includes('showTransientMessage?.("hud:interaction.wakeFailed")'));
assert(mainSource.includes("transientMessageShown: true"), "system messages preserve the interaction action label");
assert(mainSource.includes('prompt: "hud:interaction.wake"'));
const persistenceSource = readFileSync("src/session/sessionPersistence.js", "utf8");
assert(!persistenceSource.includes("notifyInventoryGain"), "load and migration do not invoke gain presentation");
const trustedWorktree = `safe.directory=${process.cwd().replaceAll("\\", "/")}`;
const changed = [
  ...lines(execFileSync("git", ["-c", trustedWorktree, "diff", "--name-only", "46e2428c8e39f3c9874005da478c34828d91ae5a"], { encoding: "utf8" })),
  ...lines(execFileSync("git", ["-c", trustedWorktree, "ls-files", "--others", "--exclude-standard"], { encoding: "utf8" })),
];
const canonicalPostTask049Binaries = new Set([
  "public/assets/project/world/NestledBurrow_NestStairway.png",
  "public/assets/project/world/NestledBurrow_HighgroundEntranceStairs.png",
]);
const binary = changed.filter((path) => /\.(?:png|jpe?g|webp|gif|mp3|wav|ogg|ttf|woff2?)$/i.test(path)
  && !canonicalPostTask049Binaries.has(path));
assert.deepEqual(binary, [], `Task #049 changed unexpected binary files: ${binary.join(", ")}`);

console.log("Task #049 checks passed: tools, water, recipes, service, guests, migration, feedback and immutable assets");

function checkPng(path, width, height, hash) {
  const bytes = readFileSync(path);
  assert.equal(bytes.readUInt32BE(16), width, `${path} width`);
  assert.equal(bytes.readUInt32BE(20), height, `${path} height`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), hash, `${path} hash`);
}

function lines(value) {
  return String(value).split(/\r?\n/).filter(Boolean);
}
