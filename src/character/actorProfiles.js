import { CHARACTER_VISUAL_PROFILE_IDS, getCharacterVisualProfile } from "./characterVisualProfiles.js";

export const SHARED_CHARACTER_VISUAL_PROFILE = getCharacterVisualProfile(
  CHARACTER_VISUAL_PROFILE_IDS.player,
);

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
  maxSpeed: 29,
  acceleration: 87,
  brakingDeceleration: 103,
  reverseAcceleration: 127,
  turnDeceleration: 70,
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
        maxSpeed: villagerMovementProfile.maxSpeed / playerMovementProfile.maxSpeed,
        acceleration: villagerMovementProfile.acceleration / playerMovementProfile.acceleration,
        brakingDeceleration:
          villagerMovementProfile.brakingDeceleration / playerMovementProfile.brakingDeceleration,
        reverseAcceleration:
          villagerMovementProfile.reverseAcceleration / playerMovementProfile.reverseAcceleration,
        turnDeceleration:
          villagerMovementProfile.turnDeceleration / playerMovementProfile.turnDeceleration,
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
