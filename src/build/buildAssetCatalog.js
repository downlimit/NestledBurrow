import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
} from "../world/worldConfig.js";
import {
  FACILITY_BUILD_ORDER,
  FACILITY_NAME_KEYS,
} from "../facilities/facilityConfig.js";
import { TRAINING_DUMMY } from "../combat/meleeConfig.js";
import { FARMING_WELL_TEXTURE_KEY } from "../resources/farmingConfig.js";
import { RESOURCE_PROFILES } from "../resources/resourceDomain.js";
import { TAVERN_SIGN_ASSET, TAVERN_SIGN_BUILD_KIND } from "../tavern/guestConfig.js";
import {
  definePlaceableCatalogItem,
  PLACEABLE_BUILD_OWNER_IDS,
} from "./placeableBuildProtocol.js";

const RESOURCE_BUILD_ORDER = Object.freeze([
  "tree-planted",
  "berry-bush",
  "log-small",
  "log-large",
  "stone-small",
  "stone-large",
  "ruby-node",
]);

export const BUILD_FACILITY_ITEMS = Object.freeze(FACILITY_BUILD_ORDER.map((facilityType) => (
  definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.facility, {
    id: facilityType,
    placement: "facility",
    facilityType,
    icon: facilityType,
    labelKey: FACILITY_NAME_KEYS[facilityType],
  })
)));

export const BUILD_RESOURCE_ITEMS = Object.freeze(RESOURCE_BUILD_ORDER.map((profileId) => {
  const profile = RESOURCE_PROFILES[profileId];
  return definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.resource, {
    id: `resource-${profileId}`,
    placement: "resource",
    resourceProfileId: profileId,
    objectType: profile.kind,
    labelKey: profile.nameKey,
  });
}));

export const BUILD_SPECIAL_ITEMS = Object.freeze([
  definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.well, {
    id: "well",
    placement: "well",
    textureKey: FARMING_WELL_TEXTURE_KEY,
    frame: 0,
    labelKey: "build:assets.well",
  }),
  definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.tavernSign, {
    id: TAVERN_SIGN_BUILD_KIND,
    placement: TAVERN_SIGN_BUILD_KIND,
    textureKey: TAVERN_SIGN_ASSET.key,
    frame: 1,
    thumbnailScale: 0.5,
    labelKey: "build:assets.tavernSign",
  }),
  definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.trainingDummy, {
    id: "training-dummy",
    placement: "training-dummy",
    textureKey: TRAINING_DUMMY.asset.textureKey,
    frame: 0,
    thumbnailScale: 0.5,
    labelKey: "build:assets.trainingDummy",
  }),
]);

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
    labelKey: "build:groups.facilities",
    items: Object.freeze([
      Object.freeze({ id: "privacy-screen", placement: "wall", dragPaint: false, labelKey: "hud:buildMode.assets.privacyScreen", textureKey: HOUSE_TEXTURE_KEY, frame: HOUSE_FRAMES.sideLeft }),
      definePlaceableCatalogItem(PLACEABLE_BUILD_OWNER_IDS.bed, {
        id: "bed",
        placement: "bed",
        icon: "bed",
        labelKey: "hud:buildMode.assets.bed",
      }),
      ...BUILD_FACILITY_ITEMS,
      ...BUILD_SPECIAL_ITEMS,
    ]),
  }),
  Object.freeze({
    id: "decorations",
    labelKey: "build:groups.resources",
    items: BUILD_RESOURCE_ITEMS,
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
