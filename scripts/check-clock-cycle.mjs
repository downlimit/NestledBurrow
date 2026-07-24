import assert from "node:assert/strict";
import {
  advanceGameTime,
  createFreshGameSessionState,
  normalizeGameSessionState,
} from "../src/gameSessionState.js";
import {
  DAY_NIGHT_COLORS,
  DEFAULT_GAME_SECONDS_PER_REAL_SECOND,
  DEFAULT_START_TIME_SECONDS,
  LEGACY_ELAPSED_GAME_SECONDS_MULTIPLIER,
  dayNightMultiplyColor,
  formatClock,
} from "../src/gameClock.js";
import { DEFAULT_GAMEPLAY_TUNING } from "../src/debrisConfig.js";

assert.equal(DEFAULT_GAME_SECONDS_PER_REAL_SECOND, 60, "one real second advances one game minute");
let state = createFreshGameSessionState();
advanceGameTime(state, 60, 1);
assert.equal(state.gameplay.worldTimeSeconds - DEFAULT_START_TIME_SECONDS, 3600, "60 real seconds advance one game hour");
state = createFreshGameSessionState();
advanceGameTime(state, 1440, 1);
assert.equal(state.gameplay.worldTimeSeconds - DEFAULT_START_TIME_SECONDS, 86400, "1440 real seconds advance one game day");
state = createFreshGameSessionState();
advanceGameTime(state, 60, 8);
assert.equal(state.gameplay.worldTimeSeconds - DEFAULT_START_TIME_SECONDS, 28800, "sleep preserves the x8 simulation scale");
assert.equal(DEFAULT_GAMEPLAY_TUNING.awakeDrainIntervalSeconds, 9.6);
assert.equal(100 * DEFAULT_GAMEPLAY_TUNING.awakeDrainIntervalSeconds * DEFAULT_GAME_SECONDS_PER_REAL_SECOND, 57600, "full energy covers sixteen game hours");

assert.equal(formatClock(0, "ru"), "00:00");
assert.equal(formatClock(21900, "ru"), "06:05");
assert.equal(formatClock(45900, "en"), "12:45 PM");

const exactColors = new Map([
  [9, DAY_NIGHT_COLORS.day],
  [17, DAY_NIGHT_COLORS.day],
  [18, DAY_NIGHT_COLORS.orange],
  [20, DAY_NIGHT_COLORS.pink],
  [22, DAY_NIGHT_COLORS.night],
  [0, DAY_NIGHT_COLORS.night],
  [4, DAY_NIGHT_COLORS.night],
  [6, DAY_NIGHT_COLORS.pink],
  [8, DAY_NIGHT_COLORS.orange],
]);
for (const [hour, color] of exactColors) assert.equal(dayNightMultiplyColor(hour * 3600), color, `exact multiply color at ${hour}:00`);
assert.equal(dayNightMultiplyColor(9 * 3600), DAY_NIGHT_COLORS.day);
for (const [hour, from, to] of [
  [17.5, DAY_NIGHT_COLORS.day, DAY_NIGHT_COLORS.orange],
  [19, DAY_NIGHT_COLORS.orange, DAY_NIGHT_COLORS.pink],
  [21, DAY_NIGHT_COLORS.pink, DAY_NIGHT_COLORS.night],
  [5, DAY_NIGHT_COLORS.night, DAY_NIGHT_COLORS.pink],
  [7, DAY_NIGHT_COLORS.pink, DAY_NIGHT_COLORS.orange],
  [8.5, DAY_NIGHT_COLORS.orange, DAY_NIGHT_COLORS.day],
]) {
  const color = dayNightMultiplyColor(hour * 3600);
  assert.notEqual(color, from, `phase ${hour}:00 has left its start color`);
  assert.notEqual(color, to, `phase ${hour}:00 has not reached its end color`);
}
assert.equal(dayNightMultiplyColor(86399.999), dayNightMultiplyColor(0), "midnight transition is continuous");
for (const boundary of [4, 6, 8, 9, 17, 18, 20, 22]) {
  const before = dayNightMultiplyColor(boundary * 3600 - 0.001);
  const at = dayNightMultiplyColor(boundary * 3600);
  assert(colorDistance(before, at) <= 1, `color remains continuous around ${boundary}:00`);
}

const legacy = createFreshGameSessionState();
legacy.gameplay = { ...legacy.gameplay, worldTimeSeconds: undefined, elapsedGameSeconds: 10 };
assert.equal(normalizeGameSessionState(legacy).gameplay.worldTimeSeconds, DEFAULT_START_TIME_SECONDS + 10 * LEGACY_ELAPSED_GAME_SECONDS_MULTIPLIER);
const current = createFreshGameSessionState();
current.gameplay = { ...current.gameplay, worldTimeSeconds: 54321, elapsedGameSeconds: 10 };
assert.equal(normalizeGameSessionState(current).gameplay.worldTimeSeconds, 54321, "canonical world time is never migrated again");

function colorDistance(a, b) {
  return Math.max(...[16, 8, 0].map((shift) => Math.abs(((a >> shift) & 0xff) - ((b >> shift) & 0xff))));
}

console.log("clock cycle checks passed");
