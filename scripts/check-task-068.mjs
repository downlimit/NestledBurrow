import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { collides } from "../src/character/movement.js";
import { createInventoryItem } from "../src/inventory/inventoryDomain.js";
import { useCombatNumberSlot } from "../src/inventory/combatQuickUse.js";
import {
  createWildAtollArenaResources,
  getWildAtollArenaDefinition,
  getWildAtollSegmentDefinition,
  WILD_ATOLL_ALL_ARENAS,
  WILD_ATOLL_ARENAS,
  WILD_ATOLL_SEGMENT_IDS,
  WILD_ATOLL_SEGMENTS,
  WILD_ATOLL_STARTER_LEVELS,
} from "../src/world/wildAtollDomain.js";
import { createWorldLayout } from "../src/world/worldLayout.js";
import { createWorldLocationCoordinator } from "../src/world/worldLocationCoordinator.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "../src/world/worldLocationConfig.js";
import { getResourceProfile, resolveActionHp, resourceActionForTool } from "../src/resources/resourceDomain.js";

const runtimeSource = readFileSync("src/world/wildAtollRuntime.js", "utf8");
const localesSource = readFileSync("src/localization/locales.js", "utf8");
const wildAtollDoc = readFileSync("systems/wild-atoll.md", "utf8");
const gameDoc = readFileSync("GAME.md", "utf8");
const ruAtoll = JSON.parse(readFileSync("public/locales/ru/atoll.json", "utf8"));
const enAtoll = JSON.parse(readFileSync("public/locales/en/atoll.json", "utf8"));

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
  assert.equal(WILD_ATOLL_SEGMENT_IDS.length, 11, "the complete canonical route tree exists");
  assert.equal(WILD_ATOLL_ALL_ARENAS.length, 88, "every segment contains eight arenas");
  assert.equal(new Set(WILD_ATOLL_ALL_ARENAS).size, 88, "all arena IDs are unique");

  for (const segmentId of WILD_ATOLL_SEGMENT_IDS) {
    const segment = getWildAtollSegmentDefinition(segmentId);
    assert.deepEqual(segment.levels.map((level) => level.length), [1, 2, 2, 2, 1], `${segmentId} keeps the common arena graph`);
    assert.equal(segment.arenaIds.length, 8);
    const levelByArena = new Map(segment.levels.flatMap((level, levelIndex) => (
      level.map((arenaId) => [arenaId, levelIndex])
    )));
    for (const arenaId of segment.arenaIds) {
      const definition = getWildAtollArenaDefinition(arenaId);
      assert.equal(definition.segmentId, segmentId);
      for (const exit of definition.exits.filter((entry) => entry.kind === "path")) {
        assert.equal(levelByArena.get(exit.targetArenaId), levelByArena.get(arenaId) + 1, `${arenaId} advances one arena level`);
      }
    }

    const entryDirections = getWildAtollArenaDefinition(segment.entryArenaId).exits
      .filter((exit) => exit.kind === "path")
      .map((exit) => exit.direction);
    assert.deepEqual(
      entryDirections,
      ["north-west", "north-east"],
      `${segmentId} entry paths derive from center-to-left/right lane geometry`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[1][0]).exits.map((exit) => exit.direction),
      ["north", "north-east"],
      `${segmentId} left arena opens straight and inward-right`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[1][1]).exits.map((exit) => exit.direction),
      ["north-west", "north"],
      `${segmentId} right arena opens inward-left and straight`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[2][0]).exits.map((exit) => exit.direction),
      ["north", "north-east"],
      `${segmentId} second left arena keeps the composition`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[2][1]).exits.map((exit) => exit.direction),
      ["north-west", "north"],
      `${segmentId} second right arena keeps the composition`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[3][0]).exits.map((exit) => exit.direction),
      ["north-east"],
      `${segmentId} final left lane converges diagonally to the threshold`,
    );
    assert.deepEqual(
      getWildAtollArenaDefinition(segment.levels[3][1]).exits.map((exit) => exit.direction),
      ["north-west"],
      `${segmentId} final right lane converges diagonally to the threshold`,
    );

    const terminal = getWildAtollArenaDefinition(segment.terminalArenaId);
    assert.equal(terminal.terminal, true);
    assert.equal(terminal.resources.length, 0, `${segmentId} threshold is reserved for route choice and return`);
    assert.equal(terminal.exits.filter((exit) => exit.kind === "teleport" && exit.targetWorldId === WORLD_IDS.nest).length, 1);
    const transitions = terminal.exits.filter((exit) => exit.kind === "segment");
    if (transitions.length === 2) {
      assert.deepEqual(
        transitions.map((exit) => exit.direction),
        ["north-west", "north-east"],
        `${segmentId} threshold transitions derive from center-to-left/right lane geometry`,
      );
    }
    for (const arenaId of segment.arenaIds.filter((id) => id !== segment.terminalArenaId)) {
      assert.equal(getWildAtollArenaDefinition(arenaId).exits.some((exit) => exit.kind === "teleport"), false);
    }
  }

  const expectedTopology = new Map([
    [WILD_ATOLL_SEGMENTS.starter, [WILD_ATOLL_SEGMENTS.sereneSkerries, WILD_ATOLL_SEGMENTS.sereneGrotto]],
    [WILD_ATOLL_SEGMENTS.sereneSkerries, [WILD_ATOLL_SEGMENTS.forestedIsthmus, WILD_ATOLL_SEGMENTS.deepSkerries]],
    [WILD_ATOLL_SEGMENTS.forestedIsthmus, []],
    [WILD_ATOLL_SEGMENTS.deepSkerries, [WILD_ATOLL_SEGMENTS.motu, WILD_ATOLL_SEGMENTS.fearsomeSkerries]],
    [WILD_ATOLL_SEGMENTS.motu, []],
    [WILD_ATOLL_SEGMENTS.fearsomeSkerries, []],
    [WILD_ATOLL_SEGMENTS.sereneGrotto, [WILD_ATOLL_SEGMENTS.shadowIsthmus, WILD_ATOLL_SEGMENTS.deepGrotto]],
    [WILD_ATOLL_SEGMENTS.shadowIsthmus, []],
    [WILD_ATOLL_SEGMENTS.deepGrotto, [WILD_ATOLL_SEGMENTS.blueHole, WILD_ATOLL_SEGMENTS.relictGrotto]],
    [WILD_ATOLL_SEGMENTS.blueHole, []],
    [WILD_ATOLL_SEGMENTS.relictGrotto, []],
  ]);
  assert.deepEqual(WILD_ATOLL_SEGMENT_IDS, [...expectedTopology.keys()]);
  for (const [segmentId, nextSegmentIds] of expectedTopology) {
    assert.deepEqual(getWildAtollSegmentDefinition(segmentId).nextSegmentIds, nextSegmentIds, `${segmentId} keeps the canonical onward routes`);
  }

  assert.deepEqual(ruAtoll.segments, {
    starter: "ПЕРВЫЕ ТРОПЫ",
    sereneSkerries: "БЕЗМЯТЕЖНЫЕ ШХЕРЫ",
    forestedIsthmus: "ЛЕСИСТАЯ ПЕРЕЙМА",
    deepSkerries: "ДРЕМУЧИЕ ШХЕРЫ",
    motu: "МОТУ",
    fearsomeSkerries: "ГРОЗНЫЕ ШХЕРЫ",
    sereneGrotto: "БЕЗМЯТЕЖНЫЙ ГРОТ",
    shadowIsthmus: "ТЕНЕВАЯ ПЕРЕЙМА",
    deepGrotto: "ГЛУБОКИЙ ГРОТ",
    blueHole: "ГОЛУБАЯ ДЫРА",
    relictGrotto: "РЕЛИКТОВЫЙ ГРОТ",
  });
  assert.equal(ruAtoll.arenas["serene-skerries"].left1, "СВЕТЛАЯ ПОЛЯНА", "T1 copy stays harmless");
  assert.equal(ruAtoll.arenas["serene-grotto"].left2, "СВЕТЛЫЙ ЗАЛ", "T1 grotto copy stays harmless");
  assert.equal(ruAtoll.arenas["fearsome-skerries"].left1, "МЁРТВЫЕ СОСНЫ", "T3 forest copy signals danger");
  assert.equal(ruAtoll.arenas["relict-grotto"].left1, "ЗАЛ БЕЗ ЭХА", "T3 grotto copy stays mysterious");
  assert.equal(ruAtoll.arenas["forested-isthmus"].root, "ЛЕСНАЯ ПЕРЕМЫЧКА");
  assert.equal(ruAtoll.arenas["forested-isthmus"].right3, "УЗКАЯ ПЕРЕЙМА");
  assert.equal(ruAtoll.arenas["forested-isthmus"].edge, "КОЧУЮЩИЙ ОСТРОВ", "forest NPC threshold is the reached island itself");
  assert.equal(ruAtoll.arenas["shadow-isthmus"].root, "ТЕНЕВАЯ ПЕРЕМЫЧКА");
  assert.equal(ruAtoll.arenas["shadow-isthmus"].right3, "РАЗОРВАННАЯ ПЕРЕЙМА");
  assert.equal(ruAtoll.arenas["shadow-isthmus"].edge, "БЛУЖДАЮЩИЙ ОСТРОВ", "grotto NPC threshold is the reached island itself");
  assert.equal(enAtoll.arenas["forested-isthmus"].edge, "ROVING ISLAND");
  assert.equal(enAtoll.arenas["shadow-isthmus"].edge, "WANDERING ISLAND");
  for (const term of ["path", "threshold", "transition", "teleport"]) {
    assert(wildAtollDoc.includes(`**${term}**`), `Wild Atoll docs define ${term}`);
  }
  for (const term of ["Путь", "Порог", "Переход", "Телепорт"]) {
    assert(gameDoc.includes(`**${term}**`), `GAME.md records ${term}`);
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
  for (const arenaId of WILD_ATOLL_ALL_ARENAS) {
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
  assert(runtimeSource.includes("renderArena(nextSegment.entryArenaId)"), "segment transitions enter the next segment");
  assert(runtimeSource.includes("WILD_ATOLL_ALL_ARENAS"), "run cleanup covers every generated segment");
  assert(!runtimeSource.includes("blockedMessageKey"), "implemented segments are not represented by locked messages");
  assert(runtimeSource.includes("COLLAPSE_FADE_OUT_MS = 5000"));
  assert(runtimeSource.includes("COLLAPSE_FADE_IN_MS = 3000"));
  assert(runtimeSource.includes("beginCollapseRecovery"));
  assert(runtimeSource.includes("value === key || value === namespaceFreeKey"), "technical localization keys fail closed");
  assert(!runtimeSource.toLowerCase().includes("forecast"));
  assert(localesSource.includes('"atoll"'), "Atoll owns a dedicated localization namespace");
  for (const [locale, atoll] of [["ru", ruAtoll], ["en", enAtoll]]) {
    for (const [key, value] of flatten(atoll)) {
      assert(!/[—–?]/u.test(value), `${locale} Atoll label ${key} uses supported punctuation`);
      assert(value.length <= 40, `${locale} Atoll label ${key} fits the compact HUD budget`);
      assert(!/^(?:hud:|atoll:)/.test(value), `${locale} Atoll label ${key} is not a technical key`);
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
