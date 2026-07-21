import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  WALK_FRAME_RATE,
} from "./visualConfig.js";

export const SHARED_CHARACTER_VISUAL_PROFILE = deepFreeze({
  animationPrefix: "character",
  frames: PLAYER_FRAMES,
  idleFrameIndex: PLAYER_IDLE_FRAME_INDEX,
  footWidth: PLAYER_FOOT_WIDTH,
  footDepth: PLAYER_FOOT_DEPTH,
  facingHysteresis: FACING_HYSTERESIS,
  walkFrameRate: WALK_FRAME_RATE,
});

const playerMovementProfile = deepFreeze({
  maxSpeed: 87,
  acceleration: 520,
  brakingDeceleration: 620,
  reverseAcceleration: 760,
  turnDeceleration: 420,
  facingTurnSpeed: 10,
  movingSpeedThreshold: 2,
  maxDeltaMs: 50,
});

const villagerMovementProfile = deepFreeze({
  maxSpeed: 87,
  acceleration: 260,
  brakingDeceleration: 310,
  reverseAcceleration: 380,
  turnDeceleration: 210,
  facingTurnSpeed: 10,
  movingSpeedThreshold: 2,
  maxDeltaMs: 50,
});

export const ACTOR_PROFILE_IDS = Object.freeze({
  player: "player",
  villager: "villager",
});

export const ACTOR_PROFILES = deepFreeze({
  player: {
    id: ACTOR_PROFILE_IDS.player,
    movement: playerMovementProfile,
    visual: SHARED_CHARACTER_VISUAL_PROFILE,
  },
  villager: {
    id: ACTOR_PROFILE_IDS.villager,
    movement: villagerMovementProfile,
    visual: SHARED_CHARACTER_VISUAL_PROFILE,
    debugMovementTuningPolicy: {
      sourceProfileId: ACTOR_PROFILE_IDS.player,
      fieldScales: {
        maxSpeed: 1,
        acceleration: 0.5,
        brakingDeceleration: 0.5,
        reverseAcceleration: 0.5,
        turnDeceleration: 0.5,
        facingTurnSpeed: 1,
        movingSpeedThreshold: 1,
        maxDeltaMs: 1,
      },
    },
  },
});

export function getActorProfile(profileId) {
  const profile = ACTOR_PROFILES[profileId];
  if (!profile) {
    throw new Error(`Unknown actor profile ID: ${String(profileId)}`);
  }
  return profile;
}

export function createDebugMovementConfigFromPolicy(profile, sourceMovementConfig) {
  const policy = profile.debugMovementTuningPolicy;
  if (!policy) return { ...profile.movement };
  return Object.fromEntries(
    Object.entries(policy.fieldScales).map(([key, scale]) => [
      key,
      sourceMovementConfig[key] * scale,
    ]),
  );
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
