import { applyColliderOffsets } from "./buildWorldGeometry.js";
import { createGridCollisionEnvironment } from "./collisionEnvironment.js";
import { PLACEMENT_CELL_SIZE } from "./resourceConfig.js";
import { NEST_ISLAND_MODEL, WORLD_IDS } from "./worldLocationConfig.js";
import { OUTDOOR_FRAMES, TILE_SIZE } from "./worldConfig.js";

export function createNestWorldLayout() {
  const { columns, rows, ellipse, transportClearance, deadEndTiles } = NEST_ISLAND_MODEL;
  const groundTiles = [];
  const blocked = new Set();
  const islandTiles = new Set();
  const deadEndKeys = new Set(deadEndTiles.map(({ x, y }) => tileKey(x, y)));

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      if (insideEllipse(x, y, ellipse)) islandTiles.add(tileKey(x, y));
    }
  }

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const key = tileKey(x, y);
      if (!islandTiles.has(key)) {
        blockTile(blocked, x, y);
        continue;
      }
      const edge = isIslandEdge(islandTiles, x, y);
      const transportCell = containsTile(transportClearance, x, y);
      const deadEnd = deadEndKeys.has(key);
      const frame = deadEnd
        ? OUTDOOR_FRAMES.islandCliff.top
        : edge ? islandCliffFrame(x, y, ellipse) : grassFrame(x, y);
      groundTiles.push({ x, y, frame, terrain: deadEnd ? "dead-end" : edge ? "cliff" : "grass" });
      if ((edge && !transportCell) || deadEnd) blockTile(blocked, x, y);
    }
  }

  const bounds = Object.freeze({ left: 0, top: 0, right: columns * TILE_SIZE, bottom: rows * TILE_SIZE });
  const layout = createDynamicLayout({ bounds, blocked });
  return {
    ...layout,
    locationId: WORLD_IDS.nest,
    columns,
    rows,
    groundTiles,
    houseFloorTiles: [],
    houseWallTiles: [],
    decorationTiles: [],
    blocked,
    wallEdges: [],
    wallColliders: [],
    houseFootprint: null,
    doorway: null,
    spawn: { x: 11 * TILE_SIZE, y: 13 * TILE_SIZE - 8 },
    outdoorTarget: { x: 11 * TILE_SIZE, y: 5 * TILE_SIZE },
    getSurfaceAt(point) {
      const x = Math.floor(Number(point.x) / TILE_SIZE);
      const y = Math.floor(Number(point.y) / TILE_SIZE);
      const tile = groundTiles.find((entry) => entry.x === x && entry.y === y);
      return tile?.terrain ?? "void";
    },
    isFarmableTile() { return false; },
    removeWallEdges() {},
    restoreWallEdges() {},
    hasWallEdge() { return false; },
  };
}

function createDynamicLayout({ bounds, blocked }) {
  const colliders = new Map();
  const baseColliders = new Map();
  const colliderGroups = new Map();
  const colliderMetadata = new Map();
  const colliderOverrides = new Map();
  const environment = createGridCollisionEnvironment({
    bounds,
    cellSize: PLACEMENT_CELL_SIZE,
    isBlockedCell: (x, y) => blocked.has(cellKey(x, y)),
    isBlockedBox: (box) => [...colliders.values()].some((rect) => overlaps(box, rect)),
  });

  return {
    ...environment,
    bounds,
    get objectColliders() { return [...colliders.values()]; },
    getWorldObjectColliders() {
      return [...colliders].map(([id, rect]) => ({
        id,
        groupKey: colliderGroups.get(id) ?? id,
        rect,
        base: baseColliders.get(id) ?? rect,
        ...(colliderMetadata.get(id) ?? {}),
      }));
    },
    getBlockingColliders(box) {
      return this.getWorldObjectColliders().filter((entry) => overlaps(box, entry.rect));
    },
    getEffectiveCollider(rect, groupKey = null) {
      return applyColliderOffsets(rect, colliderOverrides.get(groupKey));
    },
    setResourceCollider(id, rect, groupKey = id, metadata = null) {
      const base = Object.freeze({ ...rect });
      baseColliders.set(id, base);
      colliderGroups.set(id, groupKey);
      if (metadata) colliderMetadata.set(id, Object.freeze({ ...metadata }));
      else colliderMetadata.delete(id);
      colliders.set(id, applyColliderOffsets(base, colliderOverrides.get(groupKey)));
    },
    clearResourceCollider(id) {
      baseColliders.delete(id);
      colliderGroups.delete(id);
      colliderMetadata.delete(id);
      colliders.delete(id);
    },
    getResourceCollider(id) { return colliders.get(id) ?? null; },
    setWorldObjectCollider(id, rect, groupKey = id, metadata = null) {
      this.setResourceCollider(id, rect, groupKey, metadata);
    },
    clearWorldObjectCollider(id) { this.clearResourceCollider(id); },
    setColliderOverride(groupKey, offsets) {
      const normalized = Object.freeze({
        left: Number(offsets?.left) || 0,
        right: Number(offsets?.right) || 0,
        top: Number(offsets?.top) || 0,
        bottom: Number(offsets?.bottom) || 0,
      });
      colliderOverrides.set(groupKey, normalized);
      for (const [id, base] of baseColliders) {
        if (colliderGroups.get(id) === groupKey) colliders.set(id, applyColliderOffsets(base, normalized));
      }
    },
  };
}

function insideEllipse(x, y, ellipse) {
  const dx = (x - ellipse.centerX) / ellipse.radiusX;
  const dy = (y - ellipse.centerY) / ellipse.radiusY;
  return dx * dx + dy * dy <= 1;
}

function isIslandEdge(cells, x, y) {
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => !cells.has(tileKey(x + dx, y + dy)));
}

function islandCliffFrame(x, y, ellipse) {
  const dx = (x - ellipse.centerX) / ellipse.radiusX;
  const dy = (y - ellipse.centerY) / ellipse.radiusY;
  const horizontal = Math.abs(dx);
  const vertical = Math.abs(dy);
  if (horizontal > vertical * 1.55) return dx < 0 ? OUTDOOR_FRAMES.islandCliff.left : OUTDOOR_FRAMES.islandCliff.right;
  if (vertical > horizontal * 1.55) return dy < 0 ? OUTDOOR_FRAMES.islandCliff.top : OUTDOOR_FRAMES.islandCliff.bottom;
  if (dy < 0) return dx < 0 ? OUTDOOR_FRAMES.islandCliff.topLeft : OUTDOOR_FRAMES.islandCliff.topRight;
  return dx < 0 ? OUTDOOR_FRAMES.islandCliff.bottomLeft : OUTDOOR_FRAMES.islandCliff.bottomRight;
}

function grassFrame(x, y) {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return hash % 131 < OUTDOOR_FRAMES.grassDetails.length
    ? OUTDOOR_FRAMES.grassDetails[hash % OUTDOOR_FRAMES.grassDetails.length]
    : OUTDOOR_FRAMES.grass;
}

function blockTile(blocked, tileX, tileY) {
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) blocked.add(cellKey(tileX * 2 + x, tileY * 2 + y));
  }
}

function containsTile(bounds, x, y) {
  return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function cellKey(x, y) {
  return `${x},${y}`;
}
