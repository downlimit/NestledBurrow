import { TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "./worldConfig.js";

const MAX_COLLISION_STEP = TILE_SIZE / 4;

export function getFootBox(position, footWidth, footDepth) {
  return {
    left: position.x - footWidth / 2,
    right: position.x + footWidth / 2,
    top: position.y - footDepth,
    bottom: position.y,
  };
}

export function collides(position, layout, footWidth, footDepth) {
  const box = getFootBox(position, footWidth, footDepth);

  if (
    box.left < 0 ||
    box.top < 0 ||
    box.right > WORLD_WIDTH ||
    box.bottom > WORLD_HEIGHT
  ) {
    return true;
  }

  const minX = Math.floor(box.left / TILE_SIZE);
  const maxX = Math.floor((box.right - 0.001) / TILE_SIZE);
  const minY = Math.floor(box.top / TILE_SIZE);
  const maxY = Math.floor((box.bottom - 0.001) / TILE_SIZE);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (layout.blocked.has(`${x},${y}`)) {
        return true;
      }
    }
  }

  return false;
}

export function moveWithCollision(position, delta, layout, footWidth, footDepth) {
  const next = { ...position };
  const blockedAxes = { x: false, y: false };
  const substepCount = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / MAX_COLLISION_STEP),
  );
  const stepX = delta.x / substepCount;
  const stepY = delta.y / substepCount;

  for (let index = 0; index < substepCount; index += 1) {
    const tryX = {
      x: clamp(next.x + stepX, footWidth / 2, WORLD_WIDTH - footWidth / 2),
      y: next.y,
    };

    if (!collides(tryX, layout, footWidth, footDepth)) {
      if (stepX !== 0 && tryX.x === next.x) {
        blockedAxes.x = true;
      }
      next.x = tryX.x;
    } else if (stepX !== 0) {
      blockedAxes.x = true;
    }

    const tryY = {
      x: next.x,
      y: clamp(next.y + stepY, footDepth, WORLD_HEIGHT),
    };

    if (!collides(tryY, layout, footWidth, footDepth)) {
      if (stepY !== 0 && tryY.y === next.y) {
        blockedAxes.y = true;
      }
      next.y = tryY.y;
    } else if (stepY !== 0) {
      blockedAxes.y = true;
    }
  }

  return { position: next, blockedAxes };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
