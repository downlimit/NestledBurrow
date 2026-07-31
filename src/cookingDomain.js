import {
  addInventoryItem,
  addInventoryItemUpTo,
  canAddInventoryItem,
  createInventoryItem,
  getInventoryQuantity,
  getLoadoutItemQuantity,
  normalizeCombatLoadout,
  normalizeInventory,
  takeInventoryItem,
  takeLoadoutItem,
} from "./inventoryDomain.js";

export const COOKING_STEP_TYPES = Object.freeze({
  preparation: "preparation",
  frying: "frying",
});

export const SELLABLE_ITEM_IDS = Object.freeze(["lemonade", "fried-potato-dish"]);
export const SERVING_TABLE_CAPACITY = 4;
export const STOVE_REPAIR_COST = Object.freeze({ wood: 10, stone: 8, coins: 10 });

export const DEFAULT_KITCHEN_STATE = Object.freeze({
  starterLemons: 6,
  stoveRepaired: false,
  servingTable: Object.freeze({
    itemId: null,
    quantity: 0,
    reservations: Object.freeze([]),
  }),
});

export const COOKING_MINIGAME_CONFIG = Object.freeze({
  durationSeconds: 45,
  markerSpeedPerSecond: 0.72,
  initialTargetWidth: 0.24,
  minimumTargetWidth: 0.08,
  targetShrinkFactor: 0.72,
  comboBonuses: Object.freeze([3, 6, 18, 32, 64]),
});

const RECIPES = Object.freeze({
  preparation: Object.freeze({ input: "potato", output: "sliced-potato" }),
  frying: Object.freeze({ input: "sliced-potato", output: "fried-potato-dish", requiresStove: true }),
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
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function normalizeServingTable(value = {}) {
  assertPlainRecord(value, "Serving table stock");
  const quantity = normalizeNonNegativeInteger(value.quantity, 0, "Serving table quantity");
  if (quantity > SERVING_TABLE_CAPACITY) throw new Error(`Serving table quantity must be in 0..${SERVING_TABLE_CAPACITY}`);
  const itemId = quantity === 0 ? null : value.itemId;
  if (itemId !== null && !SELLABLE_ITEM_IDS.includes(itemId)) throw new Error("Serving table item is not sellable");
  if (!Array.isArray(value.reservations ?? [])) throw new Error("Serving table reservations must be an array");
  const reservations = [];
  const guestIds = new Set();
  for (const raw of value.reservations ?? []) {
    assertPlainRecord(raw, "Serving table reservation");
    const guestId = String(raw.guestId ?? "");
    if (!guestId || guestIds.has(guestId) || raw.itemId !== itemId) continue;
    guestIds.add(guestId);
    reservations.push({ guestId, itemId });
  }
  if (reservations.length > quantity) reservations.length = quantity;
  return { itemId, quantity, reservations };
}

export function normalizeKitchenState(value = {}) {
  assertPlainRecord(value, "Kitchen state");
  return {
    starterLemons: normalizeNonNegativeInteger(value.starterLemons, DEFAULT_KITCHEN_STATE.starterLemons, "Starter lemons"),
    stoveRepaired: Boolean(value.stoveRepaired),
    servingTable: normalizeServingTable(value.servingTable ?? DEFAULT_KITCHEN_STATE.servingTable),
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

export function canStartCookingStep(kitchen, stepType, inventory) {
  const recipe = RECIPES[stepType];
  if (!recipe) return { status: "unknown-step" };
  if (recipe.requiresStove && !kitchen.stoveRepaired) {
    return { status: "stove-broken", messageKey: "hud:interaction.repairStove" };
  }
  return previewInventoryRecipe(inventory, recipe);
}

export function startCookingStep(kitchen, stepType, inventory, randomSource = Math.random, config = COOKING_MINIGAME_CONFIG) {
  const availability = canStartCookingStep(kitchen, stepType, inventory);
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
  return { ...activeStep, remainingSeconds, markerPosition, markerDirection };
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
  const targetWidth = Math.max(config.minimumTargetWidth, activeStep.targetWidth * config.targetShrinkFactor);
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

export function completeCookingStep(kitchen, stepType, inventory) {
  const availability = canStartCookingStep(kitchen, stepType, inventory);
  if (availability.status !== "available") return { ...availability, mutated: false };
  const recipe = RECIPES[stepType];
  const result = applyInventoryRecipe(inventory, recipe);
  return result.mutated ? { ...result, status: "completed", stepType } : result;
}

export function craftLemonade(kitchen, farm, inventory) {
  if (getInventoryQuantity(inventory, "lemon") < 1) {
    return { status: "no-lemon", messageKey: "hud:interaction.noLemon", mutated: false };
  }
  if ((farm?.waterBucket?.currentWater ?? 0) < 1) {
    return { status: "no-water", messageKey: "hud:interaction.noWater", mutated: false };
  }
  const result = applyInventoryRecipe(inventory, { input: "lemon", output: "lemonade" });
  if (!result.mutated) return { ...result, messageKey: "hud:interaction.inventoryFull" };
  farm.waterBucket.currentWater -= 1;
  return { ...result, status: "lemonade-crafted", currentWater: farm.waterBucket.currentWater };
}

export function takeStarterLemons(kitchen, inventory) {
  if (kitchen.starterLemons <= 0) return { status: "lemon-sack-empty", mutated: false };
  const inventoryResult = addInventoryItemUpTo(
    inventory,
    createInventoryItem("lemon", kitchen.starterLemons),
  );
  if (!inventoryResult.mutated) return inventoryResult;
  kitchen.starterLemons -= inventoryResult.accepted;
  return {
    status: kitchen.starterLemons === 0 ? "lemon-sack-depleted" : "lemons-taken",
    mutated: true,
    remaining: kitchen.starterLemons,
    inventory: inventoryResult,
  };
}

export function interactServingTable(kitchen, inventory, selectedItemId) {
  const stock = kitchen.servingTable;
  if (SELLABLE_ITEM_IDS.includes(selectedItemId)) {
    if (stock.itemId && stock.itemId !== selectedItemId) {
      return { status: "different-item", messageKey: "hud:interaction.servingTableDifferentItem", mutated: false };
    }
    if (stock.quantity >= SERVING_TABLE_CAPACITY) {
      return { status: "serving-table-full", messageKey: "hud:interaction.servingTableFull", mutated: false };
    }
    const taken = takeInventoryItem(inventory, selectedItemId, 1);
    if (!taken.mutated) return { status: "no-sellable-item", mutated: false };
    stock.itemId = selectedItemId;
    stock.quantity += 1;
    return { status: "item-served", mutated: true, itemId: selectedItemId, inventory: taken };
  }
  if (!stock.itemId || stock.quantity <= stock.reservations.length) {
    return { status: stock.quantity ? "all-reserved" : "serving-table-empty", mutated: false };
  }
  const capacity = canAddInventoryItem(inventory, createInventoryItem(stock.itemId, 1));
  if (!capacity.canAdd) return { status: "inventory-full", messageKey: "hud:interaction.inventoryFull", mutated: false };
  const inventoryResult = addInventoryItem(inventory, createInventoryItem(stock.itemId, 1));
  stock.quantity -= 1;
  const itemId = stock.itemId;
  if (stock.quantity === 0) stock.itemId = null;
  return { status: "item-taken", mutated: true, itemId, inventory: inventoryResult };
}

export function reserveServingItem(kitchen, guestId) {
  const stock = kitchen.servingTable;
  if (!stock.itemId || stock.quantity <= stock.reservations.length) return null;
  if (stock.reservations.some((reservation) => reservation.guestId === guestId)) return null;
  const reservation = { guestId, itemId: stock.itemId };
  stock.reservations.push(reservation);
  return { ...reservation };
}

export function releaseServingReservation(kitchen, guestId) {
  const reservations = kitchen.servingTable.reservations;
  const index = reservations.findIndex((reservation) => reservation.guestId === guestId);
  if (index < 0) return false;
  reservations.splice(index, 1);
  return true;
}

export function consumeServingReservation(kitchen, guestId) {
  const stock = kitchen.servingTable;
  const index = stock.reservations.findIndex((reservation) => reservation.guestId === guestId);
  if (index < 0 || stock.quantity <= 0) return null;
  const [reservation] = stock.reservations.splice(index, 1);
  if (reservation.itemId !== stock.itemId) return null;
  stock.quantity -= 1;
  if (stock.quantity === 0) stock.itemId = null;
  return { itemId: reservation.itemId, quantity: stock.quantity };
}

export function repairStove(gameplay) {
  const kitchen = gameplay?.kitchen;
  if (!kitchen || kitchen.stoveRepaired) return { status: "already-repaired", mutated: false };
  const inventoryCollections = { inventory: gameplay.inventory, combatLoadout: gameplay.combatLoadout };
  const missing = [];
  if (getLoadoutItemQuantity(inventoryCollections, "wood") < STOVE_REPAIR_COST.wood) missing.push("wood");
  if (getLoadoutItemQuantity(inventoryCollections, "stone") < STOVE_REPAIR_COST.stone) missing.push("stone");
  if ((gameplay.coins ?? 0) < STOVE_REPAIR_COST.coins) missing.push("coins");
  if (missing.length) return { status: "repair-missing", messageKey: "hud:interaction.repairMissing", missing, mutated: false };
  const next = {
    inventory: normalizeInventory(gameplay.inventory),
    combatLoadout: normalizeCombatLoadout(gameplay.combatLoadout),
  };
  takeLoadoutItem(next, "wood", STOVE_REPAIR_COST.wood);
  takeLoadoutItem(next, "stone", STOVE_REPAIR_COST.stone);
  commitInventory(gameplay.inventory, next.inventory);
  commitInventory(gameplay.combatLoadout, next.combatLoadout);
  gameplay.coins -= STOVE_REPAIR_COST.coins;
  kitchen.stoveRepaired = true;
  return { status: "stove-repaired", mutated: true, cost: STOVE_REPAIR_COST };
}

export function getKitchenFacilityPrompt(facilityType, kitchen, inventory, selectedItemId = null) {
  if (facilityType === "cutting-table") {
    return getInventoryQuantity(inventory, "potato") >= 1
      ? "hud:interaction.startPreparation"
      : "hud:interaction.noRawPotatoes";
  }
  if (facilityType === "gas-stove") {
    if (!kitchen.stoveRepaired) return "hud:interaction.repairStove";
    return getInventoryQuantity(inventory, "sliced-potato") >= 1
      ? "hud:interaction.startFrying"
      : "hud:interaction.noPreparedPotatoes";
  }
  if (facilityType === "juicer") return "hud:interaction.makeLemonade";
  if (facilityType === "lemon-sack") {
    return kitchen.starterLemons > 0 ? "hud:interaction.takeLemons" : "hud:interaction.lemonSackEmpty";
  }
  if (facilityType === "serving-table") {
    const stock = kitchen.servingTable;
    if (SELLABLE_ITEM_IDS.includes(selectedItemId)) {
      if (stock.itemId && stock.itemId !== selectedItemId) return "hud:interaction.servingTableDifferentItem";
      return stock.quantity >= SERVING_TABLE_CAPACITY
        ? "hud:interaction.servingTableFull"
        : "hud:interaction.serveItem";
    }
    if (stock.quantity > stock.reservations.length) {
      const itemKey = stock.itemId === "lemonade" ? "lemonade" : "friedPotatoDish";
      return `hud:interaction.servingStock.${itemKey}${stock.quantity}`;
    }
    return "hud:interaction.servingTableEmpty";
  }
  return null;
}

function previewInventoryRecipe(inventory, recipe) {
  if (getInventoryQuantity(inventory, recipe.input) < 1) {
    const status = recipe.input === "potato"
      ? "no-raw-potatoes"
      : recipe.input === "sliced-potato" ? "no-prepared-potatoes" : `no-${recipe.input}`;
    const messageKey = recipe.input === "potato"
      ? "hud:interaction.noRawPotatoes"
      : recipe.input === "sliced-potato" ? "hud:interaction.noPreparedPotatoes" : null;
    return { status, messageKey };
  }
  const next = normalizeInventory(inventory);
  takeInventoryItem(next, recipe.input, 1);
  const capacity = canAddInventoryItem(next, createInventoryItem(recipe.output, 1));
  return capacity.canAdd
    ? { status: "available" }
    : { status: "inventory-full", messageKey: "hud:interaction.inventoryFull" };
}

function applyInventoryRecipe(inventory, recipe) {
  const preview = previewInventoryRecipe(inventory, recipe);
  if (preview.status !== "available") return { ...preview, mutated: false };
  const next = normalizeInventory(inventory);
  const input = takeInventoryItem(next, recipe.input, 1);
  const output = addInventoryItem(next, createInventoryItem(recipe.output, 1));
  if (!input.mutated || !output.mutated) return { status: "inventory-full", mutated: false };
  commitInventory(inventory, next);
  return { status: "completed", mutated: true, input, output, inventory: output };
}

function commitInventory(target, source) {
  target.slots.splice(0, target.slots.length, ...source.slots.map((slot) => (slot ? { ...slot } : null)));
}

function chooseTargetPosition(targetWidth, randomSource) {
  const usableWidth = Math.max(0, 1 - targetWidth);
  const number = Number(randomSource?.());
  const unit = Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
  return unit * usableWidth;
}
