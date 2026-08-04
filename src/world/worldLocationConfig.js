import {
  HOUSE_FRAMES,
  HOUSE_TEXTURE_KEY,
  OUTDOOR_FRAMES,
  OUTDOOR_TEXTURE_KEY,
  TILE_SIZE,
  WORLD_COLUMNS,
  WORLD_ROWS,
} from "./worldConfig.js";

export const WORLD_IDS = Object.freeze({
  village: "village",
  nest: "nest",
  atoll: "atoll",
});

export const TRANSPORT_PROFILE = deepFreeze({
  id: "atoll-transport",
  footprint: { widthTiles: 2, heightTiles: 2, width: 2 * TILE_SIZE, height: 2 * TILE_SIZE },
  trigger: { left: 8, top: 17, right: 24, bottom: 31 },
  shell: [
    { id: "left", left: 0, top: 8, right: 8, bottom: 32 },
    { id: "right", left: 24, top: 8, right: 32, bottom: 32 },
  ],
  visuals: [
    { x: 0, y: 0, frame: HOUSE_FRAMES.transport.topLeft },
    { x: 1, y: 0, frame: HOUSE_FRAMES.transport.topRight },
    { x: 0, y: 1, textureKey: OUTDOOR_TEXTURE_KEY, frame: OUTDOOR_FRAMES.transport.entranceLeft },
    { x: 1, y: 1, textureKey: OUTDOOR_TEXTURE_KEY, frame: OUTDOOR_FRAMES.transport.entranceRight },
  ],
  textureKey: HOUSE_TEXTURE_KEY,
});

const villageTransport = transport({
  id: "village-nest-transport",
  tile: { x: 31, y: 4 },
  destinationWorldId: WORLD_IDS.nest,
  destinationTransportId: "nest-village-transport",
  safeSpawn: { x: 32 * TILE_SIZE, y: 7 * TILE_SIZE - 4, facing: { x: 0, y: 1 } },
});

const nestTransport = transport({
  id: "nest-village-transport",
  tile: { x: 10, y: 13 },
  destinationWorldId: WORLD_IDS.village,
  destinationTransportId: "village-nest-transport",
  safeSpawn: { x: 11 * TILE_SIZE, y: 13 * TILE_SIZE - 8, facing: { x: 0, y: -1 } },
});

export const NEST_ISLAND_MODEL = deepFreeze({
  columns: 22,
  rows: 16,
  ellipse: { centerX: 10.5, centerY: 7.5, radiusX: 10.4, radiusY: 7.35 },
  transportClearance: { left: 10, top: 13, right: 12, bottom: 15 },
  deadEndTiles: [
    { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 },
    { x: 11, y: 5 }, { x: 12, y: 5 }, { x: 13, y: 5 },
  ],
});

export const ATOLL_WORLD_MODEL = deepFreeze({
  columns: 22,
  rows: 18,
  spawn: { x: 11 * TILE_SIZE, y: 14 * TILE_SIZE, facing: { x: 0, y: -1 } },
});

export const WORLD_LOCATION_DEFINITIONS = deepFreeze({
  [WORLD_IDS.village]: {
    id: WORLD_IDS.village,
    productName: "Нора",
    columns: WORLD_COLUMNS,
    rows: WORLD_ROWS,
    capabilities: {
      homeSystems: true,
      npcs: true,
      facilities: true,
      tavernService: true,
      farming: true,
      cooking: true,
      buildMode: true,
      meleeWeapons: true,
      trainingDummy: true,
    },
    transports: [villageTransport],
  },
  [WORLD_IDS.nest]: {
    id: WORLD_IDS.nest,
    productName: "Островное Гнездо",
    columns: NEST_ISLAND_MODEL.columns,
    rows: NEST_ISLAND_MODEL.rows,
    capabilities: {
      homeSystems: false,
      npcs: false,
      facilities: false,
      tavernService: false,
      farming: false,
      cooking: false,
      buildMode: false,
      meleeWeapons: true,
      trainingDummy: false,
    },
    loadSpawn: nestTransport.safeSpawn,
    transports: [nestTransport],
    futureExit: { id: "nest-north-dead-end", destinationWorldId: WORLD_IDS.atoll },
  },
  [WORLD_IDS.atoll]: {
    id: WORLD_IDS.atoll,
    productName: "Дикий Атолл",
    columns: ATOLL_WORLD_MODEL.columns,
    rows: ATOLL_WORLD_MODEL.rows,
    capabilities: {
      homeSystems: false,
      npcs: false,
      facilities: false,
      tavernService: false,
      farming: false,
      cooking: false,
      buildMode: false,
      meleeWeapons: true,
      trainingDummy: false,
    },
    loadSpawn: ATOLL_WORLD_MODEL.spawn,
    transports: [],
  },
});

export const WORLD_LOCATION_IDS = Object.freeze(Object.keys(WORLD_LOCATION_DEFINITIONS));

export function getWorldLocationDefinition(worldId) {
  return WORLD_LOCATION_DEFINITIONS[worldId] ?? null;
}

export function resolveWorldLocationId(worldId) {
  return getWorldLocationDefinition(worldId) ? worldId : WORLD_IDS.village;
}

function transport(value) {
  return deepFreeze({ ...value, profileId: TRANSPORT_PROFILE.id });
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
