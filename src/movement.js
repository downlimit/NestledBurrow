import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./worldConfig.js";

export function getFootBox(position, footWidth, footDepth) {
  return { left: position.x - footWidth / 2, right: position.x + footWidth / 2, top: position.y - footDepth, bottom: position.y };
}

export function collides(position, layout, footWidth, footDepth) {
  const box = getFootBox(position, footWidth, footDepth);
  if (box.left < 0 || box.top < 0 || box.right > WORLD_WIDTH || box.bottom > WORLD_HEIGHT) return true;
  const minX = Math.floor(box.left / TILE_SIZE);
  const maxX = Math.floor((box.right - 0.001) / TILE_SIZE);
  const minY = Math.floor(box.top / TILE_SIZE);
  const maxY = Math.floor((box.bottom - 0.001) / TILE_SIZE);
  for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) if (layout.blocked.has(`${x},${y}`)) return true;
  return false;
}

export function moveWithCollision(position, delta, layout, footWidth, footDepth) {
  const next = { ...position };
  const tryX = { x: clamp(position.x + delta.x, footWidth / 2, WORLD_WIDTH - footWidth / 2), y: next.y };
  if (!collides(tryX, layout, footWidth, footDepth)) next.x = tryX.x;
  const tryY = { x: next.x, y: clamp(position.y + delta.y, footDepth, WORLD_HEIGHT) };
  if (!collides(tryY, layout, footWidth, footDepth)) next.y = tryY.y;
  return next;
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
