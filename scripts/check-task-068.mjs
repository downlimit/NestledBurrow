import assert from "node:assert/strict";
import { createInventoryItem } from "../src/inventory/inventoryDomain.js";
import { useCombatNumberSlot } from "../src/inventory/combatQuickUse.js";
import {
  createWildAtollArenaNodes,
  getWildAtollArenaDefinition,
  WILD_ATOLL_ARENAS,
  WILD_ATOLL_STARTER_PATH,
} from "../src/world/wildAtollDomain.js";

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

console.log("Task #068 contracts OK");
