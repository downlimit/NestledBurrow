import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SPENDING_CAPACITY_WEIGHTS } from "../src/character/populationDomain.js";
import {
  GENERAL_HELPER_AUTOMATION,
  MASTER_AUTOMATION,
  RECIPE_BALANCE_PLACEHOLDERS,
  RECIPE_BALANCE_PRICES,
  RECIPE_ROUTINE_WORK,
  RECIPE_SKILLED_WORK,
  RECIPE_TOTAL_WORK,
  SPECIALIZED_HELPER_AUTOMATION,
  automationAttemptMultiplier,
  automationResidualWork,
  calibratedOccasionRate,
  expectedOrderChance,
  expectedRevenuePerDay,
} from "./task-104-recipe-economy.mjs";

const CANONICAL = [22, 31, 24, 16, 7];
const POOR = [35, 35, 20, 8, 2];
const RICH = [5, 15, 25, 30, 25];
const NORMAL_OPPORTUNITIES = 24;
const WORK_CAPACITY = 50;

assert.deepEqual(SPENDING_CAPACITY_WEIGHTS, CANONICAL);
assert.deepEqual(RECIPE_BALANCE_PRICES, [10, 30, 80, 200, 500]);
assert.deepEqual(RECIPE_TOTAL_WORK, [1, 3, 8, 20, 50]);
assert.deepEqual(RECIPE_SKILLED_WORK, [1, 2, 4, 7, 10]);
assert.deepEqual(RECIPE_ROUTINE_WORK, [0, 1, 4, 13, 40]);
assert.equal(RECIPE_BALANCE_PLACEHOLDERS.length, 5);
for (let index = 0; index < 5; index += 1) {
  assert.equal(RECIPE_BALANCE_PRICES[index] / RECIPE_TOTAL_WORK[index], 10);
  assert(Math.abs(expectedRevenuePerDay(index, NORMAL_OPPORTUNITIES, CANONICAL) - 240) < 1e-6);
  assert(Math.abs(RECIPE_BALANCE_PRICES[index] * WORK_CAPACITY / RECIPE_TOTAL_WORK[index] - 500) < 1e-6);
}

const occasions = Array.from({ length: 5 }, (_, index) => calibratedOccasionRate(index));
const expectedOccasions = [1, 0.374848, 0.184313, 0.110481, 0.07693];
for (let index = 0; index < 5; index += 1) {
  assert(Math.abs(occasions[index] - expectedOccasions[index]) < 0.00001);
}

const poorRevenue = RECIPE_BALANCE_PRICES.map((_, index) => (
  expectedRevenuePerDay(index, NORMAL_OPPORTUNITIES, POOR)
));
const richRevenue = RECIPE_BALANCE_PRICES.map((_, index) => (
  expectedRevenuePerDay(index, NORMAL_OPPORTUNITIES, RICH)
));
assert(strictlyDescending(poorRevenue));
assert(strictlyAscending(richRevenue));
assert(poorRevenue[4] > 155 && poorRevenue[4] < 165);
assert(richRevenue[4] > 440 && richRevenue[4] < 450);

for (let index = 0; index < 5; index += 1) {
  assert(Math.abs(expectedRevenuePerDay(index, 10, CANONICAL) - 100) < 1e-6);
  assert(Math.abs(expectedRevenuePerDay(index, 42, CANONICAL) - 420) < 1e-6);
}

const generalResidual = RECIPE_BALANCE_PRICES.map((_, index) => (
  automationResidualWork(index, GENERAL_HELPER_AUTOMATION)
));
const specializedResidual = RECIPE_BALANCE_PRICES.map((_, index) => (
  automationResidualWork(index, SPECIALIZED_HELPER_AUTOMATION)
));
assert.deepEqual(generalResidual.map(round2), [0.05, 0.4, 1.8, 5.5, 12]);
assert.deepEqual(specializedResidual.map(round2), [0, 0.12, 0.88, 3.06, 7.3]);
assert.deepEqual(RECIPE_BALANCE_PRICES.map((_, index) => round2(
  automationAttemptMultiplier(index, GENERAL_HELPER_AUTOMATION),
)), [1, 1.11, 1.54, 2.5, 5]);
assert.deepEqual(RECIPE_BALANCE_PRICES.map((_, index) => round2(
  automationAttemptMultiplier(index, SPECIALIZED_HELPER_AUTOMATION),
)), [1, 1, 1.11, 1.43, 2.22]);
assert.deepEqual(RECIPE_BALANCE_PRICES.map((_, index) => round2(
  automationAttemptMultiplier(index, MASTER_AUTOMATION),
)), [1, 1, 1, 1.05, 1.18]);

const DAYS = 50_000;
const random = seededRandom(0x104cafe);
for (let recipeIndex = 0; recipeIndex < 5; recipeIndex += 1) {
  const chance = expectedOrderChance(recipeIndex, CANONICAL);
  let totalOrders = 0;
  let zeroDays = 0;
  for (let day = 0; day < DAYS; day += 1) {
    let dailyOrders = 0;
    for (let opportunity = 0; opportunity < NORMAL_OPPORTUNITIES; opportunity += 1) {
      if (random() < chance) dailyOrders += 1;
    }
    totalOrders += dailyOrders;
    if (dailyOrders === 0) zeroDays += 1;
  }
  const revenuePerDay = totalOrders * RECIPE_BALANCE_PRICES[recipeIndex] / DAYS;
  assert(Math.abs(revenuePerDay - 240) < 4, `tier ${recipeIndex + 1} long-run revenue drifted: ${revenuePerDay}`);
  const expectedZeroRate = Math.pow(1 - chance, NORMAL_OPPORTUNITIES);
  const actualZeroRate = zeroDays / DAYS;
  assert(Math.abs(actualZeroRate - expectedZeroRate) < 0.012, `tier ${recipeIndex + 1} volatility drifted`);
}

const gameDoc = readFileSync("GAME.md", "utf8");
const tavernDoc = readFileSync("systems/tavern-service.md", "utf8");
const roadmap = readFileSync("ROADMAP.md", "utf8");
for (const phrase of ["Простые процессы", "Жёсткого потолка автоматизации нет"]) assert(gameDoc.includes(phrase));
for (const phrase of ["10 / 30 / 80 / 200 / 500", "1 / 3 / 8 / 20 / 50", "0 / 1 / 4 / 13 / 40"]) assert(tavernDoc.includes(phrase));
assert(roadmap.includes("Task #104 — Плейсхолдерная экономика рецептов и автоматизация"));
assert(roadmap.includes("Task #105"));

console.log("Task #104 placeholder recipe economy check passed: canonical strategies stay equal, audience composition changes their value, premium sales are volatile, and automation removes routine work before skilled work");

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function strictlyDescending(values) {
  return values.every((value, index) => index === 0 || value < values[index - 1]);
}

function strictlyAscending(values) {
  return values.every((value, index) => index === 0 || value > values[index - 1]);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
