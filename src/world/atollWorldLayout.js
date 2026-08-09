import { applyColliderOffsets } from "../build/buildWorldGeometry.js";
import { PLACEMENT_CELL_SIZE } from "../resources/resourceConfig.js";
import { createGridCollisionEnvironment } from "./collisionEnvironment.js";
import { OUTDOOR_FRAMES, TILE_SIZE } from "./worldConfig.js";
import { ATOLL_WORLD_MODEL, WORLD_IDS } from "./worldLocationConfig.js";

export function createAtollWorldLayout() {
  const { columns, rows, spawn } = ATOLL_WORLD_MODEL;
  const groundTiles = [];
  const blocked = new Set();

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      groundTiles.push({ x, y, frame: grassFrame(x, y), terrain: "grass" });
      if (x === 0 || y === 0 || x === columns - 1 || y === rows - 1) blockTile(blocked, x, y);
    }
  }

  const bounds = Object.freeze({ left: 0, top: 0, right: columns * TILE_SIZE, bottom: rows * TILE_SIZE });
  const layout = createDynamicLayout({ bounds, blocked });
  return {
    ...layout,
    locationId: WORLD_IDS.atoll,
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
    spawn: { ...spawn },
    outdoorTarget: { ...spawn },
    getSurfaceAt() { return "grass"; },
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
    isBlockedBox: (box) => [...colliders].some(([id, rect]) => (
      colliderMetadata.get(id)?.collisionEnabled !== false && overlaps(box, rect)
    )),
  });

  return {
    ...environment,
    bounds,
    get objectColliders() {
      return [...colliders]
        .filter(([id]) => colliderMetadata.get(id)?.collisionEnabled !== false)
        .map(([, rect]) => rect);
    },
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
      return this.getWorldObjectColliders()
        .filter((entry) => entry.collisionEnabled !== false && overlaps(box, entry.rect));
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

function grassFrame(x, y) {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  return hash % 127 < OUTDOOR_FRAMES.grassDetails.length
    ? OUTDOOR_FRAMES.grassDetails[hash % OUTDOOR_FRAMES.grassDetails.length]
    : OUTDOOR_FRAMES.grass;
}

function blockTile(blocked, tileX, tileY) {
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 2; x += 1) blocked.add(cellKey(tileX * 2 + x, tileY * 2 + y));
  }
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function cellKey(x, y) {
  return `${x},${y}`;
}
