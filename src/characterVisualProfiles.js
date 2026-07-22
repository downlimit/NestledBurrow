import {
  FACING_HYSTERESIS,
  PLAYER_FOOT_DEPTH,
  PLAYER_FOOT_WIDTH,
  PLAYER_FRAMES,
  PLAYER_IDLE_FRAME_INDEX,
  PLAYER_WALK_FRAME_SEQUENCE,
  WALK_FRAME_RATE,
} from "./visualConfig.js";

export const CHARACTER_VISUAL_PROFILE_IDS = Object.freeze({
  player: "player",
  homeNpc: "home-npc",
  streetNpc: "street-npc",
});

const PLAYER_ASSET_PATH = "assets/third-party/kenney/player";
const NPC_WALK_FRAMES = Object.freeze({
  down: Object.freeze([0, 1, 2]),
  left: Object.freeze([3, 4, 5]),
  right: Object.freeze([6, 7, 8]),
  up: Object.freeze([9, 10, 11]),
});

function imageFrame(textureKey) {
  return Object.freeze({ textureKey, frame: undefined });
}

function sheetFrame(textureKey, frame) {
  return Object.freeze({ textureKey, frame });
}

function mapImageFrames(frames) {
  return deepFreeze(Object.fromEntries(
    Object.entries(frames).map(([facing, textureKeys]) => [
      facing,
      textureKeys.map((textureKey) => imageFrame(textureKey)),
    ]),
  ));
}

function mapSpritesheetFrames(textureKey, frames) {
  return deepFreeze(Object.fromEntries(
    Object.entries(frames).map(([facing, frameNumbers]) => [
      facing,
      frameNumbers.map((frame) => sheetFrame(textureKey, frame)),
    ]),
  ));
}

const playerResourceKeys = Object.freeze([...new Set(Object.values(PLAYER_FRAMES).flat())]);

export const CHARACTER_VISUAL_PROFILES = deepFreeze({
  [CHARACTER_VISUAL_PROFILE_IDS.player]: {
    id: CHARACTER_VISUAL_PROFILE_IDS.player,
    animationPrefix: "player",
    resources: [
      {
        type: "images",
        path: PLAYER_ASSET_PATH,
        frames: playerResourceKeys.map((textureKey) => ({
          textureKey,
          fileName: `${textureKey}.png`,
        })),
      },
    ],
    frames: mapImageFrames(PLAYER_FRAMES),
    idleFrameIndex: PLAYER_IDLE_FRAME_INDEX,
    walkFrameSequence: PLAYER_WALK_FRAME_SEQUENCE,
    footWidth: PLAYER_FOOT_WIDTH,
    footDepth: PLAYER_FOOT_DEPTH,
    facingHysteresis: FACING_HYSTERESIS,
    walkFrameRate: WALK_FRAME_RATE,
  },
  [CHARACTER_VISUAL_PROFILE_IDS.homeNpc]: {
    id: CHARACTER_VISUAL_PROFILE_IDS.homeNpc,
    animationPrefix: "home-npc",
    resources: [
      {
        type: "spritesheet",
        textureKey: "kenney-home-npc",
        path: "assets/third-party/kenney/home-npc/character.png",
        frameWidth: 16,
        frameHeight: 16,
      },
    ],
    frames: mapSpritesheetFrames("kenney-home-npc", NPC_WALK_FRAMES),
    idleFrameIndex: 0,
    walkFrameSequence: PLAYER_WALK_FRAME_SEQUENCE,
    footWidth: PLAYER_FOOT_WIDTH,
    footDepth: PLAYER_FOOT_DEPTH,
    facingHysteresis: FACING_HYSTERESIS,
    walkFrameRate: WALK_FRAME_RATE,
  },
  [CHARACTER_VISUAL_PROFILE_IDS.streetNpc]: {
    id: CHARACTER_VISUAL_PROFILE_IDS.streetNpc,
    animationPrefix: "street-npc",
    resources: [
      {
        type: "spritesheet",
        textureKey: "kenney-street-npc",
        path: "assets/third-party/kenney/street-npc/character.png",
        frameWidth: 16,
        frameHeight: 16,
      },
    ],
    frames: mapSpritesheetFrames("kenney-street-npc", NPC_WALK_FRAMES),
    idleFrameIndex: 0,
    walkFrameSequence: PLAYER_WALK_FRAME_SEQUENCE,
    footWidth: PLAYER_FOOT_WIDTH,
    footDepth: PLAYER_FOOT_DEPTH,
    facingHysteresis: FACING_HYSTERESIS,
    walkFrameRate: WALK_FRAME_RATE,
  },
});

export function getCharacterVisualProfile(profileId) {
  const profile = CHARACTER_VISUAL_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown character visual profile ID: ${String(profileId)}`);
  return profile;
}

export function toPhaserFrame(frameReference) {
  return { key: frameReference.textureKey, frame: frameReference.frame };
}

export function applyFrameReference(sprite, frameReference) {
  sprite.setTexture(frameReference.textureKey, frameReference.frame);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
