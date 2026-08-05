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
