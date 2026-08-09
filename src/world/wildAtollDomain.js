import { createResourceDefinition } from "../resources/resourceConfig.js";
import { WORLD_IDS } from "./worldLocationConfig.js";

export const WILD_ATOLL_SEGMENTS = Object.freeze({
  starter: "starter",
  sereneSkerries: "serene-skerries",
  forestedIsthmus: "forested-isthmus",
  deepSkerries: "deep-skerries",
  motu: "motu",
  fearsomeSkerries: "fearsome-skerries",
  sereneGrotto: "serene-grotto",
  shadowIsthmus: "shadow-isthmus",
  deepGrotto: "deep-grotto",
  blueHole: "blue-hole",
  relictGrotto: "relict-grotto",
});

const STARTER_RESOURCE_PATTERN = Object.freeze([
  Object.freeze(["log-small", "stone-small", "berry-bush"]),
  Object.freeze(["log-small", "berry-bush", "berry-bush"]),
  Object.freeze(["stone-small", "stone-small", "berry-bush"]),
  Object.freeze(["log-small", "stone-small", "berry-bush", "berry-bush"]),
  Object.freeze(["log-small", "log-small", "berry-bush"]),
  Object.freeze(["log-small", "log-small", "stone-small"]),
  Object.freeze(["stone-small", "stone-small", "log-small"]),
  Object.freeze([]),
]);

const FOREST_RESOURCE_PATTERN = Object.freeze([
  Object.freeze(["log-small", "berry-bush", "berry-bush"]),
  Object.freeze(["log-small", "log-small", "berry-bush"]),
  Object.freeze(["log-small", "stone-small", "berry-bush"]),
  Object.freeze(["log-small", "berry-bush", "berry-bush"]),
  Object.freeze(["log-small", "log-small", "stone-small"]),
  Object.freeze(["log-small", "berry-bush", "stone-small"]),
  Object.freeze(["log-small", "log-small", "berry-bush"]),
  Object.freeze([]),
]);

const MINE_RESOURCE_PATTERN = Object.freeze([
  Object.freeze(["stone-small", "stone-small", "berry-bush"]),
  Object.freeze(["stone-small", "stone-small", "log-small"]),
  Object.freeze(["stone-small", "berry-bush", "log-small"]),
  Object.freeze(["stone-small", "stone-small", "berry-bush"]),
  Object.freeze(["stone-small", "stone-small", "log-small"]),
  Object.freeze(["stone-small", "berry-bush", "log-small"]),
  Object.freeze(["stone-small", "stone-small", "stone-small"]),
  Object.freeze([]),
]);

const SEGMENT_SPECS = Object.freeze([
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.starter,
    segmentKey: "atoll:segments.starter",
    resourcePattern: STARTER_RESOURCE_PATTERN,
    nextSegments: [WILD_ATOLL_SEGMENTS.sereneSkerries, WILD_ATOLL_SEGMENTS.sereneGrotto],
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.sereneSkerries,
    segmentKey: "atoll:segments.sereneSkerries",
    resourcePattern: FOREST_RESOURCE_PATTERN,
    nextSegments: [WILD_ATOLL_SEGMENTS.forestedIsthmus, WILD_ATOLL_SEGMENTS.deepSkerries],
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.forestedIsthmus,
    segmentKey: "atoll:segments.forestedIsthmus",
    resourcePattern: STARTER_RESOURCE_PATTERN,
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.deepSkerries,
    segmentKey: "atoll:segments.deepSkerries",
    resourcePattern: FOREST_RESOURCE_PATTERN,
    nextSegments: [WILD_ATOLL_SEGMENTS.motu, WILD_ATOLL_SEGMENTS.fearsomeSkerries],
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.motu,
    segmentKey: "atoll:segments.motu",
    resourcePattern: STARTER_RESOURCE_PATTERN,
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.fearsomeSkerries,
    segmentKey: "atoll:segments.fearsomeSkerries",
    resourcePattern: FOREST_RESOURCE_PATTERN,
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.sereneGrotto,
    segmentKey: "atoll:segments.sereneGrotto",
    resourcePattern: MINE_RESOURCE_PATTERN,
    nextSegments: [WILD_ATOLL_SEGMENTS.shadowIsthmus, WILD_ATOLL_SEGMENTS.deepGrotto],
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.shadowIsthmus,
    segmentKey: "atoll:segments.shadowIsthmus",
    resourcePattern: STARTER_RESOURCE_PATTERN,
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.deepGrotto,
    segmentKey: "atoll:segments.deepGrotto",
    resourcePattern: MINE_RESOURCE_PATTERN,
    nextSegments: [WILD_ATOLL_SEGMENTS.blueHole, WILD_ATOLL_SEGMENTS.relictGrotto],
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.blueHole,
    segmentKey: "atoll:segments.blueHole",
    resourcePattern: MINE_RESOURCE_PATTERN,
  }),
  segmentSpec({
    id: WILD_ATOLL_SEGMENTS.relictGrotto,
    segmentKey: "atoll:segments.relictGrotto",
    resourcePattern: MINE_RESOURCE_PATTERN,
  }),
]);

const SEGMENT_DEFINITIONS = new Map();
const ARENA_DEFINITIONS = new Map();
for (const spec of SEGMENT_SPECS) {
  const definition = buildSegment(spec);
  SEGMENT_DEFINITIONS.set(definition.id, definition);
  for (const arena of definition.arenas) ARENA_DEFINITIONS.set(arena.id, arena);
}

const starterDefinition = SEGMENT_DEFINITIONS.get(WILD_ATOLL_SEGMENTS.starter);
export const WILD_ATOLL_ARENAS = Object.freeze({
  root: starterDefinition.entryArenaId,
  meadow: starterDefinition.levels[1][0],
  stones: starterDefinition.levels[1][1],
  pond: starterDefinition.levels[2][0],
  thicket: starterDefinition.levels[2][1],
  roots: starterDefinition.levels[3][0],
  slope: starterDefinition.levels[3][1],
  edge: starterDefinition.terminalArenaId,
});

export const WILD_ATOLL_STARTER_LEVELS = starterDefinition.levels;
export const WILD_ATOLL_STARTER_ARENAS = starterDefinition.arenaIds;
export const WILD_ATOLL_SEGMENT_IDS = Object.freeze(SEGMENT_SPECS.map(({ id }) => id));
export const WILD_ATOLL_ALL_ARENAS = Object.freeze(
  WILD_ATOLL_SEGMENT_IDS.flatMap((segmentId) => SEGMENT_DEFINITIONS.get(segmentId).arenaIds),
);

const RESOURCE_CELLS = Object.freeze([
  Object.freeze({ x: 10, y: 16 }),
  Object.freeze({ x: 32, y: 16 }),
  Object.freeze({ x: 14, y: 22 }),
  Object.freeze({ x: 30, y: 22 }),
  Object.freeze({ x: 10, y: 26 }),
  Object.freeze({ x: 34, y: 26 }),
]);

export const WILD_ATOLL_LOCALIZATION_KEYS = Object.freeze([
  "atoll:arrival",
  "atoll:leftRun",
  "atoll:promptEnter",
  "atoll:paths.nest",
  ...WILD_ATOLL_SEGMENT_IDS.flatMap((segmentId) => {
    const segment = SEGMENT_DEFINITIONS.get(segmentId);
    return [
      segment.segmentKey,
      ...segment.arenas.flatMap((arena) => [
        arena.arenaKey,
        ...arena.exits.map((exit) => exit.promptKey),
      ]),
    ];
  }),
]);

export function getWildAtollSegmentDefinition(segmentId) {
  const definition = SEGMENT_DEFINITIONS.get(segmentId);
  if (!definition) throw new Error(`Unknown Wild Atoll segment: ${String(segmentId)}`);
  return definition;
}

export function getWildAtollArenaDefinition(arenaId) {
  const definition = ARENA_DEFINITIONS.get(arenaId);
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
    center: { x: 2 * tileSize, y: 10 * tileSize },
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

function segmentSpec({ id, segmentKey, resourcePattern, nextSegments = [] }) {
  return Object.freeze({
    id,
    segmentKey,
    resourcePattern,
    nextSegments: Object.freeze([...nextSegments]),
  });
}

function buildSegment(spec) {
  const ids = Object.freeze({
    root: `${spec.id}-root`,
    left1: `${spec.id}-left-1`,
    right1: `${spec.id}-right-1`,
    left2: `${spec.id}-left-2`,
    right2: `${spec.id}-right-2`,
    left3: `${spec.id}-left-3`,
    right3: `${spec.id}-right-3`,
    edge: `${spec.id}-edge`,
  });
  const levels = deepFreeze([
    [ids.root],
    [ids.left1, ids.right1],
    [ids.left2, ids.right2],
    [ids.left3, ids.right3],
    [ids.edge],
  ]);
  const arenaIds = Object.freeze(levels.flat());
  const resourcesById = new Map(arenaIds.map((arenaId, index) => [arenaId, spec.resourcePattern[index]]));
  const arena = (arenaId, exits, terminal = false) => Object.freeze({
    id: arenaId,
    segmentId: spec.id,
    segmentKey: spec.segmentKey,
    arenaKey: `atoll:arenas.${spec.id}.${arenaNodeName(arenaId)}`,
    resources: resourcesById.get(arenaId),
    exits: Object.freeze(exits),
    terminal,
  });
  const pathTo = (sourceArenaId, targetArenaId) => Object.freeze({
    id: targetArenaId,
    kind: "path",
    targetArenaId,
    direction: deriveWildAtollDirection(arenaLane(sourceArenaId), arenaLane(targetArenaId)),
    promptKey: `atoll:paths.${spec.id}.${arenaNodeName(targetArenaId)}`,
  });
  const terminalExits = [
    ...spec.nextSegments.map((targetSegmentId, index) => Object.freeze({
      id: targetSegmentId,
      kind: "segment",
      targetSegmentId,
      direction: deriveWildAtollDirection("center", index === 0 ? "left" : "right"),
      promptKey: `atoll:segmentPaths.${targetSegmentId}`,
    })),
    Object.freeze({
      id: "nest",
      kind: "teleport",
      targetWorldId: WORLD_IDS.nest,
      direction: "center",
      promptKey: "atoll:paths.nest",
    }),
  ];
  const arenas = Object.freeze([
    arena(ids.root, [pathTo(ids.root, ids.left1), pathTo(ids.root, ids.right1)]),
    arena(ids.left1, [pathTo(ids.left1, ids.left2), pathTo(ids.left1, ids.right2)]),
    arena(ids.right1, [pathTo(ids.right1, ids.left2), pathTo(ids.right1, ids.right2)]),
    arena(ids.left2, [pathTo(ids.left2, ids.left3), pathTo(ids.left2, ids.right3)]),
    arena(ids.right2, [pathTo(ids.right2, ids.left3), pathTo(ids.right2, ids.right3)]),
    arena(ids.left3, [pathTo(ids.left3, ids.edge)]),
    arena(ids.right3, [pathTo(ids.right3, ids.edge)]),
    arena(ids.edge, terminalExits, true),
  ]);
  return Object.freeze({
    id: spec.id,
    segmentKey: spec.segmentKey,
    entryArenaId: ids.root,
    terminalArenaId: ids.edge,
    levels,
    arenaIds,
    arenas,
    nextSegmentIds: spec.nextSegments,
  });
}

export function deriveWildAtollDirection(sourceLane, targetLane) {
  const rank = { left: -1, center: 0, right: 1 };
  if (!(sourceLane in rank) || !(targetLane in rank)) {
    throw new Error(`Unknown Wild Atoll lane transition: ${String(sourceLane)} -> ${String(targetLane)}`);
  }
  const delta = rank[targetLane] - rank[sourceLane];
  return delta < 0 ? "north-west" : delta > 0 ? "north-east" : "north";
}

function arenaLane(arenaId) {
  const node = arenaNodeName(arenaId);
  if (node === "root" || node === "edge") return "center";
  return node.startsWith("left") ? "left" : "right";
}

function arenaNodeName(arenaId) {
  if (arenaId.endsWith("-root")) return "root";
  if (arenaId.endsWith("-left-1")) return "left1";
  if (arenaId.endsWith("-right-1")) return "right1";
  if (arenaId.endsWith("-left-2")) return "left2";
  if (arenaId.endsWith("-right-2")) return "right2";
  if (arenaId.endsWith("-left-3")) return "left3";
  if (arenaId.endsWith("-right-3")) return "right3";
  if (arenaId.endsWith("-edge")) return "edge";
  throw new Error(`Unknown Wild Atoll arena node: ${arenaId}`);
}

function seededOrder(values, seed) {
  return values
    .map((value, index) => ({ value, rank: hashUnit(`${seed}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.value);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
