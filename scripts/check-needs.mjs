import assert from "node:assert/strict";
import { FACILITIES } from "../src/facilities/facilityConfig.js";
import { DEFAULT_NEEDS, NEED_IDS, NEED_SYMBOLS, applyNeedsUpdate, computeNeedRates, normalizeNeeds } from "../src/needs/needsDomain.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resources/resourceConfig.js";

const tuning = DEFAULT_GAMEPLAY_TUNING.needs;
assert(Object.isFrozen(tuning) && Object.isFrozen(tuning.toolCosts), "needs tuning is immutable");
assert.deepEqual(tuning.toolCosts, { axe: 0.2, pickaxe: 0.3, hoe: 0.15, watering: 0.1, sword: 0.75, "battle-axe": 0.1 });
assert.equal(NEED_IDS.map((id) => NEED_SYMBOLS[id]).join(""), "NESTLD", "canonical HUD order is NESTLD");
assert.deepEqual(normalizeNeeds(), DEFAULT_NEEDS, "fresh needs start full");
assert.deepEqual(normalizeNeeds({ novelty: -5, satiety: 140, toilet: Number.NaN, lustre: Infinity, dialogue: 40 }), {
  novelty: 0, satiety: 100, toilet: 100, lustre: 100, dialogue: 40,
}, "normalization clamps finite values and repairs invalid values");
assert.deepEqual(computeNeedRates({ needs: DEFAULT_NEEDS }, tuning), {
  novelty: -1, satiety: -7, toilet: -6, lustre: -1, dialogue: -2,
});
const idle = { ...DEFAULT_NEEDS };
applyNeedsUpdate(idle, 60, {}, tuning);
assert.deepEqual(idle, { novelty: 99, satiety: 93, toilet: 94, lustre: 99, dialogue: 98 }, "sixty real seconds advance one waking game hour");
assert.equal(computeNeedRates({ facility: "shower", needs: DEFAULT_NEEDS }, tuning).lustre, 600);
assert.equal(computeNeedRates({ facility: "toilet", needs: DEFAULT_NEEDS }, tuning).toilet, 600);
assert.equal(computeNeedRates({ facility: "table", needs: DEFAULT_NEEDS }, tuning).satiety, 600);
assert.equal(computeNeedRates({ running: true, needs: DEFAULT_NEEDS }, tuning).lustre, -2);
assert.equal(computeNeedRates({ activePhysicalTool: "watering", needs: DEFAULT_NEEDS }, tuning).lustre, -1.5);
assert.equal(computeNeedRates({ npcNearby: true, needs: DEFAULT_NEEDS }, tuning).dialogue, 0, "friendly proximity pauses D loss");
assert.equal(new Set(FACILITIES.map((item) => item.id)).size, 8, "facilities have stable unique IDs");
assert.deepEqual(FACILITIES.map((item) => item.facilityType), ["shower", "toilet", "table", "cutting-table", "gas-stove", "serving-table", "lemon-sack", "juicer"]);
assert(FACILITIES.every((item) => Object.isFrozen(item) && Object.isFrozen(item.usePosition)), "facility registry is immutable");
console.log("needs checks passed: canonical hourly rates, HUD order, facilities, proximity and clamp");
