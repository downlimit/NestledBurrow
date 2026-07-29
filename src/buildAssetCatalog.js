import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  TREES_TEXTURE_KEY,
} from "./worldConfig.js";

export const BUILD_ASSET_GROUPS = Object.freeze([
  Object.freeze({
    id: "tools",
    labelKey: "hud:buildMode.groups.tools",
    items: Object.freeze([
      Object.freeze({ id: "demolish", mode: "demolish", icon: "demolish", labelKey: "hud:buildMode.assets.demolish" }),
    ]),
  }),
  Object.freeze({
    id: "ground",
    labelKey: "hud:buildMode.groups.ground",
    items: Object.freeze([
      Object.freeze({ id: "grass", placement: "tile", dragPaint: true, labelKey: "hud:buildMode.assets.grass", textureKey: OUTDOOR_TEXTURE_KEY, frame: OUTDOOR_FRAMES.grass }),
      Object.freeze({ id: "path", placement: "tile", dragPaint: true, labelKey: "hud:buildMode.assets.path", textureKey: OUTDOOR_TEXTURE_KEY, frame: OUTDOOR_FRAMES.pathMiddle[1] }),
      Object.freeze({ id: "parquet", placement: "floor", dragPaint: true, labelKey: "hud:buildMode.assets.parquet", textureKey: HOUSE_TEXTURE_KEY, frame: HOUSE_FRAMES.floor }),
      Object.freeze({ id: "carpet", placement: "carpet", dragPaint: true, labelKey: "hud:buildMode.assets.carpet", textureKey: HOUSE_TEXTURE_KEY, frame: HOUSE_FRAMES.carpet.center }),
    ]),
  }),
  Object.freeze({
    id: "walls",
    labelKey: "hud:buildMode.groups.walls",
    items: Object.freeze([
      Object.freeze({ id: "wall", placement: "wall", dragPaint: true, labelKey: "hud:buildMode.assets.wall", textureKey: HOUSE_TEXTURE_KEY, frame: HOUSE_FRAMES.bottom }),
    ]),
  }),
  Object.freeze({
    id: "furniture",
    labelKey: "hud:buildMode.groups.furniture",
    items: Object.freeze([
      Object.freeze({ id: "bed", placement: "bed", icon: "bed", labelKey: "hud:buildMode.assets.bed" }),
      Object.freeze({ id: "shower", placement: "facility", facilityType: "shower", icon: "shower", labelKey: "hud:buildMode.assets.shower" }),
      Object.freeze({ id: "toilet", placement: "facility", facilityType: "toilet", icon: "toilet", labelKey: "hud:buildMode.assets.toilet" }),
      Object.freeze({ id: "table", placement: "facility", facilityType: "table", icon: "table", labelKey: "hud:buildMode.assets.table" }),
      Object.freeze({ id: "cutting-table", placement: "facility", facilityType: "cutting-table", icon: "cutting-table", labelKey: "hud:kitchen.facilities.cuttingTable" }),
      Object.freeze({ id: "gas-stove", placement: "facility", facilityType: "gas-stove", icon: "gas-stove", labelKey: "hud:kitchen.facilities.gasStove" }),
      Object.freeze({ id: "serving-table", placement: "facility", facilityType: "serving-table", icon: "serving-table", labelKey: "hud:kitchen.facilities.servingTable" }),
    ]),
  }),
  Object.freeze({
    id: "decorations",
    labelKey: "hud:buildMode.groups.plants",
    items: Object.freeze([
      Object.freeze({
        id: "tree",
        placement: "tree",
        objectType: "plant",
        resourceProfileId: "tree-planted",
        labelKey: "hud:buildMode.assets.tree",
        textureKey: TREES_TEXTURE_KEY,
        frame: 0,
      }),
    ]),
  }),
]);

export const BUILD_SURFACE_FRAME_BY_MASK = Object.freeze({
  0: OUTDOOR_FRAMES.grass,
  1: OUTDOOR_FRAMES.pathBottom[2],
  2: OUTDOOR_FRAMES.pathBottom[0],
  3: OUTDOOR_FRAMES.pathBottom[1],
  4: OUTDOOR_FRAMES.pathTop[2],
  5: OUTDOOR_FRAMES.pathMiddle[2],
  7: OUTDOOR_FRAMES.grassOuterCorners.topLeft,
  8: OUTDOOR_FRAMES.pathTop[0],
  10: OUTDOOR_FRAMES.pathMiddle[0],
  11: OUTDOOR_FRAMES.grassOuterCorners.topRight,
  12: OUTDOOR_FRAMES.pathTop[1],
  13: OUTDOOR_FRAMES.grassOuterCorners.bottomLeft,
  14: OUTDOOR_FRAMES.grassOuterCorners.bottomRight,
  15: OUTDOOR_FRAMES.pathMiddle[1],
});

export const BUILD_SURFACE_CUSTOM_MASKS = Object.freeze([6, 9]);

export const BUILD_CARPET_FRAME_BY_MASK = Object.freeze({
  1: HOUSE_FRAMES.carpet.bottomRight,
  2: HOUSE_FRAMES.carpet.bottomLeft,
  3: HOUSE_FRAMES.carpet.bottom,
  4: HOUSE_FRAMES.carpet.topRight,
  5: HOUSE_FRAMES.carpet.right,
  6: HOUSE_FRAMES.carpet.center,
  7: HOUSE_FRAMES.carpet.center,
  8: HOUSE_FRAMES.carpet.topLeft,
  9: HOUSE_FRAMES.carpet.center,
  10: HOUSE_FRAMES.carpet.left,
  11: HOUSE_FRAMES.carpet.center,
  12: HOUSE_FRAMES.carpet.top,
  13: HOUSE_FRAMES.carpet.center,
  14: HOUSE_FRAMES.carpet.center,
  15: HOUSE_FRAMES.carpet.center,
});

export function getBuildSurfaceMask({
  northWest = false,
  northEast = false,
  southWest = false,
  southEast = false,
} = {}) {
  return (northWest ? 1 : 0)
    | (northEast ? 2 : 0)
    | (southWest ? 4 : 0)
    | (southEast ? 8 : 0);
}

export function getBuildWallFrames({
  north = false,
  east = false,
  south = false,
  west = false,
  explicit = false,
} = {}) {
  const count = [north, east, south, west].filter(Boolean).length;
  const verticalTerminus = north !== south && !east && !west;
  return explicit || count >= 3 || verticalTerminus
    ? [HOUSE_FRAMES.sideLeft]
    : [];
}

export function getBuildVerticalWallFrame({
  joinsEast = false,
  joinsWest = false,
} = {}) {
  return joinsEast && !joinsWest
    ? HOUSE_FRAMES.wallLeftCap
    : HOUSE_FRAMES.wallRightCap;
}

export function getBuildWallColumnOffset({
  verticalTerminus: _verticalTerminus = false,
  explicit: _explicit = false,
} = {}) {
  return -TILE_SIZE;
}

export function getBuildVerticalWallOffset() {
  return 0;
}

export function getBuildWallColumnDepthOffset({
  verticalTerminus = false,
  explicit = false,
  isBottom = false,
} = {}) {
  return verticalTerminus && !explicit && !isBottom ? -1 : 1;
}
