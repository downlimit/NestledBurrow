import assert from "node:assert/strict";
import { FACILITIES } from "../src/facilityConfig.js";
import {
  DEFAULT_NEEDS,
  NEED_IDS,
  NEED_SYMBOLS,
  applyNeedsUpdate,
  computeNeedRates,
  normalizeNeeds,
} from "../src/needsDomain.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resourceConfig.js";

const tuning = DEFAULT_GAMEPLAY_TUNING.needs;
assert(Object.isFrozen(tuning) && Object.isFrozen(tuning.novelty) && Object.isFrozen(tuning.flowArrowRatios), "needs tuning is immutable");
assert.deepEqual(NEED_IDS.map((id) => NEED_SYMBOLS[id]).join(""), "NESTLD", "canonical HUD order is NESTLD");
assert.deepEqual(normalizeNeeds(), DEFAULT_NEEDS, "fresh needs start full");
assert.deepEqual(normalizeNeeds({ novelty: -5, satiety: 140, toilet: Number.NaN, lustre: Infinity, dialogue: 40 }), {
  novelty: 0, satiety: 100, toilet: 100, lustre: 100, dialogue: 40,
}, "normalization clamps finite values and repairs invalid values");

const idleRates = computeNeedRates({}, tuning);
assert.deepEqual(idleRates, { novelty: -0.25, satiety: -0.165, toilet: -0.225, lustre: -0.15, dialogue: -0.05 });
const idle = { ...DEFAULT_NEEDS };
applyNeedsUpdate(idle, 10, {}, tuning);
assert.deepEqual(idle, { novelty: 97.5, satiety: 98.35, toilet: 97.75, lustre: 98.5, dialogue: 99.5 }, "ten real seconds apply reduced base rates");

assert.deepEqual(computeNeedRates({ facility: "shower" }, tuning), { novelty: -0.25, satiety: -0.165, toilet: -0.1125, lustre: 10, dialogue: -0.05 });
assert.deepEqual(computeNeedRates({ facility: "toilet" }, tuning), { novelty: -0.25, satiety: -0.165, toilet: 10, lustre: -0.22499999999999998, dialogue: -0.05 });
assert.equal(computeNeedRates({ facility: "table" }, tuning).satiety, 10);
assert.deepEqual(
  { novelty: computeNeedRates({ running: true }, tuning).novelty, satiety: computeNeedRates({ running: true }, tuning).satiety },
  { novelty: 9, satiety: -0.21450000000000002 },
);
assert.deepEqual(
  { novelty: computeNeedRates({ running: true, activeResourceKind: "log" }, tuning).novelty, satiety: computeNeedRates({ running: true, activeResourceKind: "log" }, tuning).satiety },
  { novelty: -1.5, satiety: -0.495 },
  "resource activity wins over running",
);
assert.deepEqual(
  { novelty: computeNeedRates({ activeResourceKind: "ruby" }, tuning).novelty, satiety: computeNeedRates({ activeResourceKind: "ruby" }, tuning).satiety },
  { novelty: 8, satiety: -0.495 },
);
assert.equal(computeNeedRates({ npcNearby: true }, tuning).dialogue, 0.5, "one or many nearby NPCs resolve to the reduced dialogue rate");

const clamped = { novelty: 99, satiety: 1, toilet: 99, lustre: 1, dialogue: 99 };
applyNeedsUpdate(clamped, 10, { facility: "shower", npcNearby: true }, tuning);
assert.deepEqual(clamped, { novelty: 96.5, satiety: 0, toilet: 97.875, lustre: 100, dialogue: 100 }, "atomic update clamps every need to 0..100");
assert.equal(new Set(FACILITIES.map((item) => item.id)).size, 6, "facilities have stable unique IDs");
assert.deepEqual(FACILITIES.map((item) => item.facilityType), ["shower", "toilet", "table", "cutting-table", "gas-stove", "serving-table"]);
assert.deepEqual(FACILITIES.slice(0, 3).map((item) => item.stopPrompt), [
  "hud:interaction.leaveShower",
  "hud:interaction.leaveToilet",
  "hud:interaction.stopEating",
], "toggle facilities expose the logical stop action");
assert.deepEqual(FACILITIES.slice(3).map((item) => [item.prompt, item.stopPrompt]), [
  ["hud:interaction.startPreparation", "hud:interaction.startPreparation"],
  ["hud:interaction.startFrying", "hud:interaction.startFrying"],
  ["hud:interaction.serveDish", "hud:interaction.takeDish"],
], "kitchen facilities expose their initial actions and serving reversal");
assert(FACILITIES.every((item) => Object.isFrozen(item) && Object.isFrozen(item.usePosition)), "facility registry is immutable");

console.log("needs checks passed: rates, priorities, clamp, arrows tuning and facilities");
