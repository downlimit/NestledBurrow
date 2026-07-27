export const WALL_COLLIDER_GROUPS = Object.freeze({
  horizontal: "build:wall:horizontal",
  vertical: "build:wall:vertical",
  node: "build:wall-node",
  legacy: "build:wall",
});

const ZERO_OFFSETS = Object.freeze({ left: 0, right: 0, top: 0, bottom: 0 });

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function pointKey(point) {
  return `${Number(point.x)},${Number(point.y)}`;
}

export function applyColliderOffsets(base, offsets = ZERO_OFFSETS) {
  return Object.freeze({
    left: Number(base.left) + finite(offsets.left),
    right: Number(base.right) + finite(offsets.right),
    top: Number(base.top) + finite(offsets.top),
    bottom: Number(base.bottom) + finite(offsets.bottom),
  });
}

export function wallColliderGroup(orientation) {
  if (orientation !== "horizontal" && orientation !== "vertical") {
    throw new Error(`Unknown wall orientation: ${String(orientation)}`);
  }
  return WALL_COLLIDER_GROUPS[orientation];
}

export function migrateDirectionalWallOverrides(overrides = {}) {
  const migrated = { ...overrides };
  const legacy = migrated[WALL_COLLIDER_GROUPS.legacy];
  if (legacy) {
    migrated[WALL_COLLIDER_GROUPS.horizontal] ??= { ...legacy };
    migrated[WALL_COLLIDER_GROUPS.vertical] ??= { ...legacy };
    delete migrated[WALL_COLLIDER_GROUPS.legacy];
  }
  return migrated;
}

export function wallEdgeVertices(edge, tileSize) {
  return edge.orientation === "vertical"
    ? [{ x: edge.x, y: edge.y }, { x: edge.x, y: edge.y + tileSize }]
    : [{ x: edge.x, y: edge.y }, { x: edge.x + tileSize, y: edge.y }];
}

export function hasIncidentWall(incidents = {}) {
  return [incidents.north, incidents.east, incidents.south, incidents.west].some(Boolean);
}

function sharesWallEndpoint(candidate, existing, tileSize) {
  const endpoints = new Set(wallEdgeVertices(candidate, tileSize).map(pointKey));
  return wallEdgeVertices(existing, tileSize).some((point) => endpoints.has(pointKey(point)));
}

function overlaps(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}

export function isWallPlacementBlocked({ edge, collider, colliders, tileSize }) {
  const endpoints = new Set(wallEdgeVertices(edge, tileSize).map(pointKey));
  return colliders.some((entry) => {
    if (!overlaps(collider, entry.rect)) return false;
    if (entry.wallEdge && sharesWallEndpoint(edge, entry.wallEdge, tileSize)) return false;
    if (entry.wallNode && endpoints.has(pointKey(entry.wallNode))) return false;
    return true;
  });
}

export function createPlacementDragState({ placementPosition, pointer, snapAnchorOffset = { x: 0, y: 0 } }) {
  const origin = { x: Number(placementPosition.x), y: Number(placementPosition.y) };
  const rawPointer = { x: Number(pointer.x), y: Number(pointer.y) };
  return Object.freeze({
    origin: Object.freeze(origin),
    pointerStart: Object.freeze(rawPointer),
    pointerOffset: Object.freeze({ x: rawPointer.x - origin.x, y: rawPointer.y - origin.y }),
    snapAnchorOffset: Object.freeze({ x: finite(snapAnchorOffset.x), y: finite(snapAnchorOffset.y) }),
  });
}

export function snapPlacementPoint(pointer, snapAnchorOffset = { x: 0, y: 0 }, gridSize) {
  const offset = { x: finite(snapAnchorOffset.x), y: finite(snapAnchorOffset.y) };
  return Object.freeze({
    x: Math.round(Number(pointer.x) / gridSize) * gridSize - offset.x,
    y: Math.round(Number(pointer.y) / gridSize) * gridSize - offset.y,
  });
}

export function assetPivotWorldPosition(placementPosition, pivotOffset = { x: 0, y: 0 }) {
  return Object.freeze({
    x: Number(placementPosition.x) + finite(pivotOffset.x),
    y: Number(placementPosition.y) + finite(pivotOffset.y),
  });
}

export function assetDepthFromPivot(placementPosition, pivotOffset = { x: 0, y: 0 }, baseDepth = 500) {
  return Number(baseDepth) + Math.round(assetPivotWorldPosition(placementPosition, pivotOffset).y);
}

export function placementMidpointOffset({ placementPosition, pivotOffset, effectiveCollider }) {
  const pivot = assetPivotWorldPosition(placementPosition, pivotOffset);
  const colliderCenter = {
    x: (Number(effectiveCollider.left) + Number(effectiveCollider.right)) / 2,
    y: (Number(effectiveCollider.top) + Number(effectiveCollider.bottom)) / 2,
  };
  return Object.freeze({
    x: (pivot.x + colliderCenter.x) / 2 - Number(placementPosition.x),
    y: (pivot.y + colliderCenter.y) / 2 - Number(placementPosition.y),
  });
}

export function resolvePlacementDrag(state, pointer, gridSize) {
  const desired = {
    x: Number(pointer.x) - state.pointerOffset.x,
    y: Number(pointer.y) - state.pointerOffset.y,
  };
  const anchor = {
    x: desired.x + state.snapAnchorOffset.x,
    y: desired.y + state.snapAnchorOffset.y,
  };
  const snappedAnchor = {
    x: Math.round(anchor.x / gridSize) * gridSize,
    y: Math.round(anchor.y / gridSize) * gridSize,
  };
  return Object.freeze({
    x: snappedAnchor.x - state.snapAnchorOffset.x,
    y: snappedAnchor.y - state.snapAnchorOffset.y,
    anchor: Object.freeze(snappedAnchor),
  });
}
