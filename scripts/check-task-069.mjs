import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { useCombatNumberSlot, COMBAT_QUICK_USE_PROFILES } from "../src/inventory/combatQuickUse.js";
import { createNeedsRuntime } from "../src/needs/needsRuntime.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/resources/resourceConfig.js";
import {
  advancePuddleProgress,
  isCanonicalNight,
  puddleAlpha,
  puddleCell,
  puddleDryProgressPerRealSecond,
  PUDDLE_DAY_DRY_PROGRESS_PER_REAL_SECOND,
  PUDDLE_MULTIPLY_BLEND_MODE,
  PUDDLE_NIGHT_DRY_PROGRESS_PER_REAL_SECOND,
  puddleSpriteCenter,
} from "../src/world/puddleDomain.js";
import { createPuddleRuntime, PUDDLE_DEPTH, PUDDLE_TEXTURE_KEY, PUDDLE_ASSET } from "../src/world/puddleRuntime.js";
import { secondsOfDay } from "../src/session/gameClock.js";

const tuning = DEFAULT_GAMEPLAY_TUNING.needs;
const close = (actual, expected, message) => assert(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} !== ${expected}`);

function gameplayFixture() {
  return {
    currentEnergy: 80,
    needs: { novelty: 50, satiety: 40, toilet: 50, lustre: 35, dialogue: 50 },
    farm: { waterBucket: { currentWater: 2, capacity: 8 } },
    combatLoadout: {
      slots: [null, null, null, null,
        { id: "fried-potato-dish", kind: "loot", quantity: 2 },
        { id: "water-bucket", kind: "tool", quantity: 1 },
        null, null, null, null],
    },
  };
}

function freshState({ needs = {} } = {}) {
  return {
    gameplay: {
      currentEnergy: 100,
      maximumEnergy: 100,
      needs: { novelty: 50, satiety: 100, toilet: 50, lustre: 35, dialogue: 100, ...needs },
    },
  };
}

{
  const profile = COMBAT_QUICK_USE_PROFILES["water-bucket"];
  assert.equal(profile.needId, "lustre");
  assert.equal(profile.amount, 20);
  assert.equal(profile.consumeWater, 1);
  assert.deepEqual(profile.needDeltas, { toilet: -5 });
  assert.equal(profile.repetitionKey, "water-bucket");
  assert.equal(profile.spawnPuddle, true);
}

{
  const gameplay = gameplayFixture();
  const result = useCombatNumberSlot(gameplay, 5);
  assert.equal(result.status, "used");
  assert.equal(result.amount, 20);
  assert.equal(result.toiletDelta, -5);
  assert.equal(result.noveltyDelta, 0);
  assert.equal(result.spawnPuddle, true);
  assert.equal(gameplay.needs.lustre, 55);
  assert.equal(gameplay.needs.toilet, 45);
  assert.equal(gameplay.needs.novelty, 50);
  assert.equal(gameplay.farm.waterBucket.currentWater, 1);
}

{
  const gameplay = gameplayFixture();
  gameplay.needs.lustre = 100;
  const result = useCombatNumberSlot(gameplay, 5, { recordSelfUse: () => ({ noveltyDelta: 0 }) });
  assert.equal(result.status, "need-full");
  assert.equal(gameplay.needs.lustre, 100);
  assert.equal(gameplay.needs.toilet, 50);
  assert.equal(gameplay.farm.waterBucket.currentWater, 2);
}

{
  const gameplay = gameplayFixture();
  gameplay.farm.waterBucket.currentWater = 0;
  const result = useCombatNumberSlot(gameplay, 5, { recordSelfUse: () => ({ noveltyDelta: 0 }) });
  assert.equal(result.status, "bucket-empty");
  assert.equal(gameplay.needs.lustre, 35);
  assert.equal(gameplay.needs.toilet, 50);
  assert.equal(gameplay.farm.waterBucket.currentWater, 0);
}

{
  const gameplay = gameplayFixture();
  const result = useCombatNumberSlot(gameplay, 5, {
    recordSelfUse: () => ({ consecutiveSelfUses: 2, noveltyDelta: 0 }),
  });
  assert.equal(result.consecutiveSelfUses, 2);
  assert.equal(result.noveltyDelta, 0);
}

const repetitionState = freshState();
const repetitionRuntime = createNeedsRuntime({ sessionState: repetitionState, tuning });
const bucketUse = () => repetitionRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
for (let index = 0; index < 3; index += 1) {
  assert.equal(bucketUse().noveltyDelta, 0, `first three bucket uses never drain N (use ${index + 1})`);
}
assert.equal(repetitionState.gameplay.needs.novelty, 50);
assert.equal(bucketUse().noveltyDelta, -1, "fourth consecutive bucket use drains one N");
assert.equal(repetitionState.gameplay.needs.novelty, 49);
assert.equal(bucketUse().noveltyDelta, -1, "fifth consecutive bucket use drains one N");
assert.equal(repetitionState.gameplay.needs.novelty, 48);
assert.equal(repetitionRuntime.getState().consecutiveSelfUses, 5);

const resetState = freshState({ needs: { novelty: 50 } });
const resetRuntime = createNeedsRuntime({ sessionState: resetState, tuning });
const bucketResetUse = () => resetRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
bucketResetUse();
bucketResetUse();
bucketResetUse();
assert.equal(resetRuntime.getState().consecutiveSelfUses, 3);
const otherAction = resetRuntime.recordSelfUse("fried-potato-dish");
assert.equal(otherAction.noveltyDelta, 0);
assert.equal(otherAction.consecutiveSelfUses, 1);
assert.equal(resetRuntime.getState().consecutiveSelfUses, 1);
bucketResetUse();
bucketResetUse();
assert.equal(bucketResetUse().noveltyDelta, 0, "another self-use resets the bucket sequence like a physical action");
assert.equal(resetRuntime.getState().consecutiveSelfUses, 3);

const labourResetState = freshState({ needs: { novelty: 50 } });
const labourResetRuntime = createNeedsRuntime({ sessionState: labourResetState, tuning });
const labourBucketUse = () => labourResetRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
labourBucketUse();
labourBucketUse();
labourBucketUse();
assert.equal(labourResetRuntime.getState().consecutiveSelfUses, 3);
labourResetRuntime.recordPhysicalAction("axe");
assert.equal(labourResetRuntime.getState().consecutiveSelfUses, 0, "physical action resets the self-use sequence");
labourResetRuntime.recordPhysicalAction("axe");
labourResetRuntime.recordPhysicalAction("axe");
labourResetRuntime.recordPhysicalAction("axe");
assert.equal(labourResetRuntime.getState().consecutiveLabourActions, 4);
labourResetRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
assert.equal(labourResetRuntime.getState().consecutiveLabourActions, 0, "self-use resets the labour sequence");

const activityResetState = freshState({ needs: { novelty: 50 } });
const activityResetRuntime = createNeedsRuntime({ sessionState: activityResetState, tuning });
const activityBucketUse = () => activityResetRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
activityBucketUse();
activityBucketUse();
activityBucketUse();
assert.equal(activityResetRuntime.getState().consecutiveSelfUses, 3);
activityResetRuntime.update({ realSeconds: 0, activity: { moving: true } });
assert.equal(activityResetRuntime.getState().consecutiveSelfUses, 0, "another non-ordinary activity resets the sequence");
activityBucketUse();
activityBucketUse();
assert.equal(activityBucketUse().noveltyDelta, 0, "walking between bucket uses resets the free-use count");

const fullNeedRepetitionState = freshState({ needs: { novelty: 50, lustre: 100 } });
const fullNeedRepetitionRuntime = createNeedsRuntime({ sessionState: fullNeedRepetitionState, tuning });
fullNeedRepetitionRuntime.recordSelfUse("water-bucket", { drainsNovelty: true });
const blockedGameplay = gameplayFixture();
blockedGameplay.needs.lustre = 100;
useCombatNumberSlot(blockedGameplay, 5, {
  recordSelfUse: (key, options) => fullNeedRepetitionRuntime.recordSelfUse(key, options),
});
assert.equal(
  fullNeedRepetitionRuntime.getState().consecutiveSelfUses,
  1,
  "failed activation never advances the repetition sequence",
);

assert.equal(isCanonicalNight(22 * 3600), true);
assert.equal(isCanonicalNight(4 * 3600 - 1), true);
assert.equal(isCanonicalNight(4 * 3600), false);
assert.equal(isCanonicalNight(21.99 * 3600), false);
assert.equal(isCanonicalNight(0), true);
close(puddleDryProgressPerRealSecond(12 * 3600), PUDDLE_DAY_DRY_PROGRESS_PER_REAL_SECOND, "day rate");
close(puddleDryProgressPerRealSecond(23 * 3600), PUDDLE_NIGHT_DRY_PROGRESS_PER_REAL_SECOND, "night rate");
close(puddleDryProgressPerRealSecond(12 * 3600), 1 / 30, "day drying takes thirty real seconds");
close(puddleDryProgressPerRealSecond(23 * 3600), 1 / 60, "night drying takes sixty real seconds");
close(puddleAlpha(0), 1, "fresh puddle is fully opaque");
close(puddleAlpha(0.5), 0.5, "alpha follows progress linearly");
close(puddleAlpha(1), 0, "dried puddle is fully transparent");
close(advancePuddleProgress(0.9, 100, 12 * 3600), 1, "progress clamps at one");
close(advancePuddleProgress(0.5, 15, 12 * 3600), 1, "day drying closes in thirty seconds total");
close(advancePuddleProgress(0.5, 30, 23 * 3600), 1, "night drying closes in sixty seconds total");
close(advancePuddleProgress(0.5, 15, 23 * 3600), 0.75, "night dries at half the day rate");
assert.deepEqual(puddleCell({ x: 20, y: 35 }), { x: 1, y: 2 }, "puddle fixes the containing sixteen-pixel cell");
assert.deepEqual(puddleCell({ x: -1, y: 15 }), { x: -1, y: 0 }, "negative coordinates stay deterministic");
assert.deepEqual(puddleSpriteCenter({ x: 1, y: 2 }), { x: 24, y: 40 }, "24x24 sprite centers over the cell");
assert.equal(PUDDLE_MULTIPLY_BLEND_MODE, 2, "puddle uses the Phaser MULTIPLY blend mode value");

{
  const sprites = [];
  let destroyed = 0;
  const scene = {
    add: {
      image: (x, y, key) => {
        const sprite = {
          x,
          y,
          key,
          origin: null,
          depth: null,
          blendMode: null,
          alpha: 1,
          setOrigin(value) { this.origin = value; return this; },
          setDepth(value) { this.depth = value; return this; },
          setBlendMode(value) { this.blendMode = value; return this; },
          setAlpha(value) { this.alpha = value; return this; },
          destroy() { destroyed += 1; },
        };
        sprites.push(sprite);
        return sprite;
      },
    },
  };
  let worldTimeSeconds = 12 * 3600;
  const runtime = createPuddleRuntime(scene, { getWorldTimeSeconds: () => worldTimeSeconds });

  assert.equal(runtime.spawn({ x: 20, y: 35 }).status, "spawned");
  assert.equal(runtime.spawn({ x: 36, y: 40 }).status, "spawned");
  assert.equal(sprites.length, 2, "two distinct cells create two sprites");
  assert.equal(runtime.spawn({ x: 22, y: 38 }).status, "reset", "same cell resets instead of stacking");
  assert.equal(sprites.length, 2, "re-spawn never layers a second multiply sprite");
  assert.deepEqual(runtime.getState().map(({ x, y }) => ({ x, y })), [{ x: 1, y: 2 }, { x: 2, y: 2 }]);
  assert.equal(sprites[0].key, PUDDLE_TEXTURE_KEY);
  assert.equal(sprites[0].origin, 0.5);
  assert.equal(sprites[0].depth, PUDDLE_DEPTH);
  assert.equal(sprites[0].blendMode, PUDDLE_MULTIPLY_BLEND_MODE);
  assert.equal(sprites[0].alpha, 1);

  runtime.update(15_000);
  assert.equal(sprites[0].alpha, 0.5, "day puddle half-dries over fifteen real seconds");
  assert.equal(runtime.getState()[0].progress, 0.5);

  worldTimeSeconds = 23 * 3600;
  runtime.update(15_000);
  assert.equal(sprites[0].alpha, 0.25, "night transition slows the remaining drying");
  assert.equal(runtime.getState()[0].progress, 0.75);

  runtime.spawn({ x: 36, y: 40 });
  assert.equal(sprites[1].alpha, 1, "re-spawn resets the second puddle alpha and dry progress");
  assert.equal(runtime.getState().find((entry) => entry.x === 2 && entry.y === 2).progress, 0);

  worldTimeSeconds = 12 * 3600;
  runtime.update(7_500);
  assert.equal(runtime.getState().length, 1, "day residue finishes drying while the reset puddle remains");
  assert.equal(runtime.getState()[0].x, 2, "the remaining puddle is the reset cell");
  assert.equal(destroyed, 1, "a dried puddle destroys its sprite and entry");

  runtime.destroy();
  assert.equal(destroyed, 2, "teardown destroys every remaining sprite");
  assert.equal(runtime.spawn({ x: 20, y: 35 }).status, "destroyed", "a destroyed runtime rejects new puddles");
}

{
  const assetContract = readFileSync("public/assets/project/resources/NestledBurrow_Puddle.png");
  assert.equal(assetContract.length, 1255, "puddle PNG keeps the canonical byte length");
  assert.equal(PUDDLE_ASSET.path, "assets/project/resources/NestledBurrow_Puddle.png");
  assert.equal(secondsOfDay(23 * 3600) / 3600, 23, "game clock shares the canonical day window");
}

console.log("Task #069 contracts passed: bucket self-use, repetition, transient puddles, drying and teardown");
