import { TILE_SIZE } from "../world/worldConfig.js";
import { getResourceProfile } from "./resourceDomain.js";
import { TOILET_ACCIDENT_TIMELINE_TUNING } from "../needs/toiletAccidentTimelineRuntime.js";

export const RESOURCE_INTERACTION_KIND = "work-resource";
export const EXTRACTABLE_TARGETING_GROUP = "extractable";
export const PLACEMENT_CELL_SIZE = TILE_SIZE / 2;

export const DEFAULT_GAMEPLAY_TUNING = Object.freeze({
  maximumEnergy: 100,
  axeDamage: 1,
  smallLogChopHp: 7,
  energyPerHit: 0.2,
  runSpeedMultiplier: 1.66,
  exhaustionSleepScaleMultiplier: 0.5,
  exhaustionWakeCooldownSeconds: 1.5,
  universalHitCooldownSeconds: 0.66,
  minimumFatigueSpeedMultiplier: 0.5,
  sleepTimeScale: 32,
  realSecondsPerGameDay: 1440,
  sleepEnergyPerGameHour: 14,
  backPointFollowRate: 5,
  cameraLeadTransitionSeconds: 2,
  needs: Object.freeze({
    flowArrowRatios: Object.freeze([1, 2.5]),
    facilityRecoveryPerGameHour: 600,
    physicalActivityWindowSeconds: 0.66,
    novelty: Object.freeze({ base: -1 }),
    satiety: Object.freeze({ base: -7 }),
    toilet: Object.freeze({ base: -6 }),
    lustre: Object.freeze({
      base: -1,
      activitySurcharge: Object.freeze({ running: 1, watering: 0.5, axe: 2, hoe: 2, pickaxe: 3 }),
    }),
    dialogue: Object.freeze({ base: -2, sharedRest: 6, meaningfulConversationGain: 20, radius: 48 }),
    toolCosts: Object.freeze({ axe: 0.2, pickaxe: 0.3, hoe: 0.15, watering: 0.1, sword: 0.75, "battle-axe": 0.1 }),
    sleep: Object.freeze({ energyPerGameHour: 14 }),
    catchBreath: Object.freeze({ delayRealSeconds: 3, energyPerRealSecond: 1, ceiling: 15 }),
    collapse: Object.freeze({ minimumGameHours: 2, wakeEnergy: 25 }),
    toiletAccident: TOILET_ACCIDENT_TIMELINE_TUNING,
  }),
});

const villageDescriptors = [
  ["fallen-log-01", "log-small", 12, 30], ["yard-log-02", "log-small", 15, 31], ["yard-log-04", "log-large", 21, 30],
  ["yard-stone-01", "stone-large", 91, 55], ["yard-stone-02", "stone-small", 95, 55], ["yard-stone-03", "stone-small", 91, 59], ["yard-stone-04", "stone-large", 97, 60],
  ["yard-stone-07", "stone-large", 15, 70], ["yard-stone-08", "stone-small", 19, 69],
  ["yard-ruby-01", "ruby-node", 36, 70], ["yard-ruby-02", "ruby-node", 90, 70],
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

export function createResourceDefinition({
  id,
  profileId,
  cell,
  worldId,
  roomId = worldId,
  radius = null,
  priority = null,
  requiresFacing = false,
  facingDotThreshold = -1,
  targetingMode = "facing-first",
  targetingGroup = EXTRACTABLE_TARGETING_GROUP,
} = {}) {
  if (typeof id !== "string" || id.trim() === "") throw new Error("Resource definition requires a stable ID");
  if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) throw new Error(`Resource ${id} requires a finite cell`);
  if (typeof worldId !== "string" || worldId.trim() === "") throw new Error(`Resource ${id} requires a world ID`);
  const profile = getResourceProfile(profileId);
  const collision = profile.collisionRect ?? {
    left: 0,
    top: 0,
    right: profile.footprint.width * PLACEMENT_CELL_SIZE,
    bottom: profile.footprint.height * PLACEMENT_CELL_SIZE,
  };
  const frozenCell = Object.freeze({ x: Number(cell.x), y: Number(cell.y) });
  const position = Object.freeze({
    x: frozenCell.x * PLACEMENT_CELL_SIZE + (collision.left + collision.right) / 2,
    y: frozenCell.y * PLACEMENT_CELL_SIZE + (collision.top + collision.bottom) / 2,
  });
  return Object.freeze({
    id,
    entityId: id,
    worldId,
    roomId,
    kind: RESOURCE_INTERACTION_KIND,
    profileId,
    cell: frozenCell,
    position,
    radius: radius ?? (profile.size === "large" ? 36 : 30),
    priority: priority ?? (profile.kind === "ruby" ? 1.5 : 1),
    requiresFacing: Boolean(requiresFacing),
    facingDotThreshold: Number(facingDotThreshold),
    targetingMode,
    targetingGroup,
    prompt: profile.prompt,
    payload: Object.freeze({ resourceId: id }),
  });
}

function makeResource([id, profileId, cellX, cellY], worldId) {
  return createResourceDefinition({ id, profileId, cell: { x: cellX, y: cellY }, worldId, roomId: worldId === "village" ? "yard" : "nest" });
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
