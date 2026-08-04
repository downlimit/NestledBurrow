import PROJECT_ASSET_PROFILES from "../build/assetProfilesDefault.js";
import { PLACEABLE_TARGETING_GROUP } from "../build/liveAssetGeometry.js";
import { createActorNavigation, findGridPath } from "../tavern/gridPathfinder.js";
import { INTERACTION_APPROACH_DIRECTIONS, normalizeInteractionDirections } from "./interactionDirections.js";

export const INTERACTION_NAVIGATION_CELL_SIZE = 16;
const GRID_EDGE_EPSILON = 0.000001;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function colliderTargeting(collider) {
  return collider ? Object.freeze({
    requiresFacing: true,
    facingDotThreshold: 0,
    targetingMode: "facing-first",
    targetingGroup: PLACEABLE_TARGETING_GROUP,
  }) : Object.freeze({});
}

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
    const points = interactionPoints(definition, collider);
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
      selectionDistance: Math.hypot(
        aimPosition.x - sourceSnapshot.position.x,
        aimPosition.y - sourceSnapshot.position.y,
      ),
      payload: { ...definition.payload },
      ...colliderTargeting(collider),
    };
  }

  function resolve(definition, sourceSnapshot) {
    if (definition.__interactionProbe) return probe(definition, sourceSnapshot);
    const collider = interactionCollider(worldLayout, definition);
    if (definition.targetingMode === "facing-first" && !collider) return probe(definition, sourceSnapshot);
    const player = getPlayer();
    const points = interactionPoints(definition, collider);
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
      if (!navigation.isWorldWalkable(point)) return [];
      const path = findGridPath({
        start: sourceSnapshot.position,
        goal: point,
        bounds: worldLayout.bounds,
        cellSize: INTERACTION_NAVIGATION_CELL_SIZE,
        ...navigation,
      });
      if (!path) return [];
      const route = connectExactApproachPoint(sourceSnapshot.position, path, point, navigation);
      if (!route) return [];
      const distance = pathDistance(sourceSnapshot.position, route);
      return distance <= definition.radius
        && hasDirectInteractionReach(worldLayout, point, aimPosition, targetId)
        ? [{ point, path: route, distance }]
        : [];
    }).sort((a, b) => a.distance - b.distance || a.point.y - b.point.y || a.point.x - b.point.x);
    const nearest = routes[0];
    if (!nearest) return null;
    return {
      position: nearest.point,
      aimPosition,
      availabilityDistance: nearest.distance,
      selectionDistance: Math.hypot(
        aimPosition.x - sourceSnapshot.position.x,
        aimPosition.y - sourceSnapshot.position.y,
      ),
      payload: { ...definition.payload, approachPoint: nearest.point, approachPath: nearest.path },
      ...colliderTargeting(collider),
    };
  }

  return Object.freeze({ probe, resolve });
}

function interactionPoints(definition, collider) {
  if (!collider) return definition.usePosition ? [{ ...definition.usePosition }] : [{ ...definition.position }];
  const enabledDirections = new Set(normalizeInteractionDirections(interactionDirectionsFor(definition)));
  return perimeterInteractionPointEntries(collider, INTERACTION_NAVIGATION_CELL_SIZE)
    .filter(({ direction }) => enabledDirections.has(direction))
    .map(({ point }) => point);
}

function interactionDirectionsFor(definition) {
  if (definition.interactionDirections) return definition.interactionDirections;
  const profileKey = interactionProfileKey(definition);
  return PROJECT_ASSET_PROFILES?.profiles?.[profileKey]?.interactionDirections
    ?? INTERACTION_APPROACH_DIRECTIONS;
}

function interactionProfileKey(definition) {
  if (definition?.facilityType) return `facility:${definition.facilityType}`;
  if (definition?.profileId) return `resource:${definition.profileId}`;
  if (definition?.payload?.bedId || String(definition?.id ?? "").includes("bed")) return "furniture:bed";
  return null;
}

function connectExactApproachPoint(start, gridPath, point, navigation) {
  if (navigation.canTraverseWorld(start, point)) return [{ ...point }];
  const route = gridPath.map((entry) => ({ ...entry }));
  const first = route[0] ?? point;
  if (!navigation.canTraverseWorld(start, first)) return null;
  const tail = route.at(-1) ?? start;
  if (!samePoint(tail, point)) {
    if (!navigation.canTraverseWorld(tail, point)) return null;
    route.push({ ...point });
  } else if (route.length > 0) {
    route[route.length - 1] = { ...point };
  }
  if (route.length === 0) route.push({ ...point });
  return route;
}

function samePoint(left, right) {
  return Math.abs(left.x - right.x) < 1e-9 && Math.abs(left.y - right.y) < 1e-9;
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

export function interactionFootprintBounds(bounds, cellSize = INTERACTION_NAVIGATION_CELL_SIZE) {
  const size = Math.max(1, finite(cellSize, INTERACTION_NAVIGATION_CELL_SIZE));
  const sourceLeft = finite(bounds?.left);
  const sourceRight = finite(bounds?.right, sourceLeft + size);
  const sourceTop = finite(bounds?.top);
  const sourceBottom = finite(bounds?.bottom, sourceTop + size);
  const left = Math.floor((sourceLeft + GRID_EDGE_EPSILON) / size) * size;
  const top = Math.floor((sourceTop + GRID_EDGE_EPSILON) / size) * size;
  let right = Math.ceil((sourceRight - GRID_EDGE_EPSILON) / size) * size;
  let bottom = Math.ceil((sourceBottom - GRID_EDGE_EPSILON) / size) * size;
  if (right <= left) right = left + size;
  if (bottom <= top) bottom = top + size;
  return Object.freeze({ left, right, top, bottom });
}

export function perimeterInteractionPointEntries(bounds, cellSize = INTERACTION_NAVIGATION_CELL_SIZE) {
  const size = Math.max(1, finite(cellSize, INTERACTION_NAVIGATION_CELL_SIZE));
  const footprint = interactionFootprintBounds(bounds, size);
  const width = Math.max(1, Math.round((footprint.right - footprint.left) / size));
  const height = Math.max(1, Math.round((footprint.bottom - footprint.top) / size));
  const entries = [];
  for (let x = -1; x <= width; x += 1) {
    entries.push({
      direction: x === -1 ? "top-left" : x === width ? "top-right" : "top",
      point: { x: footprint.left + (x + 0.5) * size, y: footprint.top - size / 2 },
    });
    entries.push({
      direction: x === -1 ? "bottom-left" : x === width ? "bottom-right" : "bottom",
      point: { x: footprint.left + (x + 0.5) * size, y: footprint.bottom + size / 2 },
    });
  }
  for (let y = 0; y < height; y += 1) {
    entries.push({
      direction: "left",
      point: { x: footprint.left - size / 2, y: footprint.top + (y + 0.5) * size },
    });
    entries.push({
      direction: "right",
      point: { x: footprint.right + size / 2, y: footprint.top + (y + 0.5) * size },
    });
  }
  return Object.freeze(entries.map(({ direction, point }) => Object.freeze({
    direction,
    point: Object.freeze(point),
  })));
}

export function perimeterInteractionPoints(bounds, cellSize = INTERACTION_NAVIGATION_CELL_SIZE) {
  return Object.freeze(perimeterInteractionPointEntries(bounds, cellSize).map(({ point }) => point));
}

export function filterPerimeterInteractionPoints(bounds, directions = INTERACTION_APPROACH_DIRECTIONS, cellSize = INTERACTION_NAVIGATION_CELL_SIZE) {
  const enabled = new Set(normalizeInteractionDirections(directions));
  return Object.freeze(perimeterInteractionPointEntries(bounds, cellSize)
    .filter(({ direction }) => enabled.has(direction))
    .map(({ point }) => point));
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
