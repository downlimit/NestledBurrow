import { createResourceDefinition } from "../resources/resourceConfig.js";
import { WORLD_IDS } from "./worldLocationConfig.js";

export const WILD_ATOLL_SEGMENTS = Object.freeze({
  starter: "starter",
  forestT1: "forest-t1",
  mineT1: "mine-t1",
});

export const WILD_ATOLL_ARENAS = Object.freeze({
  root: "starter-root",
  meadow: "starter-meadow",
  stones: "starter-stones",
  pond: "starter-pond",
  thicket: "starter-thicket",
  roots: "starter-roots",
  slope: "starter-slope",
  edge: "starter-edge",
});

export const WILD_ATOLL_STARTER_LEVELS = Object.freeze([
  Object.freeze([WILD_ATOLL_ARENAS.root]),
  Object.freeze([WILD_ATOLL_ARENAS.meadow, WILD_ATOLL_ARENAS.stones]),
  Object.freeze([WILD_ATOLL_ARENAS.pond, WILD_ATOLL_ARENAS.thicket]),
  Object.freeze([WILD_ATOLL_ARENAS.roots, WILD_ATOLL_ARENAS.slope]),
  Object.freeze([WILD_ATOLL_ARENAS.edge]),
]);

export const WILD_ATOLL_STARTER_ARENAS = Object.freeze(WILD_ATOLL_STARTER_LEVELS.flat());

const ARENA_DEFINITIONS = Object.freeze({
  [WILD_ATOLL_ARENAS.root]: arena({
    id: WILD_ATOLL_ARENAS.root,
    arenaKey: "hud:atoll.arenas.root",
    resources: ["log-small", "stone-small", "berry-bush"],
    exits: [
      path("meadow", WILD_ATOLL_ARENAS.meadow, "north-west", "hud:atoll.paths.meadow"),
      path("stones", WILD_ATOLL_ARENAS.stones, "north-east", "hud:atoll.paths.stones"),
    ],
  }),
  [WILD_ATOLL_ARENAS.meadow]: arena({
    id: WILD_ATOLL_ARENAS.meadow,
    arenaKey: "hud:atoll.arenas.meadow",
    resources: ["log-small", "berry-bush", "berry-bush"],
    exits: [
      path("pond", WILD_ATOLL_ARENAS.pond, "north-west", "hud:atoll.paths.pond"),
      path("thicket", WILD_ATOLL_ARENAS.thicket, "north-east", "hud:atoll.paths.thicket"),
    ],
  }),
  [WILD_ATOLL_ARENAS.stones]: arena({
    id: WILD_ATOLL_ARENAS.stones,
    arenaKey: "hud:atoll.arenas.stones",
    resources: ["stone-small", "stone-small", "berry-bush"],
    exits: [
      path("pond", WILD_ATOLL_ARENAS.pond, "north-west", "hud:atoll.paths.pond"),
      path("thicket", WILD_ATOLL_ARENAS.thicket, "north-east", "hud:atoll.paths.thicket"),
    ],
  }),
  [WILD_ATOLL_ARENAS.pond]: arena({
    id: WILD_ATOLL_ARENAS.pond,
    arenaKey: "hud:atoll.arenas.pond",
    resources: ["log-small", "stone-small", "berry-bush", "berry-bush"],
    exits: [
      path("roots", WILD_ATOLL_ARENAS.roots, "north-west", "hud:atoll.paths.roots"),
      path("slope", WILD_ATOLL_ARENAS.slope, "north-east", "hud:atoll.paths.slope"),
    ],
  }),
  [WILD_ATOLL_ARENAS.thicket]: arena({
    id: WILD_ATOLL_ARENAS.thicket,
    arenaKey: "hud:atoll.arenas.thicket",
    resources: ["log-small", "log-small", "berry-bush"],
    exits: [
      path("roots", WILD_ATOLL_ARENAS.roots, "north-west", "hud:atoll.paths.roots"),
      path("slope", WILD_ATOLL_ARENAS.slope, "north-east", "hud:atoll.paths.slope"),
    ],
  }),
  [WILD_ATOLL_ARENAS.roots]: arena({
    id: WILD_ATOLL_ARENAS.roots,
    arenaKey: "hud:atoll.arenas.roots",
    resources: ["log-small", "log-small", "stone-small"],
    exits: [path("edge", WILD_ATOLL_ARENAS.edge, "north", "hud:atoll.paths.edge")],
  }),
  [WILD_ATOLL_ARENAS.slope]: arena({
    id: WILD_ATOLL_ARENAS.slope,
    arenaKey: "hud:atoll.arenas.slope",
    resources: ["stone-small", "stone-small", "log-small"],
    exits: [path("edge", WILD_ATOLL_ARENAS.edge, "north", "hud:atoll.paths.edge")],
  }),
  [WILD_ATOLL_ARENAS.edge]: arena({
    id: WILD_ATOLL_ARENAS.edge,
    arenaKey: "hud:atoll.arenas.edge",
    resources: [],
    terminal: true,
    exits: [
      Object.freeze({
        id: "forest-t1",
        kind: "segment",
        targetSegmentId: WILD_ATOLL_SEGMENTS.forestT1,
        direction: "north-west",
        promptKey: "hud:atoll.paths.forestT1",
        blockedMessageKey: "hud:atoll.segmentLocked.forestT1",
      }),
      Object.freeze({
        id: "mine-t1",
        kind: "segment",
        targetSegmentId: WILD_ATOLL_SEGMENTS.mineT1,
        direction: "north-east",
        promptKey: "hud:atoll.paths.mineT1",
        blockedMessageKey: "hud:atoll.segmentLocked.mineT1",
      }),
      Object.freeze({
        id: "nest",
        kind: "teleport",
        targetWorldId: WORLD_IDS.nest,
        direction: "center",
        promptKey: "hud:atoll.paths.nest",
      }),
    ],
  }),
});

const RESOURCE_CELLS = Object.freeze([
  Object.freeze({ x: 10, y: 16 }),
  Object.freeze({ x: 32, y: 16 }),
  Object.freeze({ x: 14, y: 22 }),
  Object.freeze({ x: 30, y: 22 }),
  Object.freeze({ x: 10, y: 26 }),
  Object.freeze({ x: 34, y: 26 }),
]);

export const WILD_ATOLL_LOCALIZATION_KEYS = Object.freeze([
  "hud:atoll.arrival",
  "hud:atoll.leftRun",
  "hud:atoll.promptEnter",
  "hud:atoll.segmentStarter",
  "hud:atoll.segmentLocked.forestT1",
  "hud:atoll.segmentLocked.mineT1",
  ...Object.values(ARENA_DEFINITIONS).flatMap((definition) => [
    definition.arenaKey,
    ...definition.exits.flatMap((exit) => [exit.promptKey, exit.blockedMessageKey].filter(Boolean)),
  ]),
]);

export function getWildAtollArenaDefinition(arenaId) {
  const definition = ARENA_DEFINITIONS[arenaId];
  if (!definition) throw new Error(`Unknown Wild Atoll arena: ${String(arenaId)}`);
  return definition;
}

export function createWildAtollArenaResources(seed, runId, arenaId) {
  const definition = getWildAtollArenaDefinition(arenaId);
  const positions = seededOrder(RESOURCE_CELLS, `${seed}:${arenaId}`);
  return definition.resources.map((profileId, index) => createResourceDefinition({
    id: `atoll-${runId}-${arenaId}-${index}`,
    profileId,
    cell: positions[index],
    worldId: WORLD_IDS.atoll,
    roomId: `atoll:${arenaId}`,
  }));
}

export function getWildAtollExitPoint(direction, tileSize = 16) {
  const points = {
    north: { x: 11 * tileSize, y: 4 * tileSize },
    "north-west": { x: 7 * tileSize, y: 5 * tileSize },
    "north-east": { x: 15 * tileSize, y: 5 * tileSize },
    center: { x: 11 * tileSize, y: 10 * tileSize },
  };
  const point = points[direction];
  if (!point) throw new Error(`Unknown Wild Atoll exit direction: ${String(direction)}`);
  return point;
}

export function hashUnit(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

function arena({ id, arenaKey, resources, exits, terminal = false }) {
  return Object.freeze({
    id,
    segmentId: WILD_ATOLL_SEGMENTS.starter,
    segmentKey: "hud:atoll.segmentStarter",
    arenaKey,
    resources: Object.freeze([...resources]),
    exits: Object.freeze([...exits]),
    terminal: Boolean(terminal),
  });
}

function path(id, targetArenaId, direction, promptKey) {
  return Object.freeze({ id, kind: "path", targetArenaId, direction, promptKey });
}

function seededOrder(values, seed) {
  return values
    .map((value, index) => ({ value, rank: hashUnit(`${seed}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.value);
}
