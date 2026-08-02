import assert from "node:assert/strict";
import { useCombatNumberSlot } from "../src/inventory/combatQuickUse.js";
import {
  applyWildAtollRouteEntry,
  resolveWildAtollGrassDrop,
  WILD_ATOLL_ROUTES,
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
  const mist = gameplayFixture();
  const mistResult = applyWildAtollRouteEntry(mist, WILD_ATOLL_ROUTES.mist);
  assert.deepEqual(mistResult, { routeId: "mist", lustreDelta: 20, energyDelta: -5 });
  assert.equal(mist.needs.lustre, 55);
  assert.equal(mist.currentEnergy, 75);

  const stone = gameplayFixture();
  const stoneResult = applyWildAtollRouteEntry(stone, WILD_ATOLL_ROUTES.stone);
  assert.deepEqual(stoneResult, { routeId: "stone", lustreDelta: 0, energyDelta: -10 });
  assert.equal(stone.currentEnergy, 70);
}

{
  const summarize = (routeId) => {
    const counts = { wood: 0, stone: 0, empty: 0 };
    for (let index = 0; index < 1000; index += 1) {
      const item = resolveWildAtollGrassDrop({ seed: "task-068", grassIndex: index, routeId });
      counts[item ?? "empty"] += 1;
    }
    return counts;
  };
  const mist = summarize(WILD_ATOLL_ROUTES.mist);
  const stone = summarize(WILD_ATOLL_ROUTES.stone);
  assert.ok(mist.wood > mist.stone, JSON.stringify(mist));
  assert.ok(stone.stone > stone.wood, JSON.stringify(stone));
  assert.ok(mist.empty > 300 && mist.empty < 500, JSON.stringify(mist));
  assert.ok(stone.empty > 300 && stone.empty < 500, JSON.stringify(stone));
  assert.equal(
    resolveWildAtollGrassDrop({ seed: "task-068", grassIndex: 17, routeId: WILD_ATOLL_ROUTES.mist }),
    resolveWildAtollGrassDrop({ seed: "task-068", grassIndex: 17, routeId: WILD_ATOLL_ROUTES.mist }),
  );
}

console.log("Task #068 contracts OK");
