export const INTERACTION_APPROACH_DIRECTIONS = Object.freeze([
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
]);

const DIRECTION_SET = new Set(INTERACTION_APPROACH_DIRECTIONS);

export function normalizeInteractionDirections(value, fallback = INTERACTION_APPROACH_DIRECTIONS) {
  if (!Array.isArray(value)) return Object.freeze([...fallback]);
  const requested = new Set(value.filter((direction) => DIRECTION_SET.has(direction)));
  const normalized = INTERACTION_APPROACH_DIRECTIONS.filter((direction) => requested.has(direction));
  return Object.freeze(normalized.length ? normalized : [...fallback]);
}

export function isInteractionDirection(direction) {
  return DIRECTION_SET.has(direction);
}

export function interactionDirectionAtPoint(bounds, point) {
  const horizontal = point.x < bounds.left ? "left" : point.x > bounds.right ? "right" : null;
  const vertical = point.y < bounds.top ? "top" : point.y > bounds.bottom ? "bottom" : null;
  if (vertical && horizontal) return `${vertical}-${horizontal}`;
  if (vertical || horizontal) return vertical ?? horizontal;
  const distances = [
    { direction: "left", distance: Math.abs(point.x - bounds.left) },
    { direction: "right", distance: Math.abs(bounds.right - point.x) },
    { direction: "top", distance: Math.abs(point.y - bounds.top) },
    { direction: "bottom", distance: Math.abs(bounds.bottom - point.y) },
  ];
  return distances.sort((left, right) => left.distance - right.distance)[0].direction;
}
