import { ACTOR_PROFILE_IDS } from "./actorProfiles.js";
import { CHARACTER_VISUAL_PROFILE_IDS } from "./characterVisualProfiles.js";
import { DOOR_LEFT, DOOR_Y, TILE_SIZE } from "../world/worldConfig.js";

const point = (tileX, tileY, waitMs = 0) => ({
  x: tileX * TILE_SIZE + TILE_SIZE / 2,
  y: tileY * TILE_SIZE + TILE_SIZE - 2,
  waitMs,
});

export const NPCS = Object.freeze([
  Object.freeze({
    id: "seed-merchant",
    profileId: ACTOR_PROFILE_IDS.villager,
    visualProfileId: CHARACTER_VISUAL_PROFILE_IDS.homeNpc,
    spawn: point(DOOR_LEFT - 2, DOOR_Y + 4),
  }),
]);
