import { BED_ASSET } from "../resources/debrisConfig.js";
import { TILE_SIZE } from "../world/worldConfig.js";
import { LEMONADE_FRAMES, LEMONADE_TEXTURE_KEY } from "../tavern/lemonadeConfig.js";

export const FACILITY_INTERACTION_KIND = "use-facility";
export const FACILITY_ASSETS = Object.freeze({
  shower: Object.freeze({ key: "facility.bathtub", path: "assets/project/facilities/NestledBurrow_Bathtub.png", width: 32, height: 32 }),
  toilet: Object.freeze({ key: "facility.toilet", path: "assets/project/facilities/NestledBurrow_Toilet.png", width: 16, height: 16 }),
  sink: Object.freeze({ key: "facility.sink", path: "assets/project/facilities/NestledBurrow_Sink.png", width: 16, height: 16 }),
  table: Object.freeze({ key: "facility.dining-table-feast", path: "assets/project/facilities/NestledBurrow_DiningTableFeast.png", width: 48, height: 16 }),
  "cutting-table": Object.freeze({ key: "facility.cutting-table", path: "assets/project/facilities/NestledBurrow_CuttingTable.png", width: 32, height: 16 }),
  "gas-stove": Object.freeze({ key: "facility.gas-stove", path: "assets/project/facilities/NestledBurrow_GasStove.png", width: 16, height: 32 }),
  "serving-table": Object.freeze({ key: "facility.serving-table", path: "assets/project/facilities/NestledBurrow_ServingTable.png", width: 32, height: 16 }),
  juicer: Object.freeze({ key: LEMONADE_TEXTURE_KEY, frame: LEMONADE_FRAMES.juicer, width: 16, height: 16 }),
  "lemon-sack": Object.freeze({ key: LEMONADE_TEXTURE_KEY, frame: LEMONADE_FRAMES["lemon-sack-full"], width: 16, height: 16 }),
});

export const FACILITY_BUILD_ORDER = Object.freeze([
  "shower",
  "toilet",
  "sink",
  "table",
  "cutting-table",
  "gas-stove",
  "serving-table",
  "juicer",
  "lemon-sack",
]);

export const FACILITY_NAME_KEYS = Object.freeze({
  shower: "hud:buildMode.assets.shower",
  toilet: "hud:buildMode.assets.toilet",
  sink: "hud:buildMode.assets.sink",
  table: "hud:buildMode.assets.table",
  "cutting-table": "build:assets.cuttingTable",
  "gas-stove": "build:assets.gasStove",
  "serving-table": "build:assets.servingTable",
  juicer: "build:assets.juicer",
  "lemon-sack": "build:assets.lemonSack",
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
    sink: ["hud:interaction.washAtSink", "hud:interaction.leaveSink"],
    table: ["hud:interaction.eat", "hud:interaction.stopEating"],
    "cutting-table": ["hud:interaction.startPreparation", "hud:interaction.startPreparation"],
    "gas-stove": ["hud:interaction.startFrying", "hud:interaction.startFrying"],
    "serving-table": ["hud:interaction.serveDish", "hud:interaction.takeDish"],
    juicer: ["hud:interaction.makeLemonade", "hud:interaction.makeLemonade"],
    "lemon-sack": ["hud:interaction.takeLemons", "hud:interaction.takeLemons"],
  };
  const [prompt, stopPrompt] = labels[type];
  const footprint = Object.freeze({
    x: tile.x * TILE_SIZE,
    y: tile.y * TILE_SIZE,
    width: asset.width,
    height: asset.height,
  });
  return Object.freeze({
    id,
    entityId: id,
    roomId: "home",
    kind: FACILITY_INTERACTION_KIND,
    facilityType: type,
    capabilities: Object.freeze(type === "serving-table" ? ["guest-service"] : []),
    editable,
    nameKey: FACILITY_NAME_KEYS[type],
    position: Object.freeze({ x: footprint.x + TILE_SIZE / 2, y: footprint.y + TILE_SIZE / 2 }),
    usePosition: Object.freeze({ x: useTile.x * TILE_SIZE + TILE_SIZE / 2, y: useTile.y * TILE_SIZE + TILE_SIZE / 2 }),
    footprint,
    visual: Object.freeze({ key: asset.key, path: asset.path, frame: asset.frame ?? 0, x: footprint.x, y: footprint.y, width: asset.width, height: asset.height }),
    presentationPose: ["shower", "toilet"].includes(type)
      ? Object.freeze({ x: footprint.x + asset.width / 2, y: footprint.y + asset.height / 2, facing: "down", angle: 0, depth: 501 + footprint.y + asset.height })
      : null,
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
  createFacilityDefinition({ id: "home-shower-01", type: "shower", tile: { x: 27, y: 20 }, useTile: { x: 29, y: 21 } }),
  createFacilityDefinition({ id: "home-toilet-01", type: "toilet", tile: { x: 33, y: 20 }, useTile: { x: 35, y: 21 } }),
  createFacilityDefinition({ id: "home-sink-01", type: "sink", tile: { x: 36, y: 20 }, useTile: { x: 36, y: 21 } }),
  createFacilityDefinition({ id: "home-table-01", type: "table", tile: { x: 36, y: 26 }, useTile: { x: 34, y: 27 } }),
  createFacilityDefinition({ id: "home-cutting-table-01", type: "cutting-table", tile: { x: 29, y: 21 }, useTile: { x: 30, y: 22 } }),
  createFacilityDefinition({ id: "home-gas-stove-01", type: "gas-stove", tile: { x: 31, y: 20 }, useTile: { x: 32, y: 21 } }),
  createFacilityDefinition({ id: "home-serving-table-01", type: "serving-table", tile: { x: 33, y: 26 }, useTile: { x: 34, y: 27 } }),
  createFacilityDefinition({ id: "home-lemon-sack-01", type: "lemon-sack", tile: { x: 27, y: 24 }, useTile: { x: 28, y: 24 } }),
  createFacilityDefinition({ id: "home-juicer-01", type: "juicer", tile: { x: 29, y: 24 }, useTile: { x: 30, y: 24 } }),
]);

export function preloadFacilityAssets(scene, baseUrl = import.meta.env.BASE_URL) {
  for (const asset of [...Object.values(FACILITY_ASSETS), PLATED_DISH_ASSET, BED_ASSET].filter((entry) => entry.path)) {
    scene.load.image(asset.key, `${baseUrl}${asset.path}`);
  }
}

export function getFacility(facilityId) {
  return FACILITIES.find((facility) => facility.id === facilityId) ?? null;
}
