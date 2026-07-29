import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROCEDURAL_SFX } from "../src/audioRuntime.js";
import { BED_SLEEP_DEPTH_OFFSET, sleepingCharacterDepth } from "../src/debrisRuntime.js";

const farmingSource = readFileSync(new URL("../src/farmingRuntime.js", import.meta.url), "utf8");
const debrisSource = readFileSync(new URL("../src/debrisRuntime.js", import.meta.url), "utf8");
const coinSource = readFileSync(new URL("../src/coinRuntime.js", import.meta.url), "utf8");
const cookingSource = readFileSync(new URL("../src/cookingRuntime.js", import.meta.url), "utf8");

for (const effectId of ["hoe-use", "plant-seed", "crop-impact"]) {
  assert(PROCEDURAL_SFX[effectId]?.voices?.length > 0, `${effectId} has a procedural oscillator voice`);
}
assert.notDeepEqual(PROCEDURAL_SFX["hoe-use"], PROCEDURAL_SFX["plant-seed"], "tilling and planting remain distinct");
assert.notDeepEqual(PROCEDURAL_SFX["hoe-use"], PROCEDURAL_SFX["crop-impact"], "tilling and thrown-resource impact remain distinct");
assert(PROCEDURAL_SFX["plant-seed"].voices.every((voice) => voice.gain <= 0.026), "planting stays deliberately soft");

assert.equal(BED_SLEEP_DEPTH_OFFSET, 0.25);
assert.equal(sleepingCharacterDepth(620.0007), 620.2507);
assert.equal(sleepingCharacterDepth(Number.NaN), null);
assert(/bedVisuals\.get\(sleepingBedId\)/.test(debrisSource), "sleep sorting uses the selected bed visual");
assert(/setPresentationPose\(\{ \.\.\.pose, depth \}\)/.test(debrisSource), "sleep pose receives explicit depth above the bed");

assert(/FARMING_INTERACTION_KINDS\.till[\s\S]*playEffect\("hoe-use"\)/.test(farmingSource), "successful hoe use is wired");
assert(/FARMING_INTERACTION_KINDS\.plant\) playEffect\("plant-seed"\)/.test(farmingSource), "successful planting is wired");
assert(/handleDroppedItemCollision[\s\S]*playEffect\("crop-impact"\)/.test(farmingSource), "crop impact is wired only through dropped-resource collision");
assert(!/handleDroppedItemCollision[\s\S]*playEffect\("plant-destroy"\)/.test(farmingSource), "thrown-resource impact no longer reuses manual plant destruction");
assert(/function collect\(id\)[\s\S]*playEffect\("pickup"\)[\s\S]*onCollect/.test(coinSource), "collected guest coins play the pickup cue before persistence");
assert(/if \(result\.mutated\) \{[\s\S]*playEffect\("guest-happy"\)[\s\S]*onPersistentMutation/.test(cookingSource), "completed preparation and frying play a short celebratory cue only after mutation");

console.log("task 048 checks passed: bed depth, farming, coin pickup and cooking completion audio");
