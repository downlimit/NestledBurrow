export function createGridCollisionEnvironment({ bounds, cellSize, isBlockedCell, blockedCells } = {}) {
  validateBounds(bounds);
  validateCellSize(cellSize);

  const blockingQuery = resolveBlockingQuery({ isBlockedCell, blockedCells });

  return {
    bounds: Object.freeze({
      left: bounds.left,
      top: bounds.top,
      right: bounds.right,
      bottom: bounds.bottom,
    }),
    cellSize,
    isBlockedCell: blockingQuery,
  };
}

export function validateCollisionEnvironment(environment) {
  if (!environment || typeof environment !== "object") {
    throw new Error("Collision environment must be an object");
  }

  validateBounds(environment.bounds);
  validateCellSize(environment.cellSize);

  if (typeof environment.isBlockedCell !== "function") {
    throw new Error("Collision environment requires callable isBlockedCell(x, y)");
  }

  return environment;
}

function resolveBlockingQuery({ isBlockedCell, blockedCells }) {
  if (isBlockedCell !== undefined && typeof isBlockedCell !== "function") {
    throw new Error("Collision environment requires callable isBlockedCell(x, y)");
  }

  if (typeof isBlockedCell === "function") return isBlockedCell;

  if (blockedCells && typeof blockedCells.has === "function") {
    return (x, y) => blockedCells.has(cellKey(x, y));
  }

  throw new Error("Collision environment requires callable isBlockedCell(x, y)");
}

function validateBounds(bounds) {
  if (!bounds || typeof bounds !== "object") {
    throw new Error("Collision environment requires bounds");
  }

  for (const side of ["left", "top", "right", "bottom"]) {
    if (!Number.isFinite(bounds[side])) {
      throw new Error(`Collision environment bounds.${side} must be finite`);
    }
  }

  if (bounds.right <= bounds.left) {
    throw new Error("Collision environment bounds.right must be greater than bounds.left");
  }

  if (bounds.bottom <= bounds.top) {
    throw new Error("Collision environment bounds.bottom must be greater than bounds.top");
  }
}

function validateCellSize(cellSize) {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    throw new Error("Collision environment cellSize must be finite and positive");
  }
}

function cellKey(x, y) {
  return `${x},${y}`;
}
