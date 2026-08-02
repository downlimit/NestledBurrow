import { createGridCollisionEnvironment } from "./collisionEnvironment.js";
import {
  DOOR_LEFT,
  DOOR_Y,
  HOUSE,
  HOUSE_FRAMES,
  OUTDOOR_FRAMES,
  TILE_SIZE,
  WORLD_COLUMNS,
  WORLD_ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "./worldConfig.js";
import { PLACEMENT_CELL_SIZE } from "../resources/resourceConfig.js";
import { applyColliderOffsets, wallColliderGroup } from "../build/buildWorldGeometry.js";
import { createNestWorldLayout } from "./nestWorldLayout.js";
import { WORLD_IDS } from "./worldLocationConfig.js";

function blockTile(blocked, tileX, tileY) {
  for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) blocked.add(cellKey(tileX * 2 + x, tileY * 2 + y));
}

function edgeId(side, index) {
  return `house-wall-${side}-${index}`;
}

function createHouseGeometry() {
  const footprint = Object.freeze({
    left: HOUSE.x * TILE_SIZE,
    top: HOUSE.y * TILE_SIZE,
    right: (HOUSE.x + HOUSE.columns) * TILE_SIZE,
    bottom: (HOUSE.y + HOUSE.rows) * TILE_SIZE,
  });
  const doorway = Object.freeze({
    edge: "bottom",
    left: DOOR_LEFT * TILE_SIZE,
    right: (DOOR_LEFT + HOUSE.doorWidth) * TILE_SIZE,
    centerX: (DOOR_LEFT + HOUSE.doorWidth / 2) * TILE_SIZE,
  });
  const wallEdges = [];
  for (let index = 0; index < HOUSE.columns; index += 1) {
    wallEdges.push(Object.freeze({ id: edgeId("top", index), side: "top", index, x: footprint.left + index * TILE_SIZE, y: footprint.top }));
    if (index < DOOR_LEFT - HOUSE.x || index >= DOOR_LEFT - HOUSE.x + HOUSE.doorWidth) {
      wallEdges.push(Object.freeze({ id: edgeId("bottom", index), side: "bottom", index, x: footprint.left + index * TILE_SIZE, y: footprint.bottom }));
    }
  }
  for (let index = 0; index < HOUSE.rows; index += 1) {
    wallEdges.push(Object.freeze({ id: edgeId("left", index), side: "left", index, x: footprint.left, y: footprint.top + index * TILE_SIZE }));
    wallEdges.push(Object.freeze({ id: edgeId("right", index), side: "right", index, x: footprint.right, y: footprint.top + index * TILE_SIZE }));
  }

  return Object.freeze({ footprint, doorway, wallEdges: Object.freeze(wallEdges) });
}

function createWallRenderDescriptors(geometry) {
  const edgeById = new Map(geometry.wallEdges.map((edge) => [edge.id, edge]));
  const doorStart = DOOR_LEFT - HOUSE.x;
  const doorEnd = doorStart + HOUSE.doorWidth;
  const descriptors = [];
  const add = (edge, frame, worldX, worldY, extraEdgeIds = [], supplements = []) => descriptors.push(Object.freeze({
    id: `render-${edge.id}`,
    edgeIds: Object.freeze([edge.id, ...extraEdgeIds]),
    supplements: Object.freeze(supplements.map((supplement) => Object.freeze(supplement))),
    ...edge,
    orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
    worldX,
    worldY,
    frame,
  }));

  for (let index = 0; index < HOUSE.columns; index += 1) {
    const top = edgeById.get(edgeId("top", index));
    const topExtra = index === 0
      ? [edgeId("left", 0)]
      : index === HOUSE.columns - 1 ? [edgeId("right", 0)] : [];
    const topFrame = index === 0
      ? HOUSE_FRAMES.topLeft
      : index === HOUSE.columns - 1 ? HOUSE_FRAMES.topRight : HOUSE_FRAMES.top;
    const topWorldX = index === 0
      ? top.x - TILE_SIZE / 2
      : index === HOUSE.columns - 1 ? top.x + TILE_SIZE / 2 : top.x;
    const topSupplements = index === 0
      ? [{ frame: HOUSE_FRAMES.top, cropX: TILE_SIZE / 2, cropWidth: TILE_SIZE / 2, worldX: top.x, worldY: geometry.footprint.top }]
      : index === HOUSE.columns - 1
        ? [{ frame: HOUSE_FRAMES.top, cropX: 0, cropWidth: TILE_SIZE / 2, worldX: top.x, worldY: geometry.footprint.top }]
        : [];
    add(top, topFrame, topWorldX, geometry.footprint.top, topExtra, topSupplements);

    const bottom = edgeById.get(edgeId("bottom", index));
    if (!bottom) continue;
    const bottomExtra = index === 0
      ? [edgeId("left", HOUSE.rows - 1)]
      : index === HOUSE.columns - 1 ? [edgeId("right", HOUSE.rows - 1)] : [];
    const bottomFrame = index === 0 || index === doorEnd
      ? HOUSE_FRAMES.bottomLeft
      : index === HOUSE.columns - 1 || index === doorStart - 1
        ? HOUSE_FRAMES.bottomRight
        : HOUSE_FRAMES.bottom;
    const bottomWorldX = index === 0 || index === doorEnd
      ? bottom.x - TILE_SIZE / 2
      : index === HOUSE.columns - 1 || index === doorStart - 1
        ? bottom.x + TILE_SIZE / 2
        : bottom.x;
    const bottomSupplements = index === 0 || index === doorEnd
      ? [{ frame: HOUSE_FRAMES.bottom, cropX: TILE_SIZE / 2, cropWidth: TILE_SIZE / 2, worldX: bottom.x, worldY: geometry.footprint.bottom - TILE_SIZE }]
      : index === HOUSE.columns - 1 || index === doorStart - 1
        ? [{ frame: HOUSE_FRAMES.bottom, cropX: 0, cropWidth: TILE_SIZE / 2, worldX: bottom.x, worldY: geometry.footprint.bottom - TILE_SIZE }]
        : [];
    add(bottom, bottomFrame, bottomWorldX, geometry.footprint.bottom - TILE_SIZE, bottomExtra, bottomSupplements);
  }

  for (let index = 1; index < HOUSE.rows - 1; index += 1) {
    const left = edgeById.get(edgeId("left", index));
    const right = edgeById.get(edgeId("right", index));
    add(left, HOUSE_FRAMES.wallLeftCap, geometry.footprint.left - TILE_SIZE / 2, left.y);
    add(right, HOUSE_FRAMES.wallRightCap, geometry.footprint.right - TILE_SIZE / 2, right.y);
  }

  return Object.freeze(descriptors);
}

function wallCollider(edge) {
  const horizontal = edge.side === "top" || edge.side === "bottom";
  return horizontal
    ? Object.freeze({ left: edge.x, right: edge.x + TILE_SIZE, top: edge.y - 2, bottom: edge.y + 2 })
    : Object.freeze({ left: edge.x - 2, right: edge.x + 2, top: edge.y, bottom: edge.y + TILE_SIZE });
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function getGrassFrame(x, y) {
  const hash = (Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)) >>> 0;
  const detailFrames = OUTDOOR_FRAMES.grassDetails;

  return hash % 131 < detailFrames.length
    ? detailFrames[hash % detailFrames.length]
    : OUTDOOR_FRAMES.grass;
}

export function createWorldLayout(worldId = WORLD_IDS.village) {
  if (worldId === WORLD_IDS.nest) return createNestWorldLayout();
  if (worldId !== WORLD_IDS.village) throw new Error(`Unknown world layout: ${String(worldId)}`);
  const groundTiles = [];
  const houseFloorTiles = [];
  const houseWallTiles = [];
  const decorationTiles = [];
  const blocked = new Set();
  const resourceColliders = new Map();
  const baseResourceColliders = new Map();
  const resourceColliderGroups = new Map();
  const resourceColliderMetadata = new Map();
  const colliderOverrides = new Map();
  const houseGeometry = createHouseGeometry();
  const originalWallEdges = new Map(houseGeometry.wallEdges.map((edge) => [edge.id, edge]));
  const wallEdges = new Map(houseGeometry.wallEdges.map((edge) => [edge.id, edge]));
  const wallColliders = new Map(houseGeometry.wallEdges.map((edge) => {
    const base = wallCollider(edge);
    return [edge.id, {
      rect: base,
      base,
      edgeIds: [edge.id],
      groupKey: wallColliderGroup(edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical"),
      wallEdge: {
        x: edge.x,
        y: edge.y,
        orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
      },
    }];
  }));

  for (let y = 0; y < WORLD_ROWS; y += 1) {
    for (let x = 0; x < WORLD_COLUMNS; x += 1) {
      groundTiles.push({ x, y, frame: getGrassFrame(x, y) });
    }
  }

  const pathLeft = houseGeometry.doorway.left / TILE_SIZE;
  for (let y = DOOR_Y; y < WORLD_ROWS; y += 1) {
    const frames = y === DOOR_Y ? OUTDOOR_FRAMES.pathTop : OUTDOOR_FRAMES.pathMiddle;
    for (let column = 0; column < 3; column += 1) {
      groundTiles.push({ x: pathLeft + column, y, frame: frames[column] });
    }
  }

  for (let y = HOUSE.y; y < HOUSE.y + HOUSE.rows; y += 1) {
    for (let x = HOUSE.x; x < HOUSE.x + HOUSE.columns; x += 1) {
      houseFloorTiles.push({ x, y, frame: HOUSE_FRAMES.floor });
    }
  }

  houseWallTiles.push(...createWallRenderDescriptors(houseGeometry));

  const environment = createGridCollisionEnvironment({
    bounds: { left: 0, top: 0, right: WORLD_WIDTH, bottom: WORLD_HEIGHT },
    cellSize: PLACEMENT_CELL_SIZE,
    isBlockedCell: (x, y) => blocked.has(cellKey(x, y)),
    isBlockedBox: (box) => (
      [...wallColliders.values()].some(({ rect }) => overlaps(box, rect))
      || [...resourceColliders.values()].some((rect) => overlaps(box, rect))
    ),
  });

  return {
    ...environment,
    groundTiles,
    houseFloorTiles,
    houseWallTiles,
    decorationTiles,
    blocked,
    houseFootprint: houseGeometry.footprint,
    wallEdges: houseGeometry.wallEdges,
    get wallColliders() { return [...wallColliders.values()].map(({ rect }) => rect); },
    get objectColliders() { return [...resourceColliders.values()]; },
    getWorldObjectColliders() {
      return [
        ...[...wallColliders].map(([id, entry]) => ({ id, ...entry })),
        ...[...resourceColliders].map(([id, rect]) => ({
          id,
          groupKey: resourceColliderGroups.get(id) ?? id,
          rect,
          base: baseResourceColliders.get(id) ?? rect,
          ...(resourceColliderMetadata.get(id) ?? {}),
        })),
      ];
    },
    getBlockingColliders(box) {
      return [
        ...[...wallColliders].map(([id, entry]) => ({ id, ...entry })),
        ...[...resourceColliders].map(([id, rect]) => ({
          id,
          groupKey: resourceColliderGroups.get(id) ?? id,
          rect,
          ...(resourceColliderMetadata.get(id) ?? {}),
        })),
      ].filter((entry) => overlaps(box, entry.rect));
    },
    doorway: houseGeometry.doorway,
    getSurfaceAt(point) {
      const tileX = Math.floor(Number(point.x) / TILE_SIZE);
      const tileY = Math.floor(Number(point.y) / TILE_SIZE);
      if (tileX >= HOUSE.x && tileX < HOUSE.x + HOUSE.columns
        && tileY >= HOUSE.y && tileY < HOUSE.y + HOUSE.rows) return "house-floor";
      if (tileY >= DOOR_Y && tileX >= pathLeft && tileX < pathLeft + 3) return "path";
      return "grass";
    },
    isFarmableTile(point) {
      const x = Number(point.x);
      const y = Number(point.y);
      return Number.isFinite(x) && Number.isFinite(y)
        && x >= 0 && y >= 0 && x + TILE_SIZE <= WORLD_WIDTH && y + TILE_SIZE <= WORLD_HEIGHT
        && this.getSurfaceAt(point) === "grass";
    },
    getEffectiveCollider(rect, groupKey = null) {
      return applyColliderOffsets(rect, colliderOverrides.get(groupKey));
    },
    setResourceCollider(id, rect, groupKey = id, metadata = null) {
      const base = Object.freeze({ ...rect });
      baseResourceColliders.set(id, base);
      resourceColliderGroups.set(id, groupKey);
      if (metadata) resourceColliderMetadata.set(id, Object.freeze({ ...metadata }));
      else resourceColliderMetadata.delete(id);
      resourceColliders.set(id, applyColliderOffsets(base, colliderOverrides.get(groupKey)));
    },
    clearResourceCollider(id) { baseResourceColliders.delete(id); resourceColliderGroups.delete(id); resourceColliderMetadata.delete(id); resourceColliders.delete(id); },
    getResourceCollider(id) { return resourceColliders.get(id) ?? null; },
    setWorldObjectCollider(id, rect, groupKey = id, metadata = null) { this.setResourceCollider(id, rect, groupKey, metadata); },
    clearWorldObjectCollider(id) { this.clearResourceCollider(id); },
    setColliderOverride(groupKey, offsets) {
      const normalized = Object.freeze({
        left: Number(offsets?.left) || 0,
        right: Number(offsets?.right) || 0,
        top: Number(offsets?.top) || 0,
        bottom: Number(offsets?.bottom) || 0,
      });
      colliderOverrides.set(groupKey, normalized);
      for (const entry of wallColliders.values()) {
        if (entry.groupKey === groupKey) entry.rect = applyColliderOffsets(entry.base, normalized);
      }
      for (const [id, base] of baseResourceColliders) {
        if (resourceColliderGroups.get(id) === groupKey) {
          resourceColliders.set(id, applyColliderOffsets(base, normalized));
        }
      }
    },
    removeWallEdges(ids) {
      const removed = new Set(ids);
      for (const id of ids) {
        wallEdges.delete(id);
      }
      for (const [id, entry] of wallColliders) {
        if (entry.edgeIds.some((edgeId) => removed.has(edgeId))) wallColliders.delete(id);
      }
    },
    restoreWallEdges(ids) {
      for (const id of ids) {
        const edge = originalWallEdges.get(id);
        if (!edge) continue;
        wallEdges.set(id, edge);
        const base = wallCollider(edge);
        const groupKey = wallColliderGroup(edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical");
        wallColliders.set(id, {
          rect: applyColliderOffsets(base, colliderOverrides.get(groupKey)),
          base,
          edgeIds: [id],
          groupKey,
          wallEdge: {
            x: edge.x,
            y: edge.y,
            orientation: edge.side === "top" || edge.side === "bottom" ? "horizontal" : "vertical",
          },
        });
      }
    },
    hasWallEdge(id) { return wallEdges.has(id); },
    spawn: {
      x: houseGeometry.doorway.centerX,
      y: houseGeometry.footprint.bottom - 3 * TILE_SIZE,
    },
    outdoorTarget: {
      x: houseGeometry.doorway.centerX,
      y: (DOOR_Y + 7) * TILE_SIZE + TILE_SIZE - 2,
    },
  };
}

export function cellKey(x, y) {
  return `${x},${y}`;
}

export function isBlockedCell(layout, x, y) {
  return layout.blocked.has(cellKey(x, y));
}
