export function getColliderResizeEdges(point, rect, tolerance = 3) {
  const withinX = point.x >= rect.left - tolerance && point.x <= rect.right + tolerance;
  const withinY = point.y >= rect.top - tolerance && point.y <= rect.bottom + tolerance;
  if (!withinX || !withinY) return null;
  const edges = {
    left: Math.abs(point.x - rect.left) <= tolerance,
    right: Math.abs(point.x - rect.right) <= tolerance,
    top: Math.abs(point.y - rect.top) <= tolerance,
    bottom: Math.abs(point.y - rect.bottom) <= tolerance,
  };
  return Object.values(edges).some(Boolean) ? edges : null;
}

export function resizeColliderDraft(start, edges, delta, minimumSize = 1) {
  const next = { ...start };
  if (edges.left) next.left = Math.min(start.right - minimumSize, start.left + Math.round(delta.x));
  if (edges.right) next.right = Math.max(start.left + minimumSize, start.right + Math.round(delta.x));
  if (edges.top) next.top = Math.min(start.bottom - minimumSize, start.top + Math.round(delta.y));
  if (edges.bottom) next.bottom = Math.max(start.top + minimumSize, start.bottom + Math.round(delta.y));
  return next;
}

export function roundColliderDraftToGrid(rect, gridSize, padding = 2) {
  const size = Math.max(1, Number(gridSize) || 1);
  const inset = Math.max(0, Math.min(Number(padding) || 0, (size - 1) / 2));
  return {
    left: Math.floor(Number(rect.left) / size) * size + inset,
    right: Math.ceil(Number(rect.right) / size) * size - inset,
    top: Math.floor(Number(rect.top) / size) * size + inset,
    bottom: Math.ceil(Number(rect.bottom) / size) * size - inset,
  };
}

export function getPixelColliderBounds(rect) {
  const left = Math.round(Number(rect.left));
  const right = Math.max(left, Math.round(Number(rect.right)) - 1);
  const top = Math.round(Number(rect.top));
  const bottom = Math.max(top, Math.round(Number(rect.bottom)) - 1);
  return { left, right, top, bottom };
}
