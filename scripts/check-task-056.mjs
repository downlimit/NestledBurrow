import assert from "node:assert/strict";
import {
  DRY_CROP_ROT_SECONDS,
  DRY_SEED_ROT_SECONDS,
} from "../src/resources/farmingConfig.js";
import {
  advanceFarmTime,
  createFreshFarmState,
  moistureMultiplier,
  normalizeFarmState,
  plantPotato,
  refillWaterBucket,
  tillSoil,
  waterSoil,
} from "../src/resources/farmingDomain.js";
import {
  addInventoryItem,
  createFreshInventory,
} from "../src/inventory/inventoryDomain.js";

const HOUR = 3600;
const CELL = Object.freeze({ x: 16, y: 16 });

assert.equal(DRY_SEED_ROT_SECONDS, 24 * HOUR);
assert.equal(DRY_CROP_ROT_SECONDS, 48 * HOUR);

const drySeed = plantedFarm(6 * HOUR);
advanceFarmTime(drySeed, 30 * HOUR - 1);
assert.equal(drySeed.soilCells[0].crop.rotten, false);
assert.equal(drySeed.soilCells[0].crop.dryExposureSeconds, DRY_SEED_ROT_SECONDS - 1);
advanceFarmTime(drySeed, 30 * HOUR);
assert.equal(drySeed.soilCells[0].crop.rotten, true, "a seed in fully dry soil rots after 24 hours");

const resetByWater = plantedFarm(6 * HOUR);
advanceFarmTime(resetByWater, 20 * HOUR);
assert.equal(resetByWater.soilCells[0].crop.dryExposureSeconds, 14 * HOUR);
refillWaterBucket(resetByWater);
waterSoil(resetByWater, CELL, 20 * HOUR);
assert.equal(resetByWater.soilCells[0].crop.dryExposureSeconds, 0);
assert.notEqual(resetByWater.soilCells[0].crop.firstHydratedAt, null);

const dailyWatering = plantedFarm(6 * HOUR, true);
advanceFarmTime(dailyWatering, 30 * HOUR);
assert.equal(dailyWatering.soilCells[0].crop.rotten, false, "watering is not a 24-hour rot deadline");
assert.equal(dailyWatering.soilCells[0].crop.dryExposureSeconds, 0);
refillWaterBucket(dailyWatering);
waterSoil(dailyWatering, CELL, 30 * HOUR);
advanceFarmTime(dailyWatering, 33 * HOUR);
assert.equal(dailyWatering.soilCells[0].crop.mature, true, "same-time daily watering matures potatoes in clear weather");
assert.equal(dailyWatering.soilCells[0].crop.rotten, false);

const dryCrop = plantedFarm(6 * HOUR, true);
advanceFarmTime(dryCrop, 35 * HOUR);
assert.equal(moistureMultiplier(dryCrop.soilCells[0].moistureSolarAgeSeconds), 0);
assert.equal(dryCrop.soilCells[0].crop.dryExposureSeconds, 0, "rot starts only after soil reaches fully dry");
advanceFarmTime(dryCrop, 35 * HOUR + DRY_CROP_ROT_SECONDS - 1);
assert.equal(dryCrop.soilCells[0].crop.rotten, false);
advanceFarmTime(dryCrop, 35 * HOUR + DRY_CROP_ROT_SECONDS);
assert.equal(dryCrop.soilCells[0].crop.rotten, true, "hydrated crops rot after 48 fully dry hours");

const rainReset = plantedFarm(6 * HOUR, true);
advanceFarmTime(rainReset, 50 * HOUR);
assert.equal(rainReset.soilCells[0].crop.dryExposureSeconds, 15 * HOUR);
advanceFarmTime(rainReset, 51 * HOUR, {
  weatherSegments: [{ id: "rain", precipitation: true, start: 50 * HOUR, end: 51 * HOUR }],
});
assert.equal(rainReset.soilCells[0].crop.dryExposureSeconds, 0);
assert.equal(rainReset.soilCells[0].crop.rotten, false);

const oldSave = plantedFarm(6 * HOUR, true);
delete oldSave.soilCells[0].crop.dryExposureSeconds;
assert.equal(normalizeFarmState(oldSave, 6 * HOUR).soilCells[0].crop.dryExposureSeconds, 0);

console.log("Task #056 checks passed: rot accumulates only in fully dry soil and water resets it");

function plantedFarm(now, hydrated = false) {
  const farm = createFreshFarmState(now);
  const inventory = createFreshInventory();
  addInventoryItem(inventory, { id: "potato-seed", quantity: 1 });
  tillSoil(farm, CELL);
  if (hydrated) {
    refillWaterBucket(farm);
    waterSoil(farm, CELL, now);
  }
  assert.equal(plantPotato(farm, CELL, inventory, now).status, "planted");
  return farm;
}
