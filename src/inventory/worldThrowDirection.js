export function facingVector(facing) {
  if (facing === "up") return { x: 0, y: -1 };
  if (facing === "left") return { x: -1, y: 0 };
  if (facing === "right") return { x: 1, y: 0 };
  return { x: 0, y: 1 };
}

export const THROW_ORIGIN_HEIGHT_RATIO = 1 / 3;

export function throwOriginFromPlayer(player) {
  const x = Number(player?.x);
  const y = Number(player?.y);
  const height = Number(player?.displayHeight ?? player?.height ?? 0);
  return {
    x,
    y: y - (Number.isFinite(height) ? height * THROW_ORIGIN_HEIGHT_RATIO : 0),
  };
}

export function throwDirectionTowardPoint(origin, target, fallbackFacing = "down") {
  const fallback = facingVector(fallbackFacing);
  const originX = Number(origin?.x);
  const originY = Number(origin?.y);
  const targetX = Number(target?.x);
  const targetY = Number(target?.y);
  if (![originX, originY, targetX, targetY].every(Number.isFinite)) return fallback;
  const deltaX = targetX - originX;
  const deltaY = targetY - originY;
  const length = Math.hypot(deltaX, deltaY);
  if (length < 0.001) return fallback;
  return { x: deltaX / length, y: deltaY / length };
}

export function worldPointFromPointer(scene, pointer) {
  const pointerX = Number(pointer?.worldX);
  const pointerY = Number(pointer?.worldY);
  if (Number.isFinite(pointerX) && Number.isFinite(pointerY)) return { x: pointerX, y: pointerY };
  const screenX = Number(pointer?.x);
  const screenY = Number(pointer?.y);
  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return null;
  const point = scene.cameras?.main?.getWorldPoint?.(screenX, screenY);
  return Number.isFinite(point?.x) && Number.isFinite(point?.y) ? { x: point.x, y: point.y } : null;
}
