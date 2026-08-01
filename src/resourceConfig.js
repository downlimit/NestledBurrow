import { TILE_SIZE } from "./worldConfig.js";
import { getResourceProfile } from "./resourceDomain.js";

export const RESOURCE_INTERACTION_KIND = "work-resource";
export const PLACEMENT_CELL_SIZE = TILE_SIZE / 2;

export const DEFAULT_GAMEPLAY_TUNING = Object.freeze({
  maximumEnergy: 100,
  axeDamage: 1,
  smallLogChopHp: 7,
  energyPerHit: 0.5,
  awakeDrainAmount: 0.25,
  awakeWalkDrainAmount: 0.75,
  awakeRunDrainAmount: 1.5,
  lowEnergyIdleRegenPerSecond: 1.5 / 1.66,
  runSpeedMultiplier: 1.66,
  exhaustionSleepScaleMultiplier: 0.5,
  exhaustionWakeCooldownSeconds: 1.5,
  universalHitCooldownSeconds: 0.66,
  minimumFatigueSpeedMultiplier: 0.25,
  sleepTimeScale: 32,
  realSecondsPerGameDay: 1440,
  sleepEnergyPerGameHour: 12.5,
  backPointFollowRate: 5,
  cameraLeadTransitionSeconds: 2,
  needs: Object.freeze({
    flowArrowRatios: Object.freeze([1, 2.5]),
    novelty: Object.freeze({ base: -0.25, running: 9, commonResource: -1.5, ruby: 8 }),
    satiety: Object.freeze({ base: -0.165, runningMultiplier: 1.3, resourceMultiplier: 3, table: 10 }),
    toilet: Object.freeze({ base: -0.225, showerMultiplier: 0.5, toilet: 10 }),
    lustre: Object.freeze({ base: -0.15, toiletMultiplier: 1.5, shower: 10 }),
    dialogue: Object.freeze({ base: -0.05, nearNpc: 0.5, radius: 48 }),
  }),
});

const villageDescriptors = [
  ["fallen-log-01", "log-small", 12, 30], ["yard-log-02", "log-small", 15, 31], ["yard-log-03", "log-small", 18, 29], ["yard-log-04", "log-large", 21, 30],
  ["yard-log-05", "log-small", 25, 32], ["yard-log-06", "log-small", 29, 30], ["yard-log-07", "log-small", 33, 32], ["yard-log-08", "log-small", 35, 36],
  ["yard-log-09", "log-small", 98, 30], ["yard-log-10", "log-small", 102, 34], ["yard-log-11", "log-large", 107, 28], ["yard-log-12", "log-small", 112, 34],
  ["yard-stone-01", "stone-large", 91, 55], ["yard-stone-02", "stone-small", 95, 55], ["yard-stone-03", "stone-small", 91, 59], ["yard-stone-04", "stone-small", 97, 60],
  ["yard-stone-05", "stone-small", 88, 62], ["yard-stone-06", "stone-small", 102, 56], ["yard-stone-07", "stone-large", 15, 70], ["yard-stone-08", "stone-small", 19, 69],
  ["yard-stone-09", "stone-small", 14, 74], ["yard-stone-10", "stone-small", 23, 73], ["yard-ruby-01", "ruby-node", 36, 70], ["yard-ruby-02", "ruby-node", 90, 70],
];

const nestDescriptors = [
  ["nest-tree-01", "tree-planted", 8, 9],
  ["nest-tree-02", "tree-planted", 34, 9],
  ["nest-tree-03", "tree-planted", 8, 18],
  ["nest-tree-04", "tree-planted", 31, 18],
  ["nest-stone-large-01", "stone-large", 31, 15],
  ["nest-stone-small-01", "stone-small", 13, 17],
  ["nest-stone-small-02", "stone-small", 29, 24],
];

function makeResource([id, profileId, cellX, cellY], worldId) {
  const profile = getResourceProfile(profileId);
  const collision = profile.collisionRect ?? {
    left: 0,
    top: 0,
    right: profile.footprint.width * PLACEMENT_CELL_SIZE,
    bottom: profile.footprint.height * PLACEMENT_CELL_SIZE,
  };
  const position = Object.freeze({
    x: cellX * PLACEMENT_CELL_SIZE + (collision.left + collision.right) / 2,
    y: cellY * PLACEMENT_CELL_SIZE + (collision.top + collision.bottom) / 2,
  });
  return Object.freeze({
    id, entityId: id, worldId, roomId: worldId === "village" ? "yard" : "nest", kind: RESOURCE_INTERACTION_KIND, profileId,
    cell: Object.freeze({ x: cellX, y: cellY }), position,
    radius: profile.size === "large" ? 36 : 30, priority: profile.kind === "ruby" ? 1.5 : 1,
    requiresFacing: false, facingDotThreshold: -1, prompt: profile.prompt,
    payload: Object.freeze({ resourceId: id }),
  });
}

export const RESOURCE_OBJECTS = Object.freeze([
  ...villageDescriptors.map((descriptor) => makeResource(descriptor, "village")),
  ...nestDescriptors.map((descriptor) => makeResource(descriptor, "nest")),
]);
export const DEFAULT_RESOURCE_ID = RESOURCE_OBJECTS[0].id;

export function getResourceObjectsForWorld(worldId) {
  return RESOURCE_OBJECTS.filter((definition) => definition.worldId === worldId);
}

export function normalizeGameplayTuning(value = {}) {
  return {
    maximumEnergy: integer(value.maximumEnergy, DEFAULT_GAMEPLAY_TUNING.maximumEnergy, 1, 999),
    axeDamage: number(value.axeDamage, DEFAULT_GAMEPLAY_TUNING.axeDamage, 0, 999),
    smallLogChopHp: integer(value.smallLogChopHp ?? value.hitsPerLog, DEFAULT_GAMEPLAY_TUNING.smallLogChopHp, 1, 99),
    energyPerHit: number(value.energyPerHit ?? value.clearingEnergyCost, DEFAULT_GAMEPLAY_TUNING.energyPerHit, 0, 999),
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
    backPointFollowRate: number(value.backPointFollowRate, DEFAULT_GAMEPLAY_TUNING.backPointFollowRate, 0.1, 20),
    cameraLeadTransitionSeconds: number(value.cameraLeadTransitionSeconds, DEFAULT_GAMEPLAY_TUNING.cameraLeadTransitionSeconds, 0.1, 10),
    needs: DEFAULT_GAMEPLAY_TUNING.needs,
  };
}

function integer(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; }
function number(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
