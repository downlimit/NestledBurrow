export const WILD_ATOLL_ARENAS = Object.freeze({
  edge: "edge",
  grove: "grove",
  fork: "fork",
  forest: "forest",
  mine: "mine",
});

export const WILD_ATOLL_STARTER_PATH = Object.freeze([
  WILD_ATOLL_ARENAS.edge,
  WILD_ATOLL_ARENAS.grove,
  WILD_ATOLL_ARENAS.fork,
]);

const ARENA_DEFINITIONS = Object.freeze({
  [WILD_ATOLL_ARENAS.edge]: Object.freeze({
    id: WILD_ATOLL_ARENAS.edge,
    titleKey: "hud:atoll.edgeTitle",
    resources: Object.freeze(["log", "stone", "berry"]),
    exits: Object.freeze([
      Object.freeze({ id: "nest", target: "nest", direction: "south", promptKey: "hud:atoll.promptReturnNest" }),
      Object.freeze({ id: "forward", target: WILD_ATOLL_ARENAS.grove, direction: "north", promptKey: "hud:atoll.promptForward" }),
    ]),
  }),
  [WILD_ATOLL_ARENAS.grove]: Object.freeze({
    id: WILD_ATOLL_ARENAS.grove,
    titleKey: "hud:atoll.groveTitle",
    resources: Object.freeze(["log", "log", "stone", "berry", "berry"]),
    exits: Object.freeze([
      Object.freeze({ id: "back", target: WILD_ATOLL_ARENAS.edge, direction: "south", promptKey: "hud:atoll.promptBack" }),
      Object.freeze({ id: "forward", target: WILD_ATOLL_ARENAS.fork, direction: "north", promptKey: "hud:atoll.promptForward" }),
    ]),
  }),
  [WILD_ATOLL_ARENAS.fork]: Object.freeze({
    id: WILD_ATOLL_ARENAS.fork,
    titleKey: "hud:atoll.forkTitle",
    resources: Object.freeze([]),
    exits: Object.freeze([
      Object.freeze({ id: "back", target: WILD_ATOLL_ARENAS.grove, direction: "south", promptKey: "hud:atoll.promptBack" }),
      Object.freeze({ id: "forest", target: WILD_ATOLL_ARENAS.forest, direction: "north-west", cave: true, promptKey: "hud:atoll.promptForest" }),
      Object.freeze({ id: "mine", target: WILD_ATOLL_ARENAS.mine, direction: "north-east", cave: true, promptKey: "hud:atoll.promptMine" }),
    ]),
  }),
  [WILD_ATOLL_ARENAS.forest]: Object.freeze({
    id: WILD_ATOLL_ARENAS.forest,
    titleKey: "hud:atoll.forestTitle",
    resources: Object.freeze(["log", "log", "log", "stone", "berry", "berry"]),
    exits: Object.freeze([
      Object.freeze({ id: "back", target: WILD_ATOLL_ARENAS.fork, direction: "south", promptKey: "hud:atoll.promptBack" }),
    ]),
  }),
  [WILD_ATOLL_ARENAS.mine]: Object.freeze({
    id: WILD_ATOLL_ARENAS.mine,
    titleKey: "hud:atoll.mineTitle",
    resources: Object.freeze(["stone", "stone", "stone", "log", "berry"]),
    exits: Object.freeze([
      Object.freeze({ id: "back", target: WILD_ATOLL_ARENAS.fork, direction: "south", promptKey: "hud:atoll.promptBack" }),
    ]),
  }),
});

const RESOURCE_POSITIONS = Object.freeze([
  Object.freeze({ x: 6, y: 7 }),
  Object.freeze({ x: 15, y: 7 }),
  Object.freeze({ x: 8, y: 11 }),
  Object.freeze({ x: 13, y: 11 }),
  Object.freeze({ x: 6, y: 14 }),
  Object.freeze({ x: 15, y: 14 }),
]);

const RESOURCE_PROFILES = Object.freeze({
  log: Object.freeze({ kind: "log", profileId: "log-small", itemId: "wood", requiredTool: "axe", hp: 2, promptKey: "hud:atoll.promptChop" }),
  stone: Object.freeze({ kind: "stone", profileId: "stone-small", itemId: "stone", requiredTool: "pickaxe", hp: 3, promptKey: "hud:atoll.promptMineResource" }),
  berry: Object.freeze({ kind: "berry", profileId: null, itemId: "berry", requiredTool: null, hp: 1, promptKey: "hud:atoll.promptGatherBerry" }),
});

export function getWildAtollArenaDefinition(arenaId) {
  const definition = ARENA_DEFINITIONS[arenaId];
  if (!definition) throw new Error(`Unknown Wild Atoll arena: ${String(arenaId)}`);
  return definition;
}

export function createWildAtollArenaNodes(seed, arenaId) {
  const definition = getWildAtollArenaDefinition(arenaId);
  const positions = seededOrder(RESOURCE_POSITIONS, `${seed}:${arenaId}`);
  return definition.resources.map((kind, index) => {
    const profile = RESOURCE_PROFILES[kind];
    const position = positions[index];
    return {
      id: `atoll-${arenaId}-${index}`,
      arenaId,
      index,
      ...profile,
      tileX: position.x,
      tileY: position.y,
      progress: 0,
      cleared: false,
    };
  });
}

export function getWildAtollExitPoint(direction, tileSize = 16) {
  const points = {
    north: { x: 11 * tileSize, y: 4 * tileSize },
    south: { x: 11 * tileSize, y: 16 * tileSize },
    "north-west": { x: 7 * tileSize, y: 5 * tileSize },
    "north-east": { x: 15 * tileSize, y: 5 * tileSize },
  };
  const point = points[direction];
  if (!point) throw new Error(`Unknown Wild Atoll exit direction: ${String(direction)}`);
  return point;
}

export function getWildAtollSpawnPoint(direction, tileSize = 16) {
  if (direction === "north") return { x: 11 * tileSize, y: 14 * tileSize };
  if (direction === "south") return { x: 11 * tileSize, y: 7 * tileSize };
  if (direction === "north-west" || direction === "north-east") return { x: 11 * tileSize, y: 14 * tileSize };
  return { x: 11 * tileSize, y: 14 * tileSize };
}

export function hashUnit(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}

function seededOrder(values, seed) {
  return values
    .map((value, index) => ({ value, rank: hashUnit(`${seed}:${index}`) }))
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.value);
}
