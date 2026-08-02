export const WILD_ATOLL_ROUTES = Object.freeze({
  entry: "entry",
  mist: "mist",
  stone: "stone",
});

export const WILD_ATOLL_DROP_CHANCE = 0.6;

export function applyWildAtollRouteEntry(gameplay, routeId) {
  if (!gameplay?.needs || !Number.isFinite(gameplay.currentEnergy)) {
    throw new Error("Wild Atoll route entry requires gameplay needs and energy");
  }
  if (routeId === WILD_ATOLL_ROUTES.mist) {
    const beforeLustre = gameplay.needs.lustre;
    const beforeEnergy = gameplay.currentEnergy;
    gameplay.needs.lustre = Math.min(100, gameplay.needs.lustre + 20);
    gameplay.currentEnergy = Math.max(0, gameplay.currentEnergy - 5);
    return {
      routeId,
      lustreDelta: gameplay.needs.lustre - beforeLustre,
      energyDelta: gameplay.currentEnergy - beforeEnergy,
    };
  }
  if (routeId === WILD_ATOLL_ROUTES.stone) {
    const beforeEnergy = gameplay.currentEnergy;
    gameplay.currentEnergy = Math.max(0, gameplay.currentEnergy - 10);
    return { routeId, lustreDelta: 0, energyDelta: gameplay.currentEnergy - beforeEnergy };
  }
  throw new Error(`Unknown Wild Atoll route: ${String(routeId)}`);
}

export function resolveWildAtollGrassDrop({ seed, grassIndex, routeId }) {
  if (!Number.isInteger(grassIndex) || grassIndex < 0) throw new Error("Wild Atoll grass index must be non-negative");
  if (routeId !== WILD_ATOLL_ROUTES.mist && routeId !== WILD_ATOLL_ROUTES.stone) {
    throw new Error(`Unknown Wild Atoll route: ${String(routeId)}`);
  }
  if (hashUnit(`${seed}:drop:${grassIndex}`) >= WILD_ATOLL_DROP_CHANCE) return null;
  const woodChance = routeId === WILD_ATOLL_ROUTES.mist ? 0.75 : 0.25;
  return hashUnit(`${seed}:item:${grassIndex}`) < woodChance ? "wood" : "stone";
}

export function wildAtollFrameIndex(seed, grassIndex, frameCount) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) throw new Error("Wild Atoll frame count must be positive");
  return Math.floor(hashUnit(`${seed}:frame:${grassIndex}`) * frameCount);
}

export function hashUnit(text) {
  let hash = 2166136261;
  for (const char of String(text)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  hash ^= hash >>> 16;
  return (hash >>> 0) / 0x100000000;
}
