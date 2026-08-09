export function getColliderResizeHandles(rect) {
  const pixelBounds = getPixelColliderBounds(rect);
  const centerX = Math.round((pixelBounds.left + pixelBounds.right) / 2);
  const centerY = Math.round((pixelBounds.top + pixelBounds.bottom) / 2);
  return [
    { x: pixelBounds.left, y: pixelBounds.top, edges: { left: true, right: false, top: true, bottom: false } },
    { x: centerX, y: pixelBounds.top, edges: { left: false, right: false, top: true, bottom: false } },
    { x: pixelBounds.right, y: pixelBounds.top, edges: { left: false, right: true, top: true, bottom: false } },
    { x: pixelBounds.left, y: centerY, edges: { left: true, right: false, top: false, bottom: false } },
    { x: pixelBounds.right, y: centerY, edges: { left: false, right: true, top: false, bottom: false } },
    { x: pixelBounds.left, y: pixelBounds.bottom, edges: { left: true, right: false, top: false, bottom: true } },
    { x: centerX, y: pixelBounds.bottom, edges: { left: false, right: false, top: false, bottom: true } },
    { x: pixelBounds.right, y: pixelBounds.bottom, edges: { left: false, right: true, top: false, bottom: true } },
  ];
}

export function getColliderResizeEdges(point, rect, tolerance = 3) {
  const handle = getColliderResizeHandles(rect)
    .filter(({ x, y }) => Math.abs(point.x - x) <= tolerance && Math.abs(point.y - y) <= tolerance)
    .sort((left, right) => (
      ((point.x - left.x) ** 2 + (point.y - left.y) ** 2)
      - ((point.x - right.x) ** 2 + (point.y - right.y) ** 2)
    ))[0];
  return handle ? { ...handle.edges } : null;
}

export function resizeColliderDraft(start, edges, delta, minimumSize = 1) {
  const next = { ...start };
  if (edges.left) next.left = Math.min(start.right - minimumSize, start.left + Math.round(delta.x));
  if (edges.right) next.right = Math.max(start.left + minimumSize, start.right + Math.round(delta.x));
  if (edges.top) next.top = Math.min(start.bottom - minimumSize, start.top + Math.round(delta.y));
  if (edges.bottom) next.bottom = Math.max(start.top + minimumSize, start.bottom + Math.round(delta.y));
  return next;
}

export function editRectDraftByArrow(rect, event, {
  minimumSize = 1,
  bounds = null,
} = {}) {
  const direction = {
    ArrowLeft: { axis: "x", amount: -1, outwardEdge: "left", inwardEdge: "right" },
    ArrowRight: { axis: "x", amount: 1, outwardEdge: "right", inwardEdge: "left" },
    ArrowUp: { axis: "y", amount: -1, outwardEdge: "top", inwardEdge: "bottom" },
    ArrowDown: { axis: "y", amount: 1, outwardEdge: "bottom", inwardEdge: "top" },
  }[event?.key];
  if (!direction || (event?.ctrlKey && event?.altKey)) return null;

  const next = { ...rect };
  if (event?.ctrlKey) {
    next[direction.outwardEdge] += direction.amount;
  } else if (event?.altKey) {
    next[direction.inwardEdge] += direction.amount;
  } else if (direction.axis === "x") {
    next.left += direction.amount;
    next.right += direction.amount;
  } else {
    next.top += direction.amount;
    next.bottom += direction.amount;
  }

  if (next.right - next.left < minimumSize || next.bottom - next.top < minimumSize) return { ...rect };
  return constrainRect(next, bounds, !event?.ctrlKey && !event?.altKey);
}

function constrainRect(rect, bounds, preserveSize) {
  if (!bounds) return rect;
  const next = { ...rect };
  if (preserveSize) {
    const width = next.right - next.left;
    const height = next.bottom - next.top;
    if (next.left < bounds.left) {
      next.left = bounds.left;
      next.right = next.left + width;
    }
    if (next.right > bounds.right) {
      next.right = bounds.right;
      next.left = next.right - width;
    }
    if (next.top < bounds.top) {
      next.top = bounds.top;
      next.bottom = next.top + height;
    }
    if (next.bottom > bounds.bottom) {
      next.bottom = bounds.bottom;
      next.top = next.bottom - height;
    }
    return next;
  }
  next.left = Math.max(bounds.left, next.left);
  next.right = Math.min(bounds.right, next.right);
  next.top = Math.max(bounds.top, next.top);
  next.bottom = Math.min(bounds.bottom, next.bottom);
  return next;
}

export function roundColliderDraftToGrid(rect, gridSize, padding = 2) {
  const size = Math.max(1, Number(gridSize) || 1);
  const inset = Math.max(0, Number(padding) || 0);
  const width = Math.max(1, Number(rect.right) - Number(rect.left));
  const height = Math.max(1, Number(rect.bottom) - Number(rect.top));
  const cellsX = Math.max(1, Math.round((width + inset * 2) / size));
  const cellsY = Math.max(1, Math.round((height + inset * 2) / size));
  const spanX = cellsX * size;
  const spanY = cellsY * size;
  const safeInsetX = Math.min(inset, (spanX - 1) / 2);
  const safeInsetY = Math.min(inset, (spanY - 1) / 2);
  const centerX = (Number(rect.left) + Number(rect.right)) / 2;
  const centerY = (Number(rect.top) + Number(rect.bottom)) / 2;
  const startCellX = Math.round(centerX / size - cellsX / 2);
  const startCellY = Math.round(centerY / size - cellsY / 2);
  return {
    left: startCellX * size + safeInsetX,
    right: (startCellX + cellsX) * size - safeInsetX,
    top: startCellY * size + safeInsetY,
    bottom: (startCellY + cellsY) * size - safeInsetY,
  };
}

export function getPixelColliderBounds(rect) {
  const left = Math.round(Number(rect.left));
  const right = Math.max(left, Math.round(Number(rect.right)) - 1);
  const top = Math.round(Number(rect.top));
  const bottom = Math.max(top, Math.round(Number(rect.bottom)) - 1);
  return { left, right, top, bottom };
}
