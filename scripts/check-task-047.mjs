import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FARMING_FRAMES,
  POTATO_CROP_PROFILE,
  WATERING_CAN_CAPACITY,
} from "../src/farmingConfig.js";
import {
  advanceFarmTime,
  axeFarmCell,
  createFreshFarmState,
  cropFrame,
  destroyCropsByCollider,
  harvestPotato,
  moistureMultiplier,
  plantPotato,
  refillWateringCan,
  soilFrame,
  tillSoil,
  waterSoil,
} from "../src/farmingDomain.js";
import {
  addInventoryItem,
  canAddInventoryItem,
  createFreshInventory,
  getInventoryQuantity,
} from "../src/inventoryDomain.js";
import { purchasePotatoSeed } from "../src/merchantDomain.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/sessionPersistence.js";
import { createFreshGameSessionState } from "../src/gameSessionState.js";
import { compactPromptRect, compactPromptWidth } from "../src/interactionHud.js";
import { INVENTORY_HUD_AREA } from "../src/inventoryRuntime.js";
import { worldDepthFromAnchorY } from "../src/buildWorldGeometry.js";
import {
  characterBoundsCenter,
  stableGridAnchor,
  stableHoeAimDirection,
} from "../src/farmingRuntime.js";
import { UiVisibilityCoordinator } from "../src/uiVisibilityCoordinator.js";
import { NPCS } from "../src/npcConfig.js";
import { TAVERN_SIGN } from "../src/guestConfig.js";
import { DOOR_LEFT, TILE_SIZE } from "../src/worldConfig.js";

const HOUR = 3600;
const clone = (value) => JSON.parse(JSON.stringify(value));

assert.deepEqual(stableHoeAimDirection(null, { x: 1, y: 0 }), { x: 1, y: 0 });
assert.deepEqual(stableHoeAimDirection({ x: 1, y: 0 }, { x: 0, y: 0 }), { x: 1, y: 0 }, "zero input preserves stable hoe aim");
assert.deepEqual(stableHoeAimDirection({ x: 1, y: 0 }, { x: -1, y: 0 }), { x: -1, y: 0 }, "opposite input flips hoe aim immediately");
assert.deepEqual(stableHoeAimDirection({ x: -1, y: 0 }, { x: 0.7, y: -0.71 }), { x: 1, y: 0 }, "near-equal diagonal preserves the horizontal aim axis");
assert.deepEqual(stableHoeAimDirection({ x: 0, y: -1 }, { x: 0.71, y: 0.7 }), { x: 0, y: 1 }, "near-equal diagonal preserves the vertical aim axis");
assert.deepEqual(
  characterBoundsCenter({
    motor: { position: { x: 40, y: 56 } },
    sprite: { displayWidth: 16, displayHeight: 16, originX: 0.5, originY: 1 },
  }),
  { x: 40, y: 48 },
  "farm aim is anchored at the character sprite bounds center",
);
const initialAimAnchor = stableGridAnchor(null, { x: 392, y: 504 - 8 }, TILE_SIZE, 0.2);
assert.deepEqual(initialAimAnchor, { x: 384, y: 496 });
assert.deepEqual(
  stableGridAnchor(initialAimAnchor, { x: 401, y: 496 }, TILE_SIZE, 0.2),
  initialAimAnchor,
  "one pixel in the neighboring cell does not move the farm aim anchor",
);
assert.deepEqual(
  stableGridAnchor(initialAimAnchor, { x: 404, y: 496 }, TILE_SIZE, 0.2),
  { x: 400, y: 496 },
  "farm aim anchor advances after crossing twenty percent of the neighboring cell",
);

const freshGame = createFreshGameSessionState();
assert.equal(getInventoryQuantity(freshGame.gameplay.inventory, "potato-seed"), 4);
assert.equal(getInventoryQuantity(freshGame.gameplay.inventory, "potato"), 3);

const inventory = createFreshInventory();
assert.equal(addInventoryItem(inventory, { id: "potato", quantity: 200 }).mutated, true);
assert.deepEqual(
  inventory.slots.filter((slot) => slot?.id === "potato").map((slot) => slot.quantity),
  [99, 99, 2],
  "a batch is planned across multiple 99-item stacks",
);
const beforeRejectedBatch = clone(inventory);
assert.equal(canAddInventoryItem(inventory, { id: "potato", quantity: 500 }).canAdd, false);
assert.deepEqual(inventory, beforeRejectedBatch, "rejected capacity plans are atomic");

const shopGameplay = { coins: 2, inventory: createFreshInventory() };
assert.equal(purchasePotatoSeed(shopGameplay).status, "purchased");
assert.equal(shopGameplay.coins, 1);
assert.equal(getInventoryQuantity(shopGameplay.inventory, "potato-seed"), 1);
for (let slot = 3; slot < shopGameplay.inventory.slots.length; slot += 1) {
  shopGameplay.inventory.slots[slot] = { id: "potato", kind: "loot", quantity: 99 };
}
const beforeFailedPurchase = clone(shopGameplay);
assert.equal(purchasePotatoSeed(shopGameplay).status, "inventory-full");
assert.deepEqual(shopGameplay, beforeFailedPurchase, "full inventory cannot consume the persistent coin");

const farm = createFreshFarmState(6 * HOUR);
const farmInventory = createFreshInventory();
addInventoryItem(farmInventory, { id: "potato-seed", quantity: 1 });
assert.equal(tillSoil(farm, { x: 64, y: 64 }).status, "tilled");
assert.equal(farm.wateringCan.currentWater, WATERING_CAN_CAPACITY);
assert.equal(waterSoil(farm, { x: 64, y: 64 }, 6 * HOUR).status, "watered");
assert.equal(farm.wateringCan.currentWater, WATERING_CAN_CAPACITY - 1);
assert.equal(plantPotato(farm, { x: 64, y: 64 }, farmInventory, 6 * HOUR).status, "planted");
assert.equal(getInventoryQuantity(farmInventory, "potato-seed"), 0);
assert.equal(refillWateringCan(farm).status, "watering-can-refilled");
assert.equal(farm.wateringCan.currentWater, WATERING_CAN_CAPACITY);
const moistureFrames = [null, 0, 10 * HOUR, 17 * HOUR].map((age) => soilFrame({ moistureSolarAgeSeconds: age }));
assert.deepEqual(
  moistureFrames,
  [FARMING_FRAMES.soilDry, FARMING_FRAMES.soilWet100, FARMING_FRAMES.soilWet66, FARMING_FRAMES.soilWet33],
  "the four authoritative soil moisture visuals are reachable",
);
assert.equal(moistureMultiplier(10 * HOUR - 1), 1);
assert.equal(moistureMultiplier(10 * HOUR), 2 / 3);
assert.equal(moistureMultiplier(17 * HOUR), 1 / 3);
assert.equal(moistureMultiplier(21 * HOUR), 0);

assert.equal(POTATO_CROP_PROFILE.weatherGrowthMultipliers.cloudy, 0.5);
assert.equal(POTATO_CROP_PROFILE.weatherGrowthMultipliers.rain, 2);
const cloudyFarm = plantedFarm(6 * HOUR);
advanceFarmTime(cloudyFarm, 7 * HOUR, { defaultWeatherId: "cloudy" });
assert.equal(cloudyFarm.soilCells[0].crop.effectiveGrowthSeconds, 0.5 * HOUR);
const rainFarm = plantedFarm(6 * HOUR);
advanceFarmTime(rainFarm, 7 * HOUR, { defaultWeatherId: "rain" });
assert.equal(rainFarm.soilCells[0].crop.effectiveGrowthSeconds, 2 * HOUR);
assert.equal(rainFarm.soilCells[0].moistureSolarAgeSeconds, 0, "rain hydrates authoritative soil moisture");

const weatherSegments = [
  { id: "cloudy", start: 4 * HOUR, end: 10 * HOUR },
  { id: "clear", start: 10 * HOUR, end: 18 * HOUR },
  { id: "rain", precipitation: true, start: 18 * HOUR, end: 30 * HOUR },
  { id: "cloudy", start: 30 * HOUR, end: 42 * HOUR },
];
const largeStep = plantedFarm(4 * HOUR);
const smallSteps = clone(largeStep);
advanceFarmTime(largeStep, 42 * HOUR, { weatherSegments });
for (let target = 4 * HOUR + 900; target <= 42 * HOUR; target += 900) {
  advanceFarmTime(smallSteps, target, { weatherSegments });
}
assert.deepEqual(smallSteps, largeStep, "large and small time steps produce the same farm state");

const neverWatered = plantedFarm(6 * HOUR, false);
advanceFarmTime(neverWatered, 78 * HOUR);
assert.equal(neverWatered.soilCells[0].crop.rotten, true);
assert.equal(cropFrame(neverWatered.soilCells[0].crop), FARMING_FRAMES.cropPlantedRotten);
const hydratedRot = plantedFarm(6 * HOUR);
advanceFarmTime(hydratedRot, 30 * HOUR);
assert.equal(hydratedRot.soilCells[0].crop.rotten, true);
assert.equal(cropFrame(hydratedRot.soilCells[0].crop), FARMING_FRAMES.cropRotten);

const harvestFarm = plantedFarm(6 * HOUR);
harvestFarm.soilCells[0].crop.mature = true;
assert.equal(harvestPotato(harvestFarm, { x: 16, y: 16 }, () => 0).quantity, 4);
const maximumHarvest = plantedFarm(6 * HOUR);
maximumHarvest.soilCells[0].crop.mature = true;
assert.equal(harvestPotato(maximumHarvest, { x: 16, y: 16 }, () => 0.999999).quantity, 6);

const axeFarm = plantedFarm(6 * HOUR);
assert.equal(axeFarmCell(axeFarm, { x: 16, y: 16 }).status, "crop-destroyed");
assert.equal(axeFarm.soilCells.length, 1);
assert.equal(axeFarm.soilCells[0].crop, null);
assert.equal(axeFarmCell(axeFarm, { x: 16, y: 16 }).status, "soil-destroyed");
assert.equal(axeFarm.soilCells.length, 0);
const crushedFarm = plantedFarm(6 * HOUR);
assert.equal(destroyCropsByCollider(crushedFarm, { left: 15, top: 22, right: 17, bottom: 24 }).status, "crops-crushed");
assert.equal(crushedFarm.soilCells[0].crop, null);
assert.equal(crushedFarm.soilCells.length, 1, "dropped resource collision preserves the garden bed");

const legacy = createFreshGameSessionState();
legacy.version = 7;
legacy.entities["home-npc"] = { id: "home-npc", flags: {} };
legacy.entities["street-npc"] = { id: "street-npc", flags: {} };
legacy.flags["neighborQuest.started"] = true;
delete legacy.entities["seed-merchant"];
delete legacy.gameplay.farm;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 7, state: legacy }));
assert.equal(migrated.status, "loaded");
assert.equal(SAVE_SCHEMA_VERSION, 9);
assert(migrated.state.entities["seed-merchant"]);
assert.equal(migrated.state.entities["home-npc"], undefined);
assert.equal(migrated.state.entities["street-npc"], undefined);
assert.equal(migrated.state.flags["neighborQuest.started"], undefined);
assert.equal(migrated.state.gameplay.farm.wateringCan.currentWater, WATERING_CAN_CAPACITY);

assert.equal(compactPromptWidth(9, false), 19, "desktop prompt applies exactly five pixels of horizontal padding");
assert.equal(compactPromptWidth(9, true), 28, "coarse pointer prompt has a 28px minimum");
const promptRect = compactPromptRect(28);
assert.equal(promptRect.height, 18);
assert.equal(promptRect.y + promptRect.height < INVENTORY_HUD_AREA.y, true);
assert.equal(promptRect.x + promptRect.width, INVENTORY_HUD_AREA.x + INVENTORY_HUD_AREA.width);
assert(worldDepthFromAnchorY(101, "front") > worldDepthFromAnchorY(100, "back"));
assert.equal(worldDepthFromAnchorY(100, "same"), worldDepthFromAnchorY(100, "same"));

const merchant = NPCS.find(({ id }) => id === "seed-merchant");
assert(merchant.spawn.x < DOOR_LEFT * TILE_SIZE, "merchant stands on the left side of the road");
assert(merchant.spawn.y > TAVERN_SIGN.position.y, "merchant stands below the tavern sign");

const interactionVisibility = [];
const merchantVisibility = [];
const uiVisibility = new UiVisibilityCoordinator();
uiVisibility.register({ setSuppressed: (value) => interactionVisibility.push(value) }, ["option-sensitive", "merchant-active"]);
uiVisibility.register({ setSuppressed: (value) => merchantVisibility.push(value) }, ["option-sensitive"]);
uiVisibility.setClassHidden("merchant-active", true);
assert.equal(interactionVisibility.at(-1), true);
assert.equal(merchantVisibility.at(-1), false);
uiVisibility.setClassHidden("option-sensitive", true);
assert.equal(merchantVisibility.at(-1), true);
uiVisibility.setClassHidden("option-sensitive", false);
assert.equal(merchantVisibility.at(-1), false);

const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const gameHudSource = readFileSync(new URL("../src/gameHud.js", import.meta.url), "utf8");
const farmingRuntimeSource = readFileSync(new URL("../src/farmingRuntime.js", import.meta.url), "utf8");
const inventoryRuntimeSource = readFileSync(new URL("../src/inventoryRuntime.js", import.meta.url), "utf8");
const debrisRuntimeSource = readFileSync(new URL("../src/debrisRuntime.js", import.meta.url), "utf8");
assert(!mainSource.includes("neighborQuest"), "composition root has no obsolete quest owner");
assert(!mainSource.includes("street-npc"), "composition root has no obsolete street NPC");
assert(!/rawPotatoes|preparedPotatoes/.test(gameHudSource), "obsolete kitchen inventory counters are absent from HUD");
assert(farmingRuntimeSource.includes("character.motor?.movement?.desiredDirection"), "hoe target uses immediate input direction");
assert(inventoryRuntimeSource.includes("setTintMode(TINT_MODE_FILL)") && inventoryRuntimeSource.includes("colorOverride: 0xffffff"), "dropped items use opaque-pixel silhouette outlines");
assert(debrisRuntimeSource.includes('getSelectedItem()?.id === "axe"'), "resource interaction targets require the selected axe");
assert(debrisRuntimeSource.includes("colorOverride: 0x8ed6ff") && debrisRuntimeSource.includes(".setAlpha(0.22)"), "available axe targets use a subtle blue silhouette outline");
assert(mainSource.includes('status: "wrong-tool"'), "resource handler rejects bypasses without the selected axe");

console.log("Task #047 checks passed: atomic economy, stacks, hydration, growth, rot, migration, prompt and depth");

function plantedFarm(now, hydrated = true) {
  const state = createFreshFarmState(now);
  const items = createFreshInventory();
  addInventoryItem(items, { id: "potato-seed", quantity: 1 });
  tillSoil(state, { x: 16, y: 16 });
  if (hydrated) waterSoil(state, { x: 16, y: 16 }, now);
  plantPotato(state, { x: 16, y: 16 }, items, now);
  return state;
}
