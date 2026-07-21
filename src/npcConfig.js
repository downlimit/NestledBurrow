import { DOOR_LEFT, DOOR_Y, HOUSE, TILE_SIZE } from "./worldConfig.js";

const point = (tileX, tileY) => ({
  x: tileX * TILE_SIZE + TILE_SIZE / 2,
  y: tileY * TILE_SIZE + TILE_SIZE - 2,
});

export const NPCS = Object.freeze([
  Object.freeze({
    id: "home-npc",
    spawn: point(HOUSE.x + 6, HOUSE.y + 5),
    patrol: Object.freeze({
      mode: "loop",
      waypoints: Object.freeze([
        point(HOUSE.x + 6, HOUSE.y + 5),
        point(HOUSE.x + HOUSE.columns - 7, HOUSE.y + 5),
        point(HOUSE.x + HOUSE.columns - 7, DOOR_Y - 3),
        point(HOUSE.x + 6, DOOR_Y - 3),
      ]),
    }),
  }),
  Object.freeze({
    id: "street-npc",
    spawn: point(DOOR_LEFT + 1, DOOR_Y + 5),
    patrol: Object.freeze({
      mode: "ping-pong",
      waypoints: Object.freeze([
        point(DOOR_LEFT + 1, DOOR_Y + 5),
        point(DOOR_LEFT + 1, DOOR_Y + 9),
        point(DOOR_LEFT + 1, DOOR_Y + 13),
      ]),
    }),
  }),
]);
