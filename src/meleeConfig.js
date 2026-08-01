import { MELEE_WEAPON_SPRITE_ASSETS } from "./assets/meleeWeaponSpriteAssets.js";
import { getActorProfile } from "./actorProfiles.js";
import { DOOR_LEFT, DOOR_Y, TILE_SIZE } from "./worldConfig.js";

export const MELEE_WEAPON_IDS = Object.freeze(["sword", "battle-axe"]);
export const MELEE_COMBAT_ACTION_IDS = Object.freeze(["space", "lmb", "rmb", "shift"]);
export const MELEE_TURN_MODES = Object.freeze({
  instant: "INSTANT",
  multiplier: "MULTIPLIER",
});
export const MELEE_SWING_DIRECTIONS = Object.freeze({
  clockwise: "CLOCKWISE",
  counterclockwise: "COUNTERCLOCKWISE",
});
export const SWORD_ATTACK_TIME_SCALE = 0.85;

const swordStep = (swingDirection, trailDurationMs, trailAlpha) => Object.freeze({
  windupMs: 50 * SWORD_ATTACK_TIME_SCALE,
  totalDurationMs: 300 * SWORD_ATTACK_TIME_SCALE,
  hitArcDeg: 45,
  swingDirection,
  trailDurationMs: trailDurationMs * SWORD_ATTACK_TIME_SCALE,
  trailAlpha,
});
const axeStep = (hitArcDeg, swingDirection, trailDurationMs, trailAlpha) => Object.freeze({
  windupMs: 150,
  totalDurationMs: 500,
  hitArcDeg,
  swingDirection,
  trailDurationMs,
  trailAlpha,
});
const playerMovement = getActorProfile("player").movement;

export const MELEE_WEAPON_PROFILES = Object.freeze({
  sword: Object.freeze({
    id: "sword",
    damage: 1,
    resourceDamageMultiplier: 0,
    rangePx: 48,
    comboLength: 5,
    postComboCooldownMs: 700,
    turnMode: MELEE_TURN_MODES.instant,
    turnSpeedMultiplier: 1,
    movementSpeedMultiplier: 1,
    autoTargetBlend: 0.75,
    autoTargetSearchScale: 1.5,
    baseHalfWidthPx: 7,
    knockbackDistancePx: 15,
    knockbackDurationMs: 180,
    forcedMoveDistancePx: 12.75,
    forcedMoveDurationMs: 42.5,
    movementLockAfterHitMs: 212.5,
    itemAsset: MELEE_WEAPON_SPRITE_ASSETS.swordItem,
    heldAsset: MELEE_WEAPON_SPRITE_ASSETS.swordHeld,
    steps: Object.freeze([
      swordStep(MELEE_SWING_DIRECTIONS.clockwise, 120, 0.24),
      swordStep(MELEE_SWING_DIRECTIONS.counterclockwise, 120, 0.24),
      swordStep(MELEE_SWING_DIRECTIONS.clockwise, 140, 0.28),
      swordStep(MELEE_SWING_DIRECTIONS.counterclockwise, 120, 0.24),
      swordStep(MELEE_SWING_DIRECTIONS.clockwise, 140, 0.30),
    ]),
  }),
  "battle-axe": Object.freeze({
    id: "battle-axe",
    damage: 2,
    resourceDamageMultiplier: 0.5,
    rangePx: 48,
    comboLength: 4,
    postComboCooldownMs: 1000,
    turnMode: MELEE_TURN_MODES.multiplier,
    turnSpeedMultiplier: 0.5,
    movementSpeedMultiplier: 0.5,
    autoTargetBlend: 0,
    autoTargetSearchScale: 1,
    baseHalfWidthPx: 7,
    knockbackDistancePx: 45,
    knockbackDurationMs: 300,
    forcedMoveDistancePx: 0,
    forcedMoveDurationMs: 0,
    movementLockAfterHitMs: 0,
    itemAsset: MELEE_WEAPON_SPRITE_ASSETS.battleAxeItem,
    heldAsset: MELEE_WEAPON_SPRITE_ASSETS.battleAxeHeld,
    steps: Object.freeze([
      axeStep(60, MELEE_SWING_DIRECTIONS.clockwise, 200, 0.28),
      axeStep(142.5, MELEE_SWING_DIRECTIONS.counterclockwise, 210, 0.30),
      axeStep(225, MELEE_SWING_DIRECTIONS.clockwise, 220, 0.32),
      axeStep(360, MELEE_SWING_DIRECTIONS.clockwise, 280, 0.36),
    ]),
  }),
});

export const TRAINING_DUMMY = Object.freeze({
  id: "training-dummy-01",
  asset: MELEE_WEAPON_SPRITE_ASSETS.trainingDummy,
  spawnOffset: Object.freeze({ x: 44, y: -30 }),
  combatAnchorOffset: Object.freeze({ x: 8, y: 24 }),
  damageAnchorOffset: Object.freeze({ x: 8, y: -2 }),
  knockbackResistance: 0,
  returnDelayMs: 5000,
  blockedPathWaitMs: 3000,
  obstacleClearancePx: TILE_SIZE,
  hitReaction: Object.freeze({ flashMs: 100, heightPx: 2, travelMs: 40, holdMs: 120, totalMs: 200 }),
  returnMovement: Object.freeze({ ...playerMovement, maxSpeed: playerMovement.maxSpeed * 0.5 }),
});

export const MELEE_DEBUG_ENABLED = false;
export const MELEE_STARTER_ITEM_OFFSETS = Object.freeze({
  sword: Object.freeze({ x: -8, y: 24 }),
  "battle-axe": Object.freeze({ x: 24, y: 24 }),
});

export function getMeleeWeaponProfile(itemId) {
  return MELEE_WEAPON_PROFILES[itemId] ?? null;
}

export function isMeleeWeaponId(itemId) {
  return Boolean(getMeleeWeaponProfile(itemId));
}

export function resolveMeleeActionItem(actionIds, getCombatActionItem = () => null) {
  for (const actionId of actionIds ?? []) {
    if (!MELEE_COMBAT_ACTION_IDS.includes(actionId)) continue;
    const item = getCombatActionItem(actionId);
    if (isMeleeWeaponId(item?.id)) return item;
  }
  return null;
}

export function preloadMeleeAssets(scene) {
  for (const asset of Object.values(MELEE_WEAPON_SPRITE_ASSETS)) {
    scene.load.image(asset.textureKey, asset.dataUri);
  }
}

export function createMeleeStartingWorldItems(worldLayout, existingWorldItems = [], trainingDummyPosition = null) {
  const occupied = [...existingWorldItems];
  const dummy = Number.isFinite(trainingDummyPosition?.x) && Number.isFinite(trainingDummyPosition?.y)
    ? { x: Number(trainingDummyPosition.x), y: Number(trainingDummyPosition.y) }
    : findTrainingDummyPoint(worldLayout);
  const definitions = [
    { id: "starter-melee-sword", itemId: "sword", preferred: offsetPoint(dummy, MELEE_STARTER_ITEM_OFFSETS.sword) },
    { id: "starter-melee-battle-axe", itemId: "battle-axe", preferred: offsetPoint(dummy, MELEE_STARTER_ITEM_OFFSETS["battle-axe"]) },
  ];
  return definitions.map((definition) => {
    const point = findNearestFreeWorldItemPoint(worldLayout, definition.preferred, occupied);
    const worldItem = {
      id: definition.id,
      item: { id: definition.itemId, kind: "tool", quantity: 1 },
      x: point.x,
      y: point.y,
    };
    occupied.push(worldItem);
    return worldItem;
  });
}

function offsetPoint(point, offset) {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

export function findTrainingDummyPoint(worldLayout, searchLimit = 96) {
  const spawn = worldLayout?.spawn ?? { x: (DOOR_LEFT + 1.5) * TILE_SIZE, y: (DOOR_Y - 3) * TILE_SIZE };
  const preferred = {
    x: spawn.x + TRAINING_DUMMY.spawnOffset.x,
    y: spawn.y + TRAINING_DUMMY.spawnOffset.y,
  };
  for (let radius = 0; radius <= searchLimit; radius += 1) {
    const candidates = radius === 0
      ? [preferred]
      : [
        { x: preferred.x + radius, y: preferred.y },
        { x: preferred.x - radius, y: preferred.y },
        { x: preferred.x, y: preferred.y + radius },
        { x: preferred.x, y: preferred.y - radius },
      ];
    const point = candidates.find((candidate) => isTrainingDummyPointFree(worldLayout, candidate));
    if (point) return point;
  }
  throw new Error(`No free training dummy point near ${preferred.x},${preferred.y}`);
}

function isTrainingDummyPointFree(worldLayout, point) {
  const collision = TRAINING_DUMMY.asset.collision;
  const box = {
    left: point.x + collision.left,
    top: point.y + collision.top,
    right: point.x + collision.right,
    bottom: point.y + collision.bottom,
  };
  const bounds = worldLayout?.bounds;
  if (bounds && (box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom)) {
    return false;
  }
  return (worldLayout?.getBlockingColliders?.(box)?.length ?? 0) === 0;
}

export function findNearestFreeWorldItemPoint(worldLayout, preferred, worldItems = [], searchLimit = 96) {
  const candidatesAtRadius = (radius) => {
    if (radius === 0) return [{ x: preferred.x, y: preferred.y }];
    const points = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      points.push(
        { x: preferred.x + offset, y: preferred.y - radius },
        { x: preferred.x + offset, y: preferred.y + radius },
        { x: preferred.x - radius, y: preferred.y + offset },
        { x: preferred.x + radius, y: preferred.y + offset },
      );
    }
    return points;
  };
  for (let radius = 0; radius <= searchLimit; radius += 1) {
    const point = candidatesAtRadius(radius).find((candidate) => isWorldItemPointFree(worldLayout, candidate, worldItems));
    if (point) return point;
  }
  throw new Error(`No free starter weapon point near ${preferred.x},${preferred.y}`);
}

function isWorldItemPointFree(worldLayout, point, worldItems) {
  const half = 1;
  const box = { left: point.x - half, top: point.y - half, right: point.x + half, bottom: point.y + half };
  const bounds = worldLayout?.bounds;
  if (bounds && (box.left < bounds.left || box.top < bounds.top || box.right > bounds.right || box.bottom > bounds.bottom)) {
    return false;
  }
  if ((worldLayout?.getBlockingColliders?.(box)?.length ?? 0) > 0) return false;
  return !worldItems.some((item) => Math.abs(item.x - point.x) < 2 && Math.abs(item.y - point.y) < 2);
}
