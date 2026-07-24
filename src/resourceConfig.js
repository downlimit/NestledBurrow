import { TILE_SIZE } from "./worldConfig.js";
import { getResourceProfile } from "./resourceDomain.js";

export const RESOURCE_INTERACTION_KIND = "work-resource";
export const PLACEMENT_CELL_SIZE = TILE_SIZE / 2;

export const DEFAULT_GAMEPLAY_TUNING = Object.freeze({
  maximumEnergy: 100,
  axeDamage: 1,
  smallLogChopHp: 7,
  energyPerHit: 1,
  awakeDrainAmount: 0.5,
  awakeWalkDrainAmount: 1.5,
  awakeRunDrainAmount: 3,
  lowEnergyIdleRegenPerSecond: 1.5,
  runSpeedMultiplier: 1.66,
  exhaustionSleepScaleMultiplier: 0.5,
  exhaustionWakeCooldownSeconds: 1.5,
  universalHitCooldownSeconds: 0.66,
  minimumFatigueSpeedMultiplier: 0.25,
  sleepTimeScale: 32,
  realSecondsPerGameDay: 1440,
  sleepEnergyPerGameHour: 12.5,
});

const descriptors = [
  ["fallen-log-01", "log-small", 12, 30], ["yard-log-02", "log-small", 15, 31], ["yard-log-03", "log-small", 18, 29], ["yard-log-04", "log-large", 21, 30],
  ["yard-log-05", "log-small", 25, 32], ["yard-log-06", "log-small", 29, 30], ["yard-log-07", "log-small", 33, 32], ["yard-log-08", "log-small", 35, 36],
  ["yard-log-09", "log-small", 98, 30], ["yard-log-10", "log-small", 102, 34], ["yard-log-11", "log-large", 107, 28], ["yard-log-12", "log-small", 112, 34],
  ["yard-stone-01", "stone-large", 91, 55], ["yard-stone-02", "stone-small", 95, 55], ["yard-stone-03", "stone-small", 91, 59], ["yard-stone-04", "stone-small", 97, 60],
  ["yard-stone-05", "stone-small", 88, 62], ["yard-stone-06", "stone-small", 102, 56], ["yard-stone-07", "stone-large", 15, 70], ["yard-stone-08", "stone-small", 19, 69],
  ["yard-stone-09", "stone-small", 14, 74], ["yard-stone-10", "stone-small", 23, 73], ["yard-ruby-01", "ruby-node", 36, 70], ["yard-ruby-02", "ruby-node", 90, 70],
];

function makeResource([id, profileId, cellX, cellY]) {
  const profile = getResourceProfile(profileId);
  const position = Object.freeze({
    x: (cellX + profile.footprint.width / 2) * PLACEMENT_CELL_SIZE,
    y: (cellY + profile.footprint.height / 2) * PLACEMENT_CELL_SIZE,
  });
  return Object.freeze({
    id, entityId: id, roomId: "yard", kind: RESOURCE_INTERACTION_KIND, profileId,
    cell: Object.freeze({ x: cellX, y: cellY }), position,
    radius: profile.size === "large" ? 36 : 30, priority: profile.kind === "ruby" ? 1.5 : 1,
    requiresFacing: false, facingDotThreshold: -1, prompt: profile.prompt,
    payload: Object.freeze({ resourceId: id }),
  });
}

export const RESOURCE_OBJECTS = Object.freeze(descriptors.map(makeResource));
export const DEFAULT_RESOURCE_ID = RESOURCE_OBJECTS[0].id;

export function normalizeGameplayTuning(value = {}) {
  return {
    maximumEnergy: integer(value.maximumEnergy, DEFAULT_GAMEPLAY_TUNING.maximumEnergy, 1, 999),
    axeDamage: number(value.axeDamage, DEFAULT_GAMEPLAY_TUNING.axeDamage, 0, 999),
    smallLogChopHp: integer(value.smallLogChopHp ?? value.hitsPerLog, DEFAULT_GAMEPLAY_TUNING.smallLogChopHp, 1, 99),
    energyPerHit: integer(value.energyPerHit ?? value.clearingEnergyCost, DEFAULT_GAMEPLAY_TUNING.energyPerHit, 0, 999),
    awakeDrainAmount: number(value.awakeDrainAmount, DEFAULT_GAMEPLAY_TUNING.awakeDrainAmount, 0, 999),
    awakeWalkDrainAmount: number(value.awakeWalkDrainAmount, DEFAULT_GAMEPLAY_TUNING.awakeWalkDrainAmount, 0, 999),
    awakeRunDrainAmount: number(value.awakeRunDrainAmount, DEFAULT_GAMEPLAY_TUNING.awakeRunDrainAmount, 0, 999),
    lowEnergyIdleRegenPerSecond: number(value.lowEnergyIdleRegenPerSecond, DEFAULT_GAMEPLAY_TUNING.lowEnergyIdleRegenPerSecond, 0, 999),
    runSpeedMultiplier: number(value.runSpeedMultiplier, DEFAULT_GAMEPLAY_TUNING.runSpeedMultiplier, 1, 4),
    exhaustionSleepScaleMultiplier: number(value.exhaustionSleepScaleMultiplier, DEFAULT_GAMEPLAY_TUNING.exhaustionSleepScaleMultiplier, 0.1, 1),
    exhaustionWakeCooldownSeconds: number(value.exhaustionWakeCooldownSeconds, DEFAULT_GAMEPLAY_TUNING.exhaustionWakeCooldownSeconds, 0, 30),
    universalHitCooldownSeconds: number(value.universalHitCooldownSeconds, DEFAULT_GAMEPLAY_TUNING.universalHitCooldownSeconds, 0, 30),
    minimumFatigueSpeedMultiplier: number(value.minimumFatigueSpeedMultiplier, DEFAULT_GAMEPLAY_TUNING.minimumFatigueSpeedMultiplier, 0.05, 1),
    sleepTimeScale: number(value.sleepTimeScale, DEFAULT_GAMEPLAY_TUNING.sleepTimeScale, 1, 64),
    sleepEnergyPerGameHour: number(value.sleepEnergyPerGameHour ?? value.sleepEnergyRegenPerSecond, DEFAULT_GAMEPLAY_TUNING.sleepEnergyPerGameHour, 0, 999),
    realSecondsPerGameDay: number(value.realSecondsPerGameDay, DEFAULT_GAMEPLAY_TUNING.realSecondsPerGameDay, 1, 99999),
  };
}

function integer(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; }
function number(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
