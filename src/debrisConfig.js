import { TILE_SIZE } from "./worldConfig.js";

export const DEBRIS_INTERACTION_KIND = "clear-debris";
export const BED_INTERACTION_KIND = "sleep-bed";
export const DEFAULT_DEBRIS_ID = "fallen-log-01";
export const BED_OBJECT_ID = "home-bed-01";
export const DEFAULT_DEBRIS_MAX_HITS = 5;
export const DEFAULT_DEBRIS_ENERGY_PER_HIT = 4;

export const DEFAULT_GAMEPLAY_TUNING = Object.freeze({
  maximumEnergy: 100,
  woodReward: 1,
  hitsPerLog: DEFAULT_DEBRIS_MAX_HITS,
  energyPerHit: DEFAULT_DEBRIS_ENERGY_PER_HIT,
  awakeDrainAmount: 1,
  awakeDrainIntervalSeconds: 5,
  exhaustedMovementMultiplier: 1 / 3,
  sleepTimeScale: 8,
  sleepEnergyRegenPerSecond: 10,
});

const OUTDOOR_TILES = [
  [6, 15], [9, 15], [12, 15], [15, 15], [48, 15], [51, 15], [54, 15], [57, 15],
  [5, 20], [8, 20], [11, 20], [14, 20], [47, 20], [50, 20], [53, 20], [56, 20],
  [5, 25], [8, 25], [11, 25], [14, 25], [47, 25], [50, 25], [53, 25], [56, 25],
  [20, 34], [23, 34], [26, 34], [37, 34], [40, 34], [43, 34], [22, 39], [32, 39], [42, 39],
];
const INDOOR_TILES = [[22, 14], [25, 14], [28, 14], [35, 14], [38, 14], [41, 14], [22, 18], [25, 18], [38, 18], [41, 18]];

function makeDebris(id, roomId, tile) {
  return Object.freeze({
    id,
    entityId: id,
    roomId,
    kind: DEBRIS_INTERACTION_KIND,
    tile: Object.freeze({ x: tile[0], y: tile[1] }),
    position: Object.freeze({ x: tile[0] * TILE_SIZE + TILE_SIZE / 2, y: tile[1] * TILE_SIZE + TILE_SIZE / 2 }),
    radius: 24,
    priority: 1,
    requiresFacing: true,
    facingDotThreshold: 0,
    prompt: "hud:interaction.chop",
    payload: Object.freeze({ debrisId: id }),
  });
}

export const DEBRIS_OBJECTS = Object.freeze([
  ...OUTDOOR_TILES.map((tile, index) => makeDebris(index === 0 ? DEFAULT_DEBRIS_ID : `yard-log-${String(index + 1).padStart(2, "0")}`, "yard", tile)),
  ...INDOOR_TILES.map((tile, index) => makeDebris(`home-log-${String(index + 1).padStart(2, "0")}`, "home", tile)),
]);
export const DEBRIS_OBJECT = DEBRIS_OBJECTS[0];

export const BED_OBJECT = Object.freeze({
  id: BED_OBJECT_ID,
  entityId: BED_OBJECT_ID,
  roomId: "home",
  kind: BED_INTERACTION_KIND,
  tile: Object.freeze({ x: 32, y: 14 }),
  position: Object.freeze({ x: 32 * TILE_SIZE + TILE_SIZE / 2, y: 14 * TILE_SIZE + TILE_SIZE / 2 }),
  radius: 26,
  priority: 2,
  requiresFacing: true,
  facingDotThreshold: -0.2,
  prompt: "hud:interaction.sleep",
  payload: Object.freeze({ bedId: BED_OBJECT_ID }),
});

export function normalizeGameplayTuning(value = {}) {
  return {
    maximumEnergy: normalizeInteger(value.maximumEnergy, DEFAULT_GAMEPLAY_TUNING.maximumEnergy, 1, 999),
    woodReward: normalizeInteger(value.woodReward, DEFAULT_GAMEPLAY_TUNING.woodReward, 0, 999),
    hitsPerLog: normalizeInteger(value.hitsPerLog, DEFAULT_GAMEPLAY_TUNING.hitsPerLog, 1, 99),
    energyPerHit: normalizeInteger(value.energyPerHit ?? value.clearingEnergyCost, DEFAULT_GAMEPLAY_TUNING.energyPerHit, 0, 999),
    awakeDrainAmount: normalizeInteger(value.awakeDrainAmount, DEFAULT_GAMEPLAY_TUNING.awakeDrainAmount, 0, 999),
    awakeDrainIntervalSeconds: normalizeNumber(value.awakeDrainIntervalSeconds, DEFAULT_GAMEPLAY_TUNING.awakeDrainIntervalSeconds, 0.1, 999),
    exhaustedMovementMultiplier: normalizeNumber(value.exhaustedMovementMultiplier, DEFAULT_GAMEPLAY_TUNING.exhaustedMovementMultiplier, 0, 1),
    sleepTimeScale: normalizeNumber(value.sleepTimeScale, DEFAULT_GAMEPLAY_TUNING.sleepTimeScale, 1, 64),
    sleepEnergyRegenPerSecond: normalizeNumber(value.sleepEnergyRegenPerSecond, DEFAULT_GAMEPLAY_TUNING.sleepEnergyRegenPerSecond, 0, 999),
  };
}
function normalizeInteger(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback; }
function normalizeNumber(value, fallback, min, max) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
