import { ACTOR_PROFILE_IDS } from "../character/actorProfiles.js";
import { CHARACTER_VISUAL_PROFILE_IDS } from "../character/characterVisualProfiles.js";
import { DOOR_LEFT, DOOR_Y, HOUSE, TILE_SIZE } from "../world/worldConfig.js";

const footPoint = (tileX, tileY) => Object.freeze({
  x: tileX * TILE_SIZE + TILE_SIZE / 2,
  y: tileY * TILE_SIZE + TILE_SIZE - 2,
});

const doorCenterTile = DOOR_LEFT + HOUSE.doorWidth / 2;
const tavernSignPosition = Object.freeze({ x: (DOOR_LEFT - 2) * TILE_SIZE + 8, y: DOOR_Y * TILE_SIZE + 24 });
const tavernSignInteractionPosition = Object.freeze({ x: (DOOR_LEFT - 1) * TILE_SIZE + 8, y: DOOR_Y * TILE_SIZE + 30 });
const tavernSignGuestCheckPoint = footPoint(doorCenterTile, DOOR_Y + 3);

export const TAVERN_SIGN_KIND = "toggle-tavern";
export const TAVERN_SIGN_BUILD_KIND = "tavern-sign";
export const TAVERN_SIGN_ASSET = Object.freeze({
  key: "tavern.open-sign",
  path: "assets/project/facilities/NestledBurrow_TavernSign.png",
  frameWidth: 32,
  frameHeight: 32,
});
export const TAVERN_SIGN = Object.freeze({
  id: "tavern-open-sign",
  entityId: "tavern-open-sign",
  position: tavernSignPosition,
  interactionPosition: tavernSignInteractionPosition,
  interactionOffset: Object.freeze({
    x: tavernSignInteractionPosition.x - tavernSignPosition.x,
    y: tavernSignInteractionPosition.y - tavernSignPosition.y,
  }),
  guestCheckOffset: Object.freeze({
    x: tavernSignGuestCheckPoint.x - tavernSignPosition.x,
    y: tavernSignGuestCheckPoint.y - tavernSignPosition.y,
  }),
  snapAnchorOffset: Object.freeze({ x: 8, y: 8 }),
  collisionRect: Object.freeze({ left: -5, right: 5, top: -9, bottom: 1 }),
  width: 32,
  height: 32,
});

export const GUEST_CONFIG = Object.freeze({
  idPrefix: "tavern-guest",
  profileId: ACTOR_PROFILE_IDS.villager,
  visualProfileId: CHARACTER_VISUAL_PROFILE_IDS.streetNpc,
  tint: 0xf2c66d,
  initialSpawnDelayMs: 3_000,
  subsequentSpawnDelayMinMs: 3_000,
  subsequentSpawnDelayMaxMs: 8_000,
  signCheckMs: 1_500,
  signReactionMs: 900,
  dishWaitMs: 10_000,
  emptyTableReactionMs: 900,
  eatingMs: 5_000,
  mealCompleteReactionMs: 900,
  blockedReplanMs: 500,
  maxReplans: 6,
  arrivalRadius: 5,
  signFacing: Object.freeze({ x: -1, y: 0 }),
  points: Object.freeze({
    spawn: footPoint(doorCenterTile, DOOR_Y + 9),
    sign: tavernSignGuestCheckPoint,
    outsideDoor: footPoint(doorCenterTile, DOOR_Y + 1),
    insideDoor: footPoint(doorCenterTile, DOOR_Y - 2),
    exit: footPoint(doorCenterTile, DOOR_Y + 9),
  }),
});
