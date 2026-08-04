import { TILE_SIZE } from "../world/worldConfig.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveGridSize(value = TILE_SIZE) {
  return Math.max(1, finite(value, TILE_SIZE));
}

function shiftedPoint(value, dx, dy) {
  if (!value || typeof value !== "object") return value;
  return Object.freeze({
    ...value,
    x: finite(value.x) + dx,
    y: finite(value.y) + dy,
  });
}

function shiftedRect(value, dx, dy) {
  if (!value || typeof value !== "object") return value;
  return Object.freeze({
    ...value,
    left: finite(value.left) + dx,
    right: finite(value.right) + dx,
    top: finite(value.top) + dy,
    bottom: finite(value.bottom) + dy,
  });
}

export function snapAssetPlacementPoint(point, gridSize = TILE_SIZE) {
  const size = positiveGridSize(gridSize);
  return Object.freeze({
    x: Math.round(finite(point?.x) / size) * size,
    y: Math.round(finite(point?.y) / size) * size,
  });
}

export function isAssetPlacementAligned(point, gridSize = TILE_SIZE) {
  const snapped = snapAssetPlacementPoint(point, gridSize);
  return snapped.x === finite(point?.x) && snapped.y === finite(point?.y);
}

export function snapAssetFootprintBounds(bounds, gridSize = TILE_SIZE) {
  const size = positiveGridSize(gridSize);
  const width = Math.max(1, finite(bounds?.right) - finite(bounds?.left));
  const height = Math.max(1, finite(bounds?.bottom) - finite(bounds?.top));
  const cellsX = Math.max(1, Math.round(width / size));
  const cellsY = Math.max(1, Math.round(height / size));
  const spanX = cellsX * size;
  const spanY = cellsY * size;
  const centerX = (finite(bounds?.left) + finite(bounds?.right)) / 2;
  const centerY = (finite(bounds?.top) + finite(bounds?.bottom)) / 2;
  const left = Math.round((centerX - spanX / 2) / size) * size;
  const top = Math.round((centerY - spanY / 2) / size) * size;
  return Object.freeze({
    left,
    right: left + spanX,
    top,
    bottom: top + spanY,
    cellsX,
    cellsY,
  });
}

export function roundColliderToAssetFootprint(bounds, gridSize = TILE_SIZE, padding = 2) {
  const footprint = snapAssetFootprintBounds(bounds, gridSize);
  const inset = Math.max(0, finite(padding));
  const safeInsetX = Math.min(inset, (footprint.right - footprint.left - 1) / 2);
  const safeInsetY = Math.min(inset, (footprint.bottom - footprint.top - 1) / 2);
  return Object.freeze({
    left: footprint.left + safeInsetX,
    right: footprint.right - safeInsetX,
    top: footprint.top + safeInsetY,
    bottom: footprint.bottom - safeInsetY,
  });
}

export function normalizeFacilityDefinitionToGrid(definition, gridSize = TILE_SIZE) {
  if (!definition?.footprint) return definition;
  const snapped = snapAssetPlacementPoint(definition.footprint, gridSize);
  const dx = snapped.x - finite(definition.footprint.x);
  const dy = snapped.y - finite(definition.footprint.y);
  if (dx === 0 && dy === 0) return definition;
  const presentationPose = definition.presentationPose
    ? Object.freeze({
        ...definition.presentationPose,
        x: finite(definition.presentationPose.x) + dx,
        y: finite(definition.presentationPose.y) + dy,
        depth: Number.isFinite(Number(definition.presentationPose.depth))
          ? Number(definition.presentationPose.depth) + dy
          : definition.presentationPose.depth,
      })
    : definition.presentationPose;
  return Object.freeze({
    ...definition,
    position: shiftedPoint(definition.position, dx, dy),
    usePosition: shiftedPoint(definition.usePosition, dx, dy),
    footprint: Object.freeze({ ...definition.footprint, x: snapped.x, y: snapped.y }),
    visual: definition.visual
      ? Object.freeze({ ...definition.visual, x: finite(definition.visual.x) + dx, y: finite(definition.visual.y) + dy })
      : definition.visual,
    presentationPose,
  });
}

export function normalizeBedDefinitionToGrid(definition, gridSize = TILE_SIZE) {
  if (!definition?.position) return definition;
  const size = positiveGridSize(gridSize);
  const topLeft = {
    x: finite(definition.position.x) - size / 2,
    y: finite(definition.position.y) - size / 2,
  };
  const snapped = snapAssetPlacementPoint(topLeft, size);
  const dx = snapped.x - topLeft.x;
  const dy = snapped.y - topLeft.y;
  if (dx === 0 && dy === 0) return definition;
  return Object.freeze({
    ...definition,
    position: shiftedPoint(definition.position, dx, dy),
    wakePosition: shiftedPoint(definition.wakePosition, dx, dy),
    presentationPose: definition.presentationPose
      ? Object.freeze({
          ...definition.presentationPose,
          x: finite(definition.presentationPose.x) + dx,
          y: finite(definition.presentationPose.y) + dy,
        })
      : definition.presentationPose,
  });
}

export function normalizeBuildObjectToGrid(object, gridSize = TILE_SIZE) {
  if (!object?.point) return object;
  const snapped = snapAssetPlacementPoint(object.point, gridSize);
  const dx = snapped.x - finite(object.point.x);
  const dy = snapped.y - finite(object.point.y);
  if (dx === 0 && dy === 0) return object;
  return {
    ...object,
    point: Object.freeze({ ...object.point, x: snapped.x, y: snapped.y }),
    bounds: shiftedRect(object.bounds, dx, dy),
    colliderBounds: shiftedRect(object.colliderBounds, dx, dy),
  };
}
