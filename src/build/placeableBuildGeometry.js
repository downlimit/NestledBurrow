import { placementMidpointOffset } from "./buildWorldGeometry.js";
import { PLACEMENT_CELL_SIZE } from "../resources/resourceConfig.js";
import { TILE_SIZE } from "../world/worldConfig.js";

export function resourceVisualBoundsAt(point, profile) {
  if (profile?.visual === "tree") {
    return Object.freeze({
      left: point.x,
      right: point.x + 3 * TILE_SIZE,
      top: point.y,
      bottom: point.y + 4 * TILE_SIZE,
    });
  }
  const width = Math.max(1, Number(profile?.footprint?.width) || 1) * PLACEMENT_CELL_SIZE;
  const height = Math.max(1, Number(profile?.footprint?.height) || 1) * PLACEMENT_CELL_SIZE;
  return Object.freeze({ left: point.x, right: point.x + width, top: point.y, bottom: point.y + height });
}

export function resourceColliderAt(point, profile) {
  const base = profile?.collisionRect ?? {
    left: 0,
    top: 0,
    right: Math.max(1, Number(profile?.footprint?.width) || 1) * PLACEMENT_CELL_SIZE,
    bottom: Math.max(1, Number(profile?.footprint?.height) || 1) * PLACEMENT_CELL_SIZE,
  };
  return Object.freeze({
    left: point.x + base.left + (profile?.collisionLeftInset ?? 0),
    right: point.x + base.right - (profile?.collisionRightInset ?? 0),
    top: point.y + base.top + (profile?.collisionTopInset ?? 0),
    bottom: point.y + base.bottom,
  });
}

export function midpointAnchor(scene, profileKey, baseCollider, fallbackPivot = { x: 0, y: 0 }) {
  return placementMidpointOffset({
    placementPosition: { x: 0, y: 0 },
    pivotOffset: scene.assetProfiles?.[profileKey]?.snapAnchorOffset ?? fallbackPivot,
    effectiveCollider: effectiveCollider(scene, baseCollider, profileKey),
  });
}

export function defaultResourceAnchor(profile) {
  return profile.visual === "tree"
    ? { x: TILE_SIZE * 1.5, y: TILE_SIZE * 4 }
    : {
        x: profile.footprint.width * PLACEMENT_CELL_SIZE / 2,
        y: profile.footprint.height * PLACEMENT_CELL_SIZE / 2,
      };
}

export function effectiveCollider(scene, base, profileKey) {
  return scene.worldLayout?.getEffectiveCollider?.(base, profileKey) ?? base;
}

export function registeredCollider(scene, id, fallback, profileKey) {
  return scene.worldLayout?.getWorldObjectColliders?.().find((entry) => entry.id === id)?.rect
    ?? effectiveCollider(scene, fallback, profileKey);
}

export function isBlocked(scene, rect, ignoreId = null) {
  const blockers = scene.worldLayout?.getBlockingColliders?.(rect);
  if (Array.isArray(blockers)) return blockers.some(({ id }) => id !== ignoreId);
  return Boolean(scene.worldLayout?.isBlockedBox?.(rect));
}

export function precisePoint(point) {
  return {
    x: Number(point?.rawX ?? point?.x),
    y: Number(point?.rawY ?? point?.y),
  };
}

export function shiftRect(rect, offset = {}) {
  const x = Number(offset?.x) || 0;
  const y = Number(offset?.y) || 0;
  return {
    left: rect.left + x,
    right: rect.right + x,
    top: rect.top + y,
    bottom: rect.bottom + y,
  };
}

export function unionRect(first, second) {
  if (!first) return second ? { ...second } : null;
  if (!second) return { ...first };
  return {
    left: Math.min(first.left, second.left),
    right: Math.max(first.right, second.right),
    top: Math.min(first.top, second.top),
    bottom: Math.max(first.bottom, second.bottom),
  };
}

export function contains(bounds, point) {
  return Boolean(bounds)
    && Number(point.x) >= bounds.left && Number(point.x) < bounds.right
    && Number(point.y) >= bounds.top && Number(point.y) < bounds.bottom;
}
