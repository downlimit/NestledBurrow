import { collides, getFootBox } from "../character/movement.js";

const ORTHOGONAL_COST = 1;
const DIAGONAL_COST = Math.SQRT2;
const DIRECTIONS = Object.freeze([
  [-1, 0, ORTHOGONAL_COST], [1, 0, ORTHOGONAL_COST],
  [0, -1, ORTHOGONAL_COST], [0, 1, ORTHOGONAL_COST],
  [-1, -1, DIAGONAL_COST], [1, -1, DIAGONAL_COST],
  [-1, 1, DIAGONAL_COST], [1, 1, DIAGONAL_COST],
]);

const key = (cell) => `${cell.x},${cell.y}`;

export function createActorNavigation(environment, { cellSize = 16, footWidth, footDepth }) {
  const bounds = environment?.bounds;
  if (!bounds || typeof environment.isBlockedBox !== "function") {
    throw new Error("Actor walkability requires bounds and isBlockedBox");
  }
  const isWorldWalkable = (position) => {
    const box = getFootBox(position, footWidth, footDepth);
    return box.left >= bounds.left && box.right <= bounds.right
      && box.top >= bounds.top && box.bottom <= bounds.bottom
      && !collides(position, environment, footWidth, footDepth);
  };
  const isWalkable = (cell) => {
    const position = cellToWorld(cell, bounds, cellSize);
    return isWorldWalkable(position);
  };
  const canTraverseWorld = (from, to) => {
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const sampleSpacing = Math.max(1, Math.min(cellSize / 4, Number(environment.cellSize) / 2 || cellSize / 4));
    const steps = Math.max(1, Math.ceil(distance / sampleSpacing));
    for (let index = 1; index <= steps; index += 1) {
      const fraction = index / steps;
      if (!isWorldWalkable({
        x: from.x + (to.x - from.x) * fraction,
        y: from.y + (to.y - from.y) * fraction,
      })) return false;
    }
    return true;
  };
  const canTraverse = (fromCell, toCell) => canTraverseWorld(
    cellToWorld(fromCell, bounds, cellSize),
    cellToWorld(toCell, bounds, cellSize),
  );
  return { isWalkable, canTraverse, isWorldWalkable, canTraverseWorld };
}

export function createActorWalkability(environment, options) {
  return createActorNavigation(environment, options).isWalkable;
}

export function findGridPath({ start, goal, bounds, cellSize = 16, isWalkable, canTraverse = () => true }) {
  if (typeof isWalkable !== "function") throw new Error("Grid pathfinder requires isWalkable(cell)");
  const rawStartCell = worldToCell(start, bounds, cellSize);
  const goalCell = worldToCell(goal, bounds, cellSize);
  const startCells = findWalkableStartCells(rawStartCell, bounds, cellSize, isWalkable);
  if (startCells.length === 0 || !isCellInBounds(goalCell, bounds, cellSize) || !isWalkable(goalCell)) return null;
  for (const startCell of startCells) {
    const path = searchGridPath(startCell, goalCell, bounds, cellSize, isWalkable, canTraverse);
    if (path) return path;
  }
  return null;
}

function searchGridPath(startCell, goalCell, bounds, cellSize, isWalkable, canTraverse) {
  const open = [{ cell: startCell, g: 0, f: heuristic(startCell, goalCell) }];
  const best = new Map([[key(startCell), 0]]);
  const parent = new Map();

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.cell.y - b.cell.y || a.cell.x - b.cell.x);
    const current = open.shift();
    if (current.g !== best.get(key(current.cell))) continue;
    if (current.cell.x === goalCell.x && current.cell.y === goalCell.y) {
      return reconstruct(parent, current.cell).slice(1).map((cell) => cellToWorld(cell, bounds, cellSize));
    }

    for (const [dx, dy, cost] of DIRECTIONS) {
      const next = { x: current.cell.x + dx, y: current.cell.y + dy };
      if (!isCellInBounds(next, bounds, cellSize) || !isWalkable(next)) continue;
      if (!canTraverse(current.cell, next)) continue;
      if (dx !== 0 && dy !== 0
        && (!isCellInBounds({ x: current.cell.x + dx, y: current.cell.y }, bounds, cellSize)
          || !isCellInBounds({ x: current.cell.x, y: current.cell.y + dy }, bounds, cellSize)
          || !isWalkable({ x: current.cell.x + dx, y: current.cell.y })
          || !isWalkable({ x: current.cell.x, y: current.cell.y + dy }))) continue;
      const nextG = current.g + cost;
      if (nextG >= (best.get(key(next)) ?? Number.POSITIVE_INFINITY)) continue;
      best.set(key(next), nextG);
      parent.set(key(next), current.cell);
      open.push({ cell: next, g: nextG, f: nextG + heuristic(next, goalCell) });
    }
  }
  return null;
}

function findWalkableStartCells(origin, bounds, cellSize, isWalkable) {
  if (isCellInBounds(origin, bounds, cellSize) && isWalkable(origin)) return [origin];
  const matches = [];
  for (let radius = 1; radius <= 3; radius += 1) {
    const candidates = [];
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
        candidates.push({ x: origin.x + x, y: origin.y + y });
      }
    }
    candidates.sort((a, b) => (
      Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y)
      || a.y - b.y || a.x - b.x
    ));
    matches.push(...candidates.filter((cell) => isCellInBounds(cell, bounds, cellSize) && isWalkable(cell)));
    if (matches.length > 0) return matches;
  }
  return matches;
}

function isCellInBounds(cell, bounds, cellSize) {
  const point = cellToWorld(cell, bounds, cellSize);
  return point.x >= bounds.left && point.x < bounds.right && point.y > bounds.top && point.y <= bounds.bottom;
}

function worldToCell(point, bounds, cellSize) {
  return {
    x: Math.floor((point.x - bounds.left) / cellSize),
    y: Math.floor((point.y - bounds.top) / cellSize),
  };
}

function cellToWorld(cell, bounds, cellSize) {
  return {
    x: bounds.left + cell.x * cellSize + cellSize / 2,
    y: bounds.top + cell.y * cellSize + cellSize - 2,
  };
}

function heuristic(a, b) {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return Math.max(dx, dy) + (DIAGONAL_COST - 1) * Math.min(dx, dy);
}

function reconstruct(parent, goal) {
  const result = [goal];
  let cursor = goal;
  while (parent.has(key(cursor))) {
    cursor = parent.get(key(cursor));
    result.push(cursor);
  }
  return result.reverse();
}
