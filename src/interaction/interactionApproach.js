import { createActorNavigation, findGridPath } from "../tavern/gridPathfinder.js";

export const INTERACTION_NAVIGATION_CELL_SIZE = 16;

export function createInteractionApproachResolver({ worldLayout, getPlayer }) {
  const probeWallsBySource = new WeakMap();

  function probeWalls(sourceSnapshot) {
    if (sourceSnapshot && typeof sourceSnapshot === "object" && probeWallsBySource.has(sourceSnapshot)) {
      return probeWallsBySource.get(sourceSnapshot);
    }
    const walls = (worldLayout.getWorldObjectColliders?.() ?? []).filter(isWallBarrier);
    if (sourceSnapshot && typeof sourceSnapshot === "object") probeWallsBySource.set(sourceSnapshot, walls);
    return walls;
  }

  function probe(definition, sourceSnapshot) {
    const aimPosition = definition.aimPosition ?? definition.position;
    const targetId = definition.entityId ?? definition.id;
    const walls = probeWalls(sourceSnapshot);
    if (definition.targetingMode === "facing-first") {
      const distance = Math.hypot(
        definition.position.x - sourceSnapshot.position.x,
        definition.position.y - sourceSnapshot.position.y,
      );
      if (distance > definition.radius
        || !hasDirectInteractionReachAgainst(walls, sourceSnapshot.position, definition.position, targetId)) return null;
      return {
        position: definition.position,
        aimPosition,
        availabilityDistance: distance,
        payload: { ...definition.payload },
      };
    }

    const collider = interactionCollider(worldLayout, definition);
    const points = collider
      ? perimeterInteractionPoints(collider, INTERACTION_NAVIGATION_CELL_SIZE)
      : definition.usePosition ? [{ ...definition.usePosition }] : [{ ...definition.position }];
    const nearest = points
      .flatMap((point) => {
        const distance = Math.hypot(
          point.x - sourceSnapshot.position.x,
          point.y - sourceSnapshot.position.y,
        );
        return distance <= definition.radius
          && hasDirectInteractionReachAgainst(walls, point, aimPosition, targetId)
          ? [{ point, distance }]
          : [];
      })
      .sort((a, b) => a.distance - b.distance || a.point.y - b.point.y || a.point.x - b.point.x)[0];
    if (!nearest) return null;
    return {
      position: nearest.point,
      aimPosition,
      availabilityDistance: nearest.distance,
      payload: { ...definition.payload },
    };
  }

  function resolve(definition, sourceSnapshot) {
    if (definition.__interactionProbe) return probe(definition, sourceSnapshot);
    if (definition.targetingMode === "facing-first") return probe(definition, sourceSnapshot);
    const player = getPlayer();
    const collider = interactionCollider(worldLayout, definition);
    const points = collider
      ? perimeterInteractionPoints(collider, INTERACTION_NAVIGATION_CELL_SIZE)
      : definition.usePosition ? [{ ...definition.usePosition }] : [{ ...definition.position }];
    const aimPosition = definition.aimPosition ?? definition.position;
    const targetId = definition.entityId ?? definition.id;
    const nearbyPoints = points.filter((point) => (
      Math.hypot(
        point.x - sourceSnapshot.position.x,
        point.y - sourceSnapshot.position.y,
      ) <= definition.radius
      && hasDirectInteractionReach(worldLayout, point, aimPosition, targetId)
    ));
    if (nearbyPoints.length === 0) return null;

    const navigation = createActorNavigation(worldLayout, {
      cellSize: INTERACTION_NAVIGATION_CELL_SIZE,
      footWidth: player.footWidth,
      footDepth: player.footDepth,
    });
    const routes = nearbyPoints.flatMap((point) => {
      const path = findGridPath({
        start: sourceSnapshot.position,
        goal: point,
        bounds: worldLayout.bounds,
        cellSize: INTERACTION_NAVIGATION_CELL_SIZE,
        ...navigation,
      });
      if (!path) return [];
      const route = path.length > 0 ? path : [{ ...point }];
      const distance = pathDistance(sourceSnapshot.position, route);
      const endpoint = route.at(-1);
      return distance <= definition.radius
        && hasDirectInteractionReach(worldLayout, endpoint, aimPosition, targetId)
        ? [{ point: endpoint, path: route, distance }]
        : [];
    }).sort((a, b) => a.distance - b.distance || a.point.y - b.point.y || a.point.x - b.point.x);
    const nearest = routes[0];
    if (!nearest) return null;
    return {
      position: nearest.point,
      aimPosition,
      availabilityDistance: nearest.distance,
      payload: { ...definition.payload, approachPoint: nearest.point, approachPath: nearest.path },
    };
  }

  return Object.freeze({ probe, resolve });
}

function interactionCollider(worldLayout, definition) {
  const resourceCollider = worldLayout.getResourceCollider?.(definition.id)
    ?? worldLayout.getResourceCollider?.(definition.entityId);
  if (resourceCollider) return resourceCollider;
  const worldCollider = worldLayout.getWorldObjectColliders?.().find((entry) => (
    entry.id === definition.id || entry.id === definition.entityId
  ));
  return worldCollider?.rect ?? null;
}

export function hasDirectInteractionReach(worldLayout, start, goal, targetId = null) {
  return hasDirectInteractionReachAgainst(
    worldLayout.getWorldObjectColliders?.() ?? [],
    start,
    goal,
    targetId,
  );
}

function hasDirectInteractionReachAgainst(colliders, start, goal, targetId = null) {
  return !colliders.some((entry) => entry.id !== targetId
    && isWallBarrier(entry)
    && segmentIntersectsRect(start, goal, entry.rect));
}

function isWallBarrier(entry) {
  const groupKey = String(entry?.groupKey ?? "").toLowerCase();
  return Boolean(entry?.wallEdge || entry?.wallNode || groupKey.includes("wall"));
}

function segmentIntersectsRect(start, goal, rect) {
  let minimum = 0;
  let maximum = 1;
  const dx = goal.x - start.x;
  const dy = goal.y - start.y;
  for (const [origin, delta, low, high] of [[start.x, dx, rect.left, rect.right], [start.y, dy, rect.top, rect.bottom]]) {
    if (delta === 0) {
      if (origin < low || origin > high) return false;
      continue;
    }
    const first = (low - origin) / delta;
    const second = (high - origin) / delta;
    minimum = Math.max(minimum, Math.min(first, second));
    maximum = Math.min(maximum, Math.max(first, second));
    if (minimum > maximum) return false;
  }
  return maximum >= 0 && minimum <= 1;
}

export function perimeterInteractionPoints(bounds, cellSize = INTERACTION_NAVIGATION_CELL_SIZE) {
  const width = Math.max(1, Math.ceil((bounds.right - bounds.left) / cellSize));
  const height = Math.max(1, Math.ceil((bounds.bottom - bounds.top) / cellSize));
  const points = [];
  for (let x = -1; x <= width; x += 1) {
    points.push({ x: bounds.left + (x + 0.5) * cellSize, y: bounds.top - cellSize / 2 });
    points.push({ x: bounds.left + (x + 0.5) * cellSize, y: bounds.top + (height + 0.5) * cellSize });
  }
  for (let y = 0; y < height; y += 1) {
    points.push({ x: bounds.left - cellSize / 2, y: bounds.top + (y + 0.5) * cellSize });
    points.push({ x: bounds.left + (width + 0.5) * cellSize, y: bounds.top + (y + 0.5) * cellSize });
  }
  return Object.freeze(points.map(Object.freeze));
}

function pathDistance(start, path) {
  let distance = 0;
  let previous = start;
  for (const point of path) {
    distance += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return distance;
}
