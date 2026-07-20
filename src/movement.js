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

export function getMovementVector(
  { left = false, right = false, up = false, down = false } = {},
  joystickVector = { x: 0, y: 0 },
) {
  return {
    x: Number(right) - Number(left) + joystickVector.x,
    y: Number(down) - Number(up) + joystickVector.y,
  };
}

export function resolveFacing(currentFacing, direction, hysteresis) {
  const absX = Math.abs(direction.x);
  const absY = Math.abs(direction.y);

  if (absX === 0 && absY === 0) {
    return currentFacing;
  }

  if (Math.abs(absX - absY) <= hysteresis) {
    return currentFacing;
  }

  if (absX > absY) {
    return direction.x > 0 ? "right" : "left";
  }

  return direction.y > 0 ? "down" : "up";
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
      next.x = tryX.x;
    }

    const tryY = {
      x: next.x,
      y: clamp(next.y + stepY, footDepth, WORLD_HEIGHT),
    };

    if (!collides(tryY, layout, footWidth, footDepth)) {
      next.y = tryY.y;
    }
  }

  return next;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
