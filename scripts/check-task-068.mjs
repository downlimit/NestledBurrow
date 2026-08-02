import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collides } from "../src/character/movement.js";
import { createInventoryItem } from "../src/inventory/inventoryDomain.js";
import { useCombatNumberSlot } from "../src/inventory/combatQuickUse.js";
import {
  createWildAtollArenaResources,
  getWildAtollArenaDefinition,
  getWildAtollExitPoint,
  WILD_ATOLL_ARENAS,
  WILD_ATOLL_SEGMENTS,
  WILD_ATOLL_STARTER_ARENAS,
  WILD_ATOLL_STARTER_LEVELS,
} from "../src/world/wildAtollDomain.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "../src/world/worldLocationConfig.js";
import { getResourceProfile, resolveActionHp, resourceActionForTool } from "../src/resources/resourceDomain.js";
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
  assert.equal(useCombatNumberSlot(gameplay, 4).status, "used");
  assert.equal(gameplay.needs.satiety, 65);
  assert.equal(gameplay.combatLoadout.slots[4].quantity, 1);
  assert.equal(useCombatNumberSlot(gameplay, 5).status, "used");
  assert.equal(gameplay.needs.lustre, 55);
  assert.equal(gameplay.farm.waterBucket.currentWater, 1);
}

{
  const gameplay = gameplayFixture();
  gameplay.needs.lustre = 100;
  assert.equal(useCombatNumberSlot(gameplay, 5).status, "need-full");
  assert.equal(gameplay.farm.waterBucket.currentWater, 2);
}

{
  assert.deepEqual(WILD_ATOLL_STARTER_LEVELS.map((level) => level.length), [1, 2, 2, 2, 1]);
  assert.equal(WILD_ATOLL_STARTER_ARENAS.length, 8, "starter segment contains eight arenas");
  assert.equal(new Set(WILD_ATOLL_STARTER_ARENAS).size, 8, "starter arena IDs are unique");
  const levelByArena = new Map(WILD_ATOLL_STARTER_LEVELS.flatMap((level, levelIndex) => (
    level.map((arenaId) => [arenaId, levelIndex])
  )));
  for (const arenaId of WILD_ATOLL_STARTER_ARENAS) {
    const definition = getWildAtollArenaDefinition(arenaId);
    assert.equal(definition.segmentId, WILD_ATOLL_SEGMENTS.starter);
    for (const exit of definition.exits.filter((entry) => entry.kind === "path")) {
      assert.equal(
        levelByArena.get(exit.targetArenaId),
        levelByArena.get(arenaId) + 1,
        `${arenaId} advances exactly one arena level`,
      );
    }
  }
  const root = getWildAtollArenaDefinition(WILD_ATOLL_ARENAS.root);
  const rootPaths = root.exits.filter((exit) => exit.kind === "path");
  assert.deepEqual(rootPaths.map((exit) => exit.targetArenaId), [WILD_ATOLL_ARENAS.meadow, WILD_ATOLL_ARENAS.stones]);
  const rootPoints = rootPaths.map((exit) => getWildAtollExitPoint(exit.direction, TILE_SIZE));
  assert(rootPoints.every((point) => point.y < ATOLL_WORLD_MODEL.spawn.y), "both second-arena exits are north of the entry spawn");
  assert(Math.abs(rootPoints[0].x - rootPoints[1].x) > 2 * 44, "starter choices have separate interaction zones");

  const terminal = getWildAtollArenaDefinition(WILD_ATOLL_ARENAS.edge);
  assert.equal(terminal.terminal, true);
  assert.equal(terminal.resources.length, 0, "terminal arena is a decision/return arena without resource clutter");
  assert.deepEqual(
    terminal.exits.filter((exit) => exit.kind === "segment").map((exit) => exit.targetSegmentId),
    [WILD_ATOLL_SEGMENTS.forestT1, WILD_ATOLL_SEGMENTS.mineT1],
  );
  assert.equal(terminal.exits.filter((exit) => exit.kind === "teleport" && exit.targetWorldId === WORLD_IDS.nest).length, 1);
  for (const arenaId of WILD_ATOLL_STARTER_ARENAS.filter((id) => id !== WILD_ATOLL_ARENAS.edge)) {
    assert.equal(getWildAtollArenaDefinition(arenaId).exits.some((exit) => exit.kind === "teleport"), false);
  }
}

{
  const first = createWildAtollArenaResources("task-068", "run", WILD_ATOLL_ARENAS.root);
  const repeated = createWildAtollArenaResources("task-068", "run", WILD_ATOLL_ARENAS.root);
  assert.deepEqual(first, repeated, "resource placement is deterministic for one run seed");
  assert.deepEqual(first.map((definition) => definition.profileId).sort(), ["berry-bush", "log-small", "stone-small"]);
  assert(first.every((definition) => definition.kind === "work-resource"), "Atoll uses ordinary resource interaction definitions");
  assert.equal(first.find((definition) => definition.profileId === "log-small").prompt, "hud:interaction.chop");
  assert.equal(first.find((definition) => definition.profileId === "stone-small").prompt, "hud:interaction.mine");
  assert.equal(first.find((definition) => definition.profileId === "berry-bush").prompt, "hud:interaction.gatherBerries");
  assert.equal(createInventoryItem("berry").kind, "loot");

  const log = getResourceProfile("log-small");
  const stone = getResourceProfile("stone-small");
  const berries = getResourceProfile("berry-bush");
  assert.equal(resolveActionHp(log, "chop", { smallLogChopHp: 7 }), 7, "Atoll log keeps common log HP");
  assert.equal(resolveActionHp(stone, "mine", {}), 7, "Atoll stone keeps common stone HP");
  assert.equal(resourceActionForTool(log, "axe"), "chop");
  assert.equal(resourceActionForTool(stone, "pickaxe"), "mine");
  assert.equal(resourceActionForTool(berries, null), "gather");
}

{
  const coordinator = createWorldLocationCoordinator({
    sessionState: { currentWorldId: WORLD_IDS.atoll },
    createLayout: (worldId) => createWorldLayout(worldId),
  });
  const layout = coordinator.createInitialLayout();
  assert.equal(layout.transitions.length, 0, "Atoll world has no hidden persistent transport assets");
  assert.equal(collides(ATOLL_WORLD_MODEL.spawn, layout, 8, 5), false, "arena entry spawn is collision-safe");
  for (const arenaId of WILD_ATOLL_STARTER_ARENAS) {
    for (const definition of createWildAtollArenaResources("task-068", "run", arenaId)) {
      assert.equal(collides(definition.position, layout, 8, 5), false, `${definition.id} starts on walkable terrain`);
      assert.ok(
        Math.hypot(definition.position.x - ATOLL_WORLD_MODEL.spawn.x, definition.position.y - ATOLL_WORLD_MODEL.spawn.y) > 20,
        `${definition.id} leaves the entry spawn clear`,
      );
    }
  }
}

{
  assert(runtimeSource.includes("registerResource"), "Atoll registers nodes with DebrisRuntime");
  assert(runtimeSource.includes("unregisterResource"), "Atoll removes transient nodes through DebrisRuntime");
  assert(!runtimeSource.includes("workResource("), "Atoll has no private resource-hit implementation");
  assert(runtimeSource.includes("const INTERACTION_RADIUS = 44"), "starter exits have a usable interaction radius");
  assert(runtimeSource.includes("createTrailExit"), "ordinary arena exits are visibly represented");
  assert(runtimeSource.includes("availableExitIds"), "preview diagnostics expose current arena choices");
  assert(runtimeSource.includes("COLLAPSE_FADE_OUT_MS = 5000"));
  assert(runtimeSource.includes("COLLAPSE_FADE_IN_MS = 3000"));
  assert(runtimeSource.includes("beginCollapseRecovery"));
  assert(runtimeSource.includes("value === key || value === namespaceFreeKey"), "technical localization keys fail closed");
  assert(!runtimeSource.toLowerCase().includes("forecast"));
  for (const [locale, atoll] of [["ru", ruHud.atoll], ["en", enHud.atoll]]) {
    for (const [key, value] of flatten(atoll)) {
      assert(!/[—–?]/u.test(value), `${locale} Atoll label ${key} uses supported punctuation`);
      assert(value.length <= 40, `${locale} Atoll label ${key} fits the compact HUD budget`);
      assert(!/^(?:hud:)?atoll\./.test(value), `${locale} Atoll label ${key} is not a technical key`);
    }
  }
}

console.log("Task #068 contracts OK");

function flatten(value, prefix = "") {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === "object" && !Array.isArray(entry)
      ? flatten(entry, path)
      : [[path, String(entry)]];
  });
}
