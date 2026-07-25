import { TILE_SIZE } from "./worldConfig.js";

export const FACILITY_INTERACTION_KIND = "use-facility";

function point(tileX, tileY) {
  return Object.freeze({ x: tileX * TILE_SIZE + TILE_SIZE / 2, y: tileY * TILE_SIZE + TILE_SIZE / 2 });
}

function facility({ id, type, tile, useTile, prompt, stopPrompt }) {
  return Object.freeze({
    id,
    entityId: id,
    roomId: "home",
    kind: FACILITY_INTERACTION_KIND,
    facilityType: type,
    position: point(tile.x, tile.y),
    usePosition: point(useTile.x, useTile.y),
    footprint: Object.freeze({ x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE, width: TILE_SIZE * 2, height: TILE_SIZE * 2 }),
    radius: 42,
    priority: 20,
    requiresFacing: false,
    facingDotThreshold: -1,
    prompt,
    stopPrompt,
    payload: Object.freeze({ facilityId: id }),
  });
}

export const FACILITIES = Object.freeze([
  facility({ id: "home-shower-01", type: "shower", tile: { x: 22, y: 14 }, useTile: { x: 24, y: 15 }, prompt: "hud:interaction.shower", stopPrompt: "hud:interaction.leaveShower" }),
  facility({ id: "home-toilet-01", type: "toilet", tile: { x: 22, y: 20 }, useTile: { x: 24, y: 21 }, prompt: "hud:interaction.toilet", stopPrompt: "hud:interaction.leaveToilet" }),
  facility({ id: "home-table-01", type: "table", tile: { x: 40, y: 20 }, useTile: { x: 38, y: 21 }, prompt: "hud:interaction.eat", stopPrompt: "hud:interaction.stopEating" }),
]);

export function getFacility(facilityId) {
  return FACILITIES.find((facility) => facility.id === facilityId) ?? null;
}
