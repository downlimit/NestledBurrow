import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collides } from "../src/character/movement.js";
import { createInventoryItem } from "../src/inventory/inventoryDomain.js";
import { useCombatNumberSlot } from "../src/inventory/combatQuickUse.js";
import {
  createWildAtollArenaNodes,
  getWildAtollArenaDefinition,
  WILD_ATOLL_ARENAS,
  WILD_ATOLL_STARTER_PATH,
} from "../src/world/wildAtollDomain.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "../src/world/worldLocationConfig.js";
import { TILE_SIZE } from "../src/world/worldConfig.js";

const runtimeSource = readFileSync("src/world/wildAtollRuntime.js", "utf8");
const ruHud = JSON.parse(readFileSync("public/locales/ru/hud.json", "utf8"));
const enHud = JSON.parse(readFileSync("public/locales/en/hud.json", "utf8"));

function gameplayFixture() {
  return {
    currentEnergy: 80,
    needs: { novelty: 50, satiety: 40, toilet: 50, lustre: 35, dialogue: 50 },
    farm: { waterBucket: { currentWater: 2, capacity: 8 } },
    combatLoadout: {
      slots: [null, null, null, null,
        { id: "fried-potato-dish", kind: "loot", quantity: 2 },
        { id: "water-bucket", kind: "tool", quantity: 1 },
        null, null, null, null],
    },
  };
}

{
  const gameplay = gameplayFixture();
  const ration = useCombatNumberSlot(gameplay, 4);
  assert.equal(ration.status, "used");
  assert.equal(gameplay.needs.satiety, 65);
  assert.equal(gameplay.combatLoadout.slots[4].quantity, 1);
  const wash = useCombatNumberSlot(gameplay, 5);
  assert.equal(wash.status, "used");
  assert.equal(gameplay.needs.lustre, 55);
  assert.equal(gameplay.farm.waterBucket.currentWater, 1);
  assert.equal(gameplay.combatLoadout.slots[5].id, "water-bucket");
}

{
  const gameplay = gameplayFixture();
  gameplay.needs.lustre = 100;
  const result = useCombatNumberSlot(gameplay, 5);
  assert.equal(result.status, "need-full");
  assert.equal(gameplay.farm.waterBucket.currentWater, 2);
}

{
  assert.deepEqual(WILD_ATOLL_STARTER_PATH, ["edge", "grove", "fork"]);
  const edge = getWildAtollArenaDefinition(WILD_ATOLL_ARENAS.edge);
  const grove = getWildAtollArenaDefinition(WILD_ATOLL_ARENAS.grove);
  const fork = getWildAtollArenaDefinition(WILD_ATOLL_ARENAS.fork);
  assert.equal(edge.exits.filter((exit) => exit.target === "nest").length, 1, "only the edge arena returns to the Nest");
  assert.equal(grove.exits.some((exit) => exit.target === "nest"), false);
  assert.equal(fork.exits.filter((exit) => exit.cave).length, 2, "the starter fork exposes exactly two lifts");
  assert.deepEqual(fork.exits.filter((exit) => exit.cave).map((exit) => exit.target), ["forest", "mine"]);
}

{
  const first = createWildAtollArenaNodes("task-068", WILD_ATOLL_ARENAS.edge);
  const repeated = createWildAtollArenaNodes("task-068", WILD_ATOLL_ARENAS.edge);
  assert.deepEqual(first, repeated, "arena resource placement is deterministic for one run seed");
  assert.deepEqual(first.map((node) => node.kind).sort(), ["berry", "log", "stone"]);
  assert.equal(first.find((node) => node.kind === "log").requiredTool, "axe");
  assert.equal(first.find((node) => node.kind === "stone").requiredTool, "pickaxe");
  assert.equal(first.find((node) => node.kind === "berry").requiredTool, null);
  assert.equal(createInventoryItem("berry").kind, "loot", "berries remain ordinary forward-compatible inventory loot");
}

{
  const forest = createWildAtollArenaNodes("task-068", WILD_ATOLL_ARENAS.forest);
  const mine = createWildAtollArenaNodes("task-068", WILD_ATOLL_ARENAS.mine);
  assert.ok(forest.filter((node) => node.kind === "log").length > forest.filter((node) => node.kind === "stone").length);
  assert.ok(mine.filter((node) => node.kind === "stone").length > mine.filter((node) => node.kind === "log").length);
}

{
  const coordinator = createWorldLocationCoordinator({
    sessionState: { currentWorldId: WORLD_IDS.atoll },
    createLayout: (worldId) => createWorldLayout(worldId),
  });
  const layout = coordinator.createInitialLayout();
  assert.equal(layout.transitions.length, 0, "Atoll has no persistent transport assets beneath arena presentation");
  assert.equal(collides(ATOLL_WORLD_MODEL.spawn, layout, 8, 5), false, "entry spawn is collision-safe");
  for (const arenaId of Object.values(WILD_ATOLL_ARENAS)) {
    for (const node of createWildAtollArenaNodes("task-068", arenaId)) {
      const point = { x: node.tileX * TILE_SIZE + 8, y: node.tileY * TILE_SIZE + 9 };
      assert.equal(collides(point, layout, 8, 5), false, `${arenaId}:${node.index} starts on walkable arena terrain`);
      assert.ok(Math.hypot(point.x - ATOLL_WORLD_MODEL.spawn.x, point.y - ATOLL_WORLD_MODEL.spawn.y) > 16, `${arenaId}:${node.index} does not trap the entry spawn`);
    }
  }
}

{
  assert(runtimeSource.includes("const TITLE_Y = 112"), "arena title stays below the top HUD controls");
  assert(runtimeSource.includes("WORLD_IDS.atoll"), "arena runtime mounts in the isolated Atoll world");
  assert(!runtimeSource.includes("forecast"), "forecast marker and abstract arena forecast are removed");
  for (const [locale, atoll] of [["ru", ruHud.atoll], ["en", enHud.atoll]]) {
    for (const [key, value] of Object.entries(atoll)) {
      assert(!/[—–?]/u.test(value), `${locale} Atoll label ${key} uses only supported glyphs`);
    }
  }
}

console.log("Task #068 contracts OK");
