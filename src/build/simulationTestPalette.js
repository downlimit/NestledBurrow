import {
  addInventoryItemUpTo,
  createInventoryItem,
  INVENTORY_ITEM_IDS,
} from "../inventory/inventoryDomain.js";
import {
  isLivingPopulationPerson,
  PERSON_GAME_DAY_SECONDS,
  PERSON_LIFE_STAGES,
  PERSON_LIFE_STATUSES,
  PERSON_RELATIONSHIP_KINDS,
} from "../character/populationDomain.js";
import {
  advancePopulationLifecycle,
  ensureMaturePopulation,
} from "../character/populationLifecycleDomain.js";
import { getCurrentWorldScene } from "./worldSceneRegistry.js";

const POPULATION_TEST_SANDBOXES = new WeakMap();
const POPULATION_STAGE_ORDER = Object.freeze([
  PERSON_LIFE_STAGES.newborn,
  PERSON_LIFE_STAGES.infant,
  PERSON_LIFE_STAGES.toddler,
  PERSON_LIFE_STAGES.child,
  PERSON_LIFE_STAGES.teen,
  PERSON_LIFE_STAGES.youngAdult,
  PERSON_LIFE_STAGES.adult,
  PERSON_LIFE_STAGES.elder,
]);

const POPULATION_ACTIONS = Object.freeze({
  day1: populationActionQuantity("advance", 1, "1d"),
  day10: populationActionQuantity("advance", 10, "10d"),
  day100: populationActionQuantity("advance", 100, "100d"),
  drop240: populationActionQuantity("drop", 240, "240"),
  reset: populationActionQuantity("reset", 0, "↺"),
});

const POPULATION_TEST_ITEMS = Object.freeze([
  populationReadoutItem("population-summary", () => populationSummaryLabel()),
  populationReadoutItem("population-stages-young", () => populationStageLabel(0)),
  populationReadoutItem("population-stages-adult", () => populationStageLabel(1)),
  Object.freeze({
    id: "coins",
    labelKey: "build:test.population.advance",
    quantities: Object.freeze([POPULATION_ACTIONS.day1, POPULATION_ACTIONS.day10]),
    populationTest: true,
  }),
  Object.freeze({
    id: "coins",
    labelKey: "build:test.population.longRun",
    quantities: Object.freeze([POPULATION_ACTIONS.day100]),
    populationTest: true,
  }),
  Object.freeze({
    id: "coins",
    labelKey: "build:test.population.drop",
    quantities: Object.freeze([POPULATION_ACTIONS.drop240]),
    populationTest: true,
  }),
  Object.freeze({
    id: "coins",
    labelKey: "build:test.population.reset",
    quantities: Object.freeze([POPULATION_ACTIONS.reset]),
    populationTest: true,
  }),
  populationReadoutItem("population-event-0", () => populationEventLabel(0)),
  populationReadoutItem("population-event-1", () => populationEventLabel(1)),
]);

export const SIMULATION_TEST_GROUPS = Object.freeze([
  Object.freeze({
    id: "food",
    labelKey: "hud:buildMode.test.groups.food",
    items: Object.freeze([
      Object.freeze({ id: "fried-potato-dish", labelKey: "hud:buildMode.test.items.friedPotato" }),
      Object.freeze({ id: "lemonade", labelKey: "hud:buildMode.test.items.lemonade" }),
      Object.freeze({ id: "sliced-potato", labelKey: "hud:buildMode.test.items.slicedPotato" }),
    ]),
  }),
  Object.freeze({
    id: "produce",
    labelKey: "hud:buildMode.test.groups.produce",
    items: Object.freeze([
      Object.freeze({ id: "potato", labelKey: "hud:buildMode.test.items.potato" }),
      Object.freeze({ id: "lemon", labelKey: "hud:buildMode.test.items.lemon" }),
    ]),
  }),
  Object.freeze({
    id: "seeds",
    labelKey: "hud:buildMode.test.groups.seeds",
    items: Object.freeze([
      Object.freeze({ id: "potato-seed", labelKey: "hud:buildMode.test.items.potatoSeed" }),
      Object.freeze({ id: "lemon-seed", labelKey: "hud:buildMode.test.items.lemonSeed" }),
    ]),
  }),
  Object.freeze({
    id: "resources",
    labelKey: "hud:buildMode.test.groups.resources",
    items: Object.freeze([
      Object.freeze({ id: "wood", labelKey: "hud:buildMode.test.items.wood" }),
      Object.freeze({ id: "stone", labelKey: "hud:buildMode.test.items.stone" }),
      Object.freeze({ id: "ruby", labelKey: "hud:buildMode.test.items.ruby" }),
    ]),
  }),
  Object.freeze({
    id: "economy",
    labelKey: "hud:buildMode.test.groups.economy",
    items: Object.freeze([
      Object.freeze({ id: "coins", labelKey: "hud:buildMode.test.items.coins", quantities: Object.freeze([100]) }),
    ]),
  }),
  Object.freeze({
    id: "population",
    labelKey: "build:test.population.group",
    items: POPULATION_TEST_ITEMS,
  }),
]);

const PALETTE_ITEM_IDS = Object.freeze(SIMULATION_TEST_GROUPS
  .flatMap((group) => group.items)
  .filter((item) => !item.populationTest)
  .map((item) => item.id)
  .filter((itemId) => itemId !== "coins"));

for (const itemId of PALETTE_ITEM_IDS) {
  if (!INVENTORY_ITEM_IDS.includes(itemId)) throw new Error(`Unknown simulation test item: ${itemId}`);
}

export function grantSimulationTestItem(gameplay, itemId, quantity) {
  if (!gameplay?.inventory || !PALETTE_ITEM_IDS.includes(itemId)) {
    return { status: "invalid-test-item", mutated: false, accepted: 0, remaining: 0 };
  }
  const requested = Number(quantity);
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return { status: "invalid-quantity", mutated: false, accepted: 0, remaining: 0 };
  }
  return addInventoryItemUpTo(gameplay.inventory, createInventoryItem(itemId, requested));
}

export function grantSimulationTestCoins(gameplay, amount = 100) {
  if (amount?.populationAction) return applyPopulationTestAction(gameplay, amount.populationAction);
  const requested = Number(amount);
  const current = Number(gameplay?.coins);
  if (!gameplay || !Number.isSafeInteger(requested) || requested <= 0 || !Number.isSafeInteger(current) || current < 0) {
    return { status: "invalid-coin-grant", mutated: false, value: 0 };
  }
  if (!Number.isSafeInteger(current + requested)) return { status: "coin-limit", mutated: false, value: 0 };
  gameplay.coins = current + requested;
  return { status: "coins-granted", mutated: true, value: requested, coins: gameplay.coins };
}

export function getSimulationTestItemIds() {
  return [...PALETTE_ITEM_IDS];
}

export function getSimulationPopulationTestSnapshot(gameplay) {
  const sandbox = ensurePopulationSandbox(gameplay);
  if (!sandbox) return null;
  const alive = sandbox.population.filter(isLivingPopulationPerson);
  const stageCounts = Object.fromEntries(POPULATION_STAGE_ORDER.map((stage) => [
    stage,
    alive.filter((person) => person.lifeStage === stage).length,
  ]));
  return {
    worldTimeSeconds: sandbox.worldTimeSeconds,
    elapsedDays: sandbox.elapsedDays,
    aliveCount: alive.length,
    deadCount: sandbox.population.length - alive.length,
    totalCount: sandbox.population.length,
    stageCounts,
    lastRun: { ...sandbox.lastRun },
    events: sandbox.events.map((event) => ({ ...event, parentNames: [...(event.parentNames ?? [])] })),
  };
}

export function resetSimulationPopulationTest(gameplay) {
  if (!gameplay || typeof gameplay !== "object") return null;
  POPULATION_TEST_SANDBOXES.delete(gameplay);
  return getSimulationPopulationTestSnapshot(gameplay);
}

function applyPopulationTestAction(gameplay, action) {
  const sandbox = ensurePopulationSandbox(gameplay);
  if (!sandbox) return { status: "population-test-unavailable", mutated: false, value: 0 };
  if (action.kind === "reset") {
    resetSimulationPopulationTest(gameplay);
    return { status: "population-test-reset", mutated: false, value: 0, populationTest: true };
  }
  if (action.kind === "drop") {
    const target = Math.max(0, Math.floor(Number(action.value) || 0));
    const living = sandbox.population.filter(isLivingPopulationPerson);
    const removeCount = Math.max(0, living.length - target);
    const candidates = living
      .filter((person) => person.id.startsWith("person-seed-") || person.id.startsWith("person-born-"))
      .sort((a, b) => b.id.localeCompare(a.id));
    for (const person of candidates.slice(0, removeCount)) person.lifeStatus = PERSON_LIFE_STATUSES.dead;
    sandbox.lastRun = { days: 0, births: 0, deaths: Math.min(removeCount, candidates.length), stress: true };
    sandbox.events = [{ type: "stress", count: Math.min(removeCount, candidates.length) }];
    return { status: "population-test-dropped", mutated: false, value: 0, populationTest: true };
  }
  if (action.kind !== "advance") return { status: "population-test-invalid-action", mutated: false, value: 0 };

  const days = Math.max(0, Math.floor(Number(action.value) || 0));
  if (days <= 0) return { status: "population-test-invalid-days", mutated: false, value: 0 };
  const beforeLiving = new Map(sandbox.population.filter(isLivingPopulationPerson).map((person) => [person.id, person.displayName]));
  const beforeLength = sandbox.population.length;
  const targetTime = sandbox.worldTimeSeconds + days * PERSON_GAME_DAY_SECONDS;
  const summary = advancePopulationLifecycle(sandbox.population, targetTime);
  sandbox.worldTimeSeconds = targetTime;
  sandbox.elapsedDays += days;
  sandbox.lastRun = { days, births: summary.births, deaths: summary.deaths, stress: false };

  const births = sandbox.population.slice(beforeLength).map((person) => ({
    type: "birth",
    personId: person.id,
    displayName: person.displayName,
    parentNames: person.relationships
      .filter(({ kind }) => kind === PERSON_RELATIONSHIP_KINDS.child)
      .map(({ personId }) => sandbox.population.find((candidate) => candidate.id === personId)?.displayName)
      .filter(Boolean)
      .slice(0, 2),
  }));
  const deaths = [...beforeLiving.entries()]
    .filter(([personId]) => sandbox.population.find((person) => person.id === personId)?.lifeStatus === PERSON_LIFE_STATUSES.dead)
    .map(([personId, displayName]) => ({ type: "death", personId, displayName, parentNames: [] }));
  sandbox.events = [...births, ...deaths].slice(-6).reverse();
  return {
    status: "population-test-advanced",
    mutated: false,
    value: 0,
    populationTest: true,
    days,
    births: summary.births,
    deaths: summary.deaths,
    aliveCount: summary.aliveCount,
  };
}

function ensurePopulationSandbox(gameplay) {
  if (!gameplay || typeof gameplay !== "object" || !Array.isArray(gameplay.population)) return null;
  let sandbox = POPULATION_TEST_SANDBOXES.get(gameplay);
  if (sandbox) return sandbox;
  const population = JSON.parse(JSON.stringify(gameplay.population));
  const worldTimeSeconds = Math.max(0, Number(gameplay.worldTimeSeconds) || 0);
  ensureMaturePopulation(population, worldTimeSeconds);
  sandbox = {
    population,
    worldTimeSeconds,
    elapsedDays: 0,
    lastRun: { days: 0, births: 0, deaths: 0, stress: false },
    events: [],
  };
  POPULATION_TEST_SANDBOXES.set(gameplay, sandbox);
  return sandbox;
}

function populationReadoutItem(id, labelFactory) {
  return Object.freeze({
    id: "coins",
    populationTest: true,
    quantities: Object.freeze([]),
    get labelKey() { return labelFactory(); },
    debugId: id,
  });
}

function populationActionQuantity(kind, value, label) {
  return Object.freeze({
    populationAction: Object.freeze({ kind, value }),
    valueOf() { return Number(value) || 0; },
    toString() { return label; },
  });
}

function activePopulationSnapshot() {
  return getSimulationPopulationTestSnapshot(getCurrentWorldScene()?.sessionState?.gameplay);
}

function populationSummaryLabel() {
  const snapshot = activePopulationSnapshot();
  if (!snapshot) return "POPULATION unavailable";
  const ru = getCurrentWorldScene()?.localization?.getLanguage?.() === "ru";
  const run = snapshot.lastRun;
  return ru
    ? `ЖИВ ${snapshot.aliveCount} · УМ ${snapshot.deadCount} · Р/С ${run.births}/${run.deaths}`
    : `LIVE ${snapshot.aliveCount} · DEAD ${snapshot.deadCount} · B/D ${run.births}/${run.deaths}`;
}

function populationStageLabel(row) {
  const snapshot = activePopulationSnapshot();
  if (!snapshot) return "—";
  const c = snapshot.stageCounts;
  const ru = getCurrentWorldScene()?.localization?.getLanguage?.() === "ru";
  if (row === 0) {
    return ru
      ? `0–17 · Н ${c.newborn} Мл ${c.infant} М ${c.toddler} Р ${c.child} П ${c.teen}`
      : `0–17 · N ${c.newborn} I ${c.infant} T ${c.toddler} C ${c.child} Teen ${c.teen}`;
  }
  return ru
    ? `18+ · МВ ${c.youngAdult} В ${c.adult} Пож ${c.elder}`
    : `18+ · YA ${c.youngAdult} A ${c.adult} E ${c.elder}`;
}

function populationEventLabel(index) {
  const snapshot = activePopulationSnapshot();
  const event = snapshot?.events?.[index];
  const ru = getCurrentWorldScene()?.localization?.getLanguage?.() === "ru";
  if (!event) return ru ? "СОБЫТИЕ · —" : "EVENT · —";
  if (event.type === "birth") {
    const parents = event.parentNames.map(shortName).join("+");
    return `${ru ? "Р" : "B"} · ${shortName(event.displayName)}${parents ? ` ← ${parents}` : ""}`;
  }
  if (event.type === "death") return `${ru ? "С" : "D"} · †${shortName(event.displayName)}`;
  return `${ru ? "ТЕСТ" : "TEST"} · -${event.count}`;
}

function shortName(value) {
  const text = String(value ?? "?");
  return text.length <= 14 ? text : `${text.slice(0, 12)}…`;
}
