export const COOKING_STEP_TYPES = Object.freeze({
  preparation: "preparation",
  frying: "frying",
});

export const DEFAULT_KITCHEN_STATE = Object.freeze({
  rawPotatoes: 5,
  preparedPotatoes: 0,
  cookedDishes: 0,
  servingTableHasDish: false,
});

export const COOKING_MINIGAME_CONFIG = Object.freeze({
  durationSeconds: 45,
  markerSpeedPerSecond: 0.72,
  initialTargetWidth: 0.24,
  minimumTargetWidth: 0.08,
  targetShrinkFactor: 0.72,
  comboBonuses: Object.freeze([3, 6, 18, 32, 64]),
});

function assertPlainRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
}

function normalizeNonNegativeInteger(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function normalizeBoolean(value, fallback, label) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`);
  return value;
}

function clampUnit(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(1, Math.max(0, number));
}

export function normalizeKitchenState(value = {}) {
  assertPlainRecord(value, "Kitchen state");
  return {
    rawPotatoes: normalizeNonNegativeInteger(value.rawPotatoes, DEFAULT_KITCHEN_STATE.rawPotatoes, "Raw potatoes"),
    preparedPotatoes: normalizeNonNegativeInteger(value.preparedPotatoes, DEFAULT_KITCHEN_STATE.preparedPotatoes, "Prepared potatoes"),
    cookedDishes: normalizeNonNegativeInteger(value.cookedDishes, DEFAULT_KITCHEN_STATE.cookedDishes, "Cooked dishes"),
    servingTableHasDish: normalizeBoolean(value.servingTableHasDish, DEFAULT_KITCHEN_STATE.servingTableHasDish, "Serving table dish"),
  };
}

export function getComboBonus(combo, config = COOKING_MINIGAME_CONFIG) {
  const normalizedCombo = Math.max(1, Math.floor(Number(combo) || 1));
  return config.comboBonuses[Math.min(normalizedCombo, config.comboBonuses.length) - 1];
}

export function createCookingStep(stepType, randomSource = Math.random, config = COOKING_MINIGAME_CONFIG) {
  if (!Object.values(COOKING_STEP_TYPES).includes(stepType)) {
    throw new Error(`Unknown cooking step type: ${String(stepType)}`);
  }
  return {
    remainingSeconds: config.durationSeconds,
    combo: 0,
    markerPosition: 0,
    markerDirection: 1,
    targetPosition: chooseTargetPosition(config.initialTargetWidth, randomSource),
    targetWidth: config.initialTargetWidth,
    stepType,
    feedback: null,
  };
}

export function canStartCookingStep(kitchen, stepType) {
  if (stepType === COOKING_STEP_TYPES.preparation) {
    return kitchen.rawPotatoes >= 1
      ? { status: "available" }
      : { status: "no-raw-potatoes", messageKey: "hud:interaction.noRawPotatoes" };
  }
  if (stepType === COOKING_STEP_TYPES.frying) {
    return kitchen.preparedPotatoes >= 1
      ? { status: "available" }
      : { status: "no-prepared-potatoes", messageKey: "hud:interaction.noPreparedPotatoes" };
  }
  return { status: "unknown-step" };
}

export function startCookingStep(kitchen, stepType, randomSource = Math.random, config = COOKING_MINIGAME_CONFIG) {
  const availability = canStartCookingStep(kitchen, stepType);
  if (availability.status !== "available") return { ...availability, activeStep: null };
  return { status: "started", activeStep: createCookingStep(stepType, randomSource, config) };
}

export function advanceCookingStep(activeStep, deltaSeconds, config = COOKING_MINIGAME_CONFIG) {
  const delta = Math.max(0, Number(deltaSeconds) || 0);
  const remainingSeconds = Math.max(0, activeStep.remainingSeconds - delta);
  let markerPosition = activeStep.markerPosition + activeStep.markerDirection * config.markerSpeedPerSecond * delta;
  let markerDirection = activeStep.markerDirection;
  while (markerPosition < 0 || markerPosition > 1) {
    if (markerPosition > 1) {
      markerPosition = 2 - markerPosition;
      markerDirection = -1;
    } else {
      markerPosition = -markerPosition;
      markerDirection = 1;
    }
  }
  return {
    ...activeStep,
    remainingSeconds,
    markerPosition,
    markerDirection,
  };
}

export function attemptCookingStep(activeStep, randomSource = Math.random, config = COOKING_MINIGAME_CONFIG) {
  const insideTarget = activeStep.markerPosition >= activeStep.targetPosition
    && activeStep.markerPosition <= activeStep.targetPosition + activeStep.targetWidth;
  if (!insideTarget) {
    return {
      status: "miss",
      activeStep: {
        ...activeStep,
        combo: 0,
        targetWidth: config.initialTargetWidth,
        feedback: "miss",
      },
    };
  }

  const combo = activeStep.combo + 1;
  const remainingSeconds = Math.max(0, activeStep.remainingSeconds - getComboBonus(combo, config));
  const targetWidth = Math.max(
    config.minimumTargetWidth,
    activeStep.targetWidth * config.targetShrinkFactor,
  );
  return {
    status: remainingSeconds === 0 ? "completed" : "success",
    activeStep: {
      ...activeStep,
      remainingSeconds,
      combo,
      targetWidth,
      targetPosition: chooseTargetPosition(targetWidth, randomSource),
      feedback: "success",
    },
  };
}

export function completeCookingStep(kitchen, stepType) {
  const availability = canStartCookingStep(kitchen, stepType);
  if (availability.status !== "available") return { ...availability, mutated: false };
  if (stepType === COOKING_STEP_TYPES.preparation) {
    kitchen.rawPotatoes -= 1;
    kitchen.preparedPotatoes += 1;
  } else {
    kitchen.preparedPotatoes -= 1;
    kitchen.cookedDishes += 1;
  }
  return { status: "completed", mutated: true, stepType };
}

export function toggleServingDish(kitchen) {
  if (kitchen.servingTableHasDish) {
    kitchen.servingTableHasDish = false;
    kitchen.cookedDishes += 1;
    return { status: "dish-removed", mutated: true };
  }
  if (kitchen.cookedDishes < 1) {
    return { status: "no-cooked-dish", mutated: false, messageKey: "hud:interaction.noCookedDish" };
  }
  kitchen.cookedDishes -= 1;
  kitchen.servingTableHasDish = true;
  return { status: "dish-served", mutated: true };
}

export function getKitchenFacilityPrompt(facilityType, kitchen) {
  if (facilityType === "cutting-table") {
    return kitchen.rawPotatoes >= 1
      ? "hud:interaction.startPreparation"
      : "hud:interaction.noRawPotatoes";
  }
  if (facilityType === "gas-stove") {
    return kitchen.preparedPotatoes >= 1
      ? "hud:interaction.startFrying"
      : "hud:interaction.noPreparedPotatoes";
  }
  if (facilityType === "serving-table") {
    if (kitchen.servingTableHasDish) return "hud:interaction.takeDish";
    return kitchen.cookedDishes >= 1
      ? "hud:interaction.serveDish"
      : "hud:interaction.noCookedDish";
  }
  return null;
}

function chooseTargetPosition(targetWidth, randomSource) {
  const usableWidth = Math.max(0, 1 - targetWidth);
  return clampUnit(randomSource?.()) * usableWidth;
}
