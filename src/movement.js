import { validateCollisionEnvironment } from "./collisionEnvironment.js";

const CELL_COVERAGE_EPSILON = 0.001;

export function getFootBox(position, footWidth, footDepth) {
  return {
    left: position.x - footWidth / 2,
    right: position.x + footWidth / 2,
    top: position.y - footDepth,
    bottom: position.y,
  };
}

export function collides(position, layout, footWidth, footDepth) {
  const environment = validateCollisionEnvironment(layout);
  const box = getFootBox(position, footWidth, footDepth);
  const { bounds, cellSize } = environment;

  if (
    box.left < bounds.left ||
    box.top < bounds.top ||
    box.right > bounds.right ||
    box.bottom > bounds.bottom
  ) {
    return true;
  }

  const minX = Math.floor((box.left - bounds.left) / cellSize);
  const maxX = Math.floor((box.right - bounds.left - CELL_COVERAGE_EPSILON) / cellSize);
  const minY = Math.floor((box.top - bounds.top) / cellSize);
  const maxY = Math.floor((box.bottom - bounds.top - CELL_COVERAGE_EPSILON) / cellSize);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (environment.isBlockedCell(x, y)) return true;
    }
  }

  return false;
}

export function moveWithCollision(position, delta, layout, footWidth, footDepth) {
  const environment = validateCollisionEnvironment(layout);
  const next = { ...position };
  const blockedAxes = { x: false, y: false };
  const substepCount = Math.max(
    1,
    Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y)) / (environment.cellSize / 4)),
  );
  const stepX = delta.x / substepCount;
  const stepY = delta.y / substepCount;

  for (let index = 0; index < substepCount; index += 1) {
    const requestedX = next.x + stepX;
    const clampedX = clamp(
      requestedX,
      environment.bounds.left + footWidth / 2,
      environment.bounds.right - footWidth / 2,
    );
    const tryX = { x: clampedX, y: next.y };

    if (!collides(tryX, environment, footWidth, footDepth)) {
      if (stepX !== 0 && clampedX !== requestedX) blockedAxes.x = true;
      next.x = clampedX;
    } else if (stepX !== 0) {
      blockedAxes.x = true;
    }

    const requestedY = next.y + stepY;
    const clampedY = clamp(
      requestedY,
      environment.bounds.top + footDepth,
      environment.bounds.bottom,
    );
    const tryY = { x: next.x, y: clampedY };

    if (!collides(tryY, environment, footWidth, footDepth)) {
      if (stepY !== 0 && clampedY !== requestedY) blockedAxes.y = true;
      next.y = clampedY;
    } else if (stepY !== 0) {
      blockedAxes.y = true;
    }
  }

  return { position: next, blockedAxes };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
