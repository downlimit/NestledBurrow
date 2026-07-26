import assert from "node:assert/strict";
import {
  attemptCookingStep,
  completeCookingStep,
  COOKING_MINIGAME_CONFIG,
  COOKING_STEP_TYPES,
  createCookingStep,
  DEFAULT_KITCHEN_STATE,
  getComboBonus,
  normalizeKitchenState,
  startCookingStep,
  toggleServingDish,
} from "../src/cookingDomain.js";
import { createFreshGameSessionState, normalizeGameSessionState, SESSION_STATE_VERSION } from "../src/gameSessionState.js";
import { deserializeSessionEnvelope, SAVE_SCHEMA_VERSION } from "../src/sessionPersistence.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const fresh = createFreshGameSessionState();
assert.deepEqual(fresh.gameplay.kitchen, DEFAULT_KITCHEN_STATE, "fresh game starts with the canonical kitchen stock");
assert.equal(fresh.version, SESSION_STATE_VERSION);
assert.equal(SAVE_SCHEMA_VERSION, 6);

const legacyState = clone(fresh);
legacyState.version = 3;
delete legacyState.gameplay.kitchen;
const migrated = deserializeSessionEnvelope(JSON.stringify({ schemaVersion: 3, state: legacyState }));
assert.equal(migrated.status, "loaded");
assert.deepEqual(migrated.state.gameplay.kitchen, DEFAULT_KITCHEN_STATE, "v3 saves receive fresh kitchen defaults");
assert.throws(
  () => normalizeGameSessionState({ ...clone(fresh), gameplay: { ...clone(fresh.gameplay), kitchen: { ...DEFAULT_KITCHEN_STATE, rawPotatoes: -1 } } }),
  /non-negative integer/,
  "negative kitchen quantities are rejected",
);
assert.throws(
  () => normalizeKitchenState({ ...DEFAULT_KITCHEN_STATE, cookedDishes: 1.5 }),
  /non-negative integer/,
  "fractional kitchen quantities are rejected",
);

assert.deepEqual([1, 2, 3, 4, 5, 9].map((combo) => getComboBonus(combo)), [3, 6, 18, 32, 64, 64], "combo bonuses are exact");

const targetRandom = () => 0.5;
const successStep = createCookingStep(COOKING_STEP_TYPES.preparation, targetRandom);
successStep.markerPosition = successStep.targetPosition + successStep.targetWidth / 2;
const success = attemptCookingStep(successStep, () => 0.25);
assert.equal(success.status, "success");
assert.equal(success.activeStep.combo, 1);
assert.equal(success.activeStep.remainingSeconds, COOKING_MINIGAME_CONFIG.durationSeconds - 3);
assert(success.activeStep.targetWidth < COOKING_MINIGAME_CONFIG.initialTargetWidth, "success shrinks the target");
assert(success.activeStep.targetPosition >= 0 && success.activeStep.targetPosition + success.activeStep.targetWidth <= 1, "target remains contained");

const missStep = createCookingStep(COOKING_STEP_TYPES.preparation, () => 1);
missStep.combo = 3;
missStep.targetWidth = COOKING_MINIGAME_CONFIG.minimumTargetWidth;
missStep.markerPosition = 0;
const miss = attemptCookingStep(missStep, () => 0);
assert.equal(miss.status, "miss");
assert.equal(miss.activeStep.combo, 0, "miss resets combo");
assert.equal(miss.activeStep.targetWidth, COOKING_MINIGAME_CONFIG.initialTargetWidth, "miss resets target width");
assert.equal(miss.activeStep.targetPosition, missStep.targetPosition, "miss keeps the target position deterministically");

let minimumStep = createCookingStep(COOKING_STEP_TYPES.frying, () => 0);
for (let index = 0; index < 20; index += 1) {
  minimumStep.markerPosition = minimumStep.targetPosition + minimumStep.targetWidth / 2;
  minimumStep.remainingSeconds = COOKING_MINIGAME_CONFIG.durationSeconds;
  minimumStep = attemptCookingStep(minimumStep, () => 0).activeStep;
}
assert.equal(minimumStep.targetWidth, COOKING_MINIGAME_CONFIG.minimumTargetWidth, "target width respects its minimum");

const clampStep = createCookingStep(COOKING_STEP_TYPES.frying, () => 0);
clampStep.remainingSeconds = 2;
clampStep.markerPosition = clampStep.targetPosition;
const clamped = attemptCookingStep(clampStep, () => 0);
assert.equal(clamped.status, "completed");
assert.equal(clamped.activeStep.remainingSeconds, 0, "remaining time clamps to zero");

const kitchen = normalizeKitchenState();
const preparationStart = startCookingStep(kitchen, COOKING_STEP_TYPES.preparation, () => 0);
assert.equal(preparationStart.status, "started");
assert.deepEqual(kitchen, DEFAULT_KITCHEN_STATE, "starting a step does not spend its input");
assert.equal(completeCookingStep(kitchen, COOKING_STEP_TYPES.preparation).status, "completed");
assert.deepEqual(kitchen, { rawPotatoes: 4, preparedPotatoes: 1, cookedDishes: 0, servingTableHasDish: false });
assert.equal(completeCookingStep(kitchen, COOKING_STEP_TYPES.frying).status, "completed");
assert.deepEqual(kitchen, { rawPotatoes: 4, preparedPotatoes: 0, cookedDishes: 1, servingTableHasDish: false });

assert.equal(toggleServingDish(kitchen).status, "dish-served");
assert.deepEqual(kitchen, { rawPotatoes: 4, preparedPotatoes: 0, cookedDishes: 0, servingTableHasDish: true });
assert.equal(toggleServingDish(kitchen).status, "dish-removed");
assert.deepEqual(kitchen, { rawPotatoes: 4, preparedPotatoes: 0, cookedDishes: 1, servingTableHasDish: false });
assert.equal(toggleServingDish(kitchen).status, "dish-served");
assert.equal(toggleServingDish(kitchen).status, "dish-removed");
assert.equal(kitchen.cookedDishes, 1, "repeated serving round-trips never duplicate or lose the dish");

const emptyKitchen = normalizeKitchenState({ rawPotatoes: 0, preparedPotatoes: 0, cookedDishes: 0, servingTableHasDish: false });
assert.equal(startCookingStep(emptyKitchen, COOKING_STEP_TYPES.preparation).status, "no-raw-potatoes");
assert.equal(startCookingStep(emptyKitchen, COOKING_STEP_TYPES.frying).status, "no-prepared-potatoes");
assert.equal(toggleServingDish(emptyKitchen).status, "no-cooked-dish");
assert.deepEqual(emptyKitchen, { rawPotatoes: 0, preparedPotatoes: 0, cookedDishes: 0, servingTableHasDish: false });

console.log("cooking checks passed");
