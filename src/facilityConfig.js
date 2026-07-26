import { BED_ASSET } from "./debrisConfig.js";
import { TILE_SIZE } from "./worldConfig.js";

export const FACILITY_INTERACTION_KIND = "use-facility";
export const FACILITY_ASSETS = Object.freeze({
  shower: Object.freeze({ key: "facility.bathtub", path: "assets/project/facilities/NestledBurrow_Bathtub.png", width: 32, height: 32 }),
  toilet: Object.freeze({ key: "facility.toilet", path: "assets/project/facilities/NestledBurrow_Toilet.png", width: 16, height: 16 }),
  table: Object.freeze({ key: "facility.dining-table-feast", path: "assets/project/facilities/NestledBurrow_DiningTableFeast.png", width: 48, height: 16 }),
  "cutting-table": Object.freeze({ key: "facility.cutting-table", path: "assets/project/facilities/NestledBurrow_CuttingTable.png", width: 32, height: 16 }),
  "gas-stove": Object.freeze({ key: "facility.gas-stove", path: "assets/project/facilities/NestledBurrow_GasStove.png", width: 16, height: 32 }),
  "serving-table": Object.freeze({ key: "facility.serving-table", path: "assets/project/facilities/NestledBurrow_ServingTable.png", width: 32, height: 16 }),
});
export const PLATED_DISH_ASSET = Object.freeze({
  key: "facility.fried-potato-dish",
  path: "assets/project/facilities/NestledBurrow_FriedPotatoDish.png",
  width: 16,
  height: 16,
});

export function createFacilityDefinition({ id, type, tile, useTile, editable = true }) {
  const asset = FACILITY_ASSETS[type];
  if (!asset) throw new Error(`Unknown facility type: ${type}`);
  const labels = {
    shower: ["hud:interaction.shower", "hud:interaction.leaveShower"],
    toilet: ["hud:interaction.toilet", "hud:interaction.leaveToilet"],
    table: ["hud:interaction.eat", "hud:interaction.stopEating"],
    "cutting-table": ["hud:interaction.startPreparation", "hud:interaction.startPreparation"],
    "gas-stove": ["hud:interaction.startFrying", "hud:interaction.startFrying"],
    "serving-table": ["hud:interaction.serveDish", "hud:interaction.takeDish"],
  };
  const names = {
    shower: "hud:buildMode.assets.shower",
    toilet: "hud:buildMode.assets.toilet",
    table: "hud:buildMode.assets.table",
    "cutting-table": "hud:kitchen.facilities.cuttingTable",
    "gas-stove": "hud:kitchen.facilities.gasStove",
    "serving-table": "hud:kitchen.facilities.servingTable",
  };
  const [prompt, stopPrompt] = labels[type];
  const footprint = Object.freeze({
    x: tile.x * TILE_SIZE,
    y: tile.y * TILE_SIZE,
    width: asset.width,
    height: asset.height,
  });
  return Object.freeze({
    id, entityId: id, roomId: "home", kind: FACILITY_INTERACTION_KIND, facilityType: type, editable, nameKey: names[type],
    position: Object.freeze({ x: footprint.x + TILE_SIZE / 2, y: footprint.y + TILE_SIZE / 2 }),
    usePosition: Object.freeze({ x: useTile.x * TILE_SIZE + TILE_SIZE / 2, y: useTile.y * TILE_SIZE + TILE_SIZE / 2 }),
    footprint,
    visual: Object.freeze({ key: asset.key, path: asset.path, x: footprint.x, y: footprint.y, width: asset.width, height: asset.height }),
    presentationPose: ["shower", "toilet"].includes(type) ? Object.freeze({ x: footprint.x + asset.width / 2, y: footprint.y + asset.height / 2, facing: "down", angle: 0, depth: 501 + footprint.y + asset.height }) : null,
    radius: 42, priority: 20, requiresFacing: false, facingDotThreshold: -1, prompt, stopPrompt, payload: Object.freeze({ facilityId: id }),
  });
}

export const FACILITIES = Object.freeze([
  createFacilityDefinition({ id: "home-shower-01", type: "shower", tile: { x: 22, y: 14 }, useTile: { x: 24, y: 15 } }),
  createFacilityDefinition({ id: "home-toilet-01", type: "toilet", tile: { x: 22, y: 20 }, useTile: { x: 24, y: 21 } }),
  createFacilityDefinition({ id: "home-table-01", type: "table", tile: { x: 40, y: 20 }, useTile: { x: 38, y: 21 } }),
  createFacilityDefinition({ id: "home-cutting-table-01", type: "cutting-table", tile: { x: 26, y: 12 }, useTile: { x: 27, y: 13 }, editable: false }),
  createFacilityDefinition({ id: "home-gas-stove-01", type: "gas-stove", tile: { x: 29, y: 12 }, useTile: { x: 30, y: 13 }, editable: false }),
  createFacilityDefinition({ id: "home-serving-table-01", type: "serving-table", tile: { x: 35, y: 12 }, useTile: { x: 36, y: 13 }, editable: false }),
]);

export function preloadFacilityAssets(scene, baseUrl = import.meta.env.BASE_URL) {
  for (const asset of [...Object.values(FACILITY_ASSETS), PLATED_DISH_ASSET, BED_ASSET]) {
    scene.load.image(asset.key, `${baseUrl}${asset.path}`);
  }
}
export function getFacility(facilityId) { return FACILITIES.find((facility) => facility.id === facilityId) ?? null; }
