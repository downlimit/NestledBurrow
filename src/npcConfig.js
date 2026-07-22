import { ACTOR_PROFILE_IDS } from "./actorProfiles.js";
import { CHARACTER_VISUAL_PROFILE_IDS } from "./characterVisualProfiles.js";
import { DOOR_LEFT, DOOR_Y, HOUSE, TILE_SIZE } from "./worldConfig.js";

const point = (tileX, tileY, waitMs = 0) => ({
  x: tileX * TILE_SIZE + TILE_SIZE / 2,
  y: tileY * TILE_SIZE + TILE_SIZE - 2,
  waitMs,
});

export const NPCS = Object.freeze([
  Object.freeze({
    id: "home-npc",
    profileId: ACTOR_PROFILE_IDS.villager,
    visualProfileId: CHARACTER_VISUAL_PROFILE_IDS.homeNpc,
    spawn: point(HOUSE.x + 6, HOUSE.y + 5),
    patrol: Object.freeze({
      mode: "loop",
      waypoints: Object.freeze([
        point(HOUSE.x + 6, HOUSE.y + 5, 2400),
        point(HOUSE.x + 10, HOUSE.y + 7),
        point(HOUSE.x + HOUSE.columns - 8, HOUSE.y + 6, 2600),
        point(HOUSE.x + HOUSE.columns - 11, HOUSE.y + 10),
        point(HOUSE.x + HOUSE.columns - 6, DOOR_Y - 3, 2200),
        point(HOUSE.x + 12, DOOR_Y - 4),
        point(HOUSE.x + 7, DOOR_Y - 7, 2300),
      ]),
    }),
  }),
  Object.freeze({
    id: "street-npc",
    profileId: ACTOR_PROFILE_IDS.villager,
    visualProfileId: CHARACTER_VISUAL_PROFILE_IDS.streetNpc,
    spawn: point(DOOR_LEFT + 1, DOOR_Y + 5),
    patrol: Object.freeze({
      mode: "loop",
      waypoints: Object.freeze([
        point(DOOR_LEFT + 1, DOOR_Y + 5, 2200),
        point(DOOR_LEFT + 1, DOOR_Y + 7),
        point(DOOR_LEFT - 2, DOOR_Y + 8, 2600),
        point(DOOR_LEFT - 1, DOOR_Y + 11),
        point(DOOR_LEFT + 2, DOOR_Y + 12, 2400),
        point(DOOR_LEFT + 4, DOOR_Y + 9),
        point(DOOR_LEFT + 2, DOOR_Y + 6),
      ]),
    }),
  }),
]);
