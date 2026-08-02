export const CHARACTER_FACINGS = Object.freeze([
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
]);

const FULL_TURN = Math.PI * 2;
const SECTOR_SIZE = Math.PI / 4;
const SECTOR_HALF_SIZE = Math.PI / 8;
const FACING_TO_INDEX = Object.freeze(Object.fromEntries(CHARACTER_FACINGS.map((facing, index) => [facing, index])));

function normalizeAngle(angle) {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

export function angularDistance(a, b) {
  const distance = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(distance, FULL_TURN - distance);
}

export function getFacingSectorCenter(facing) {
  return FACING_TO_INDEX[facing] * SECTOR_SIZE;
}

export function quantizeCharacterFacing(direction, lastFacing = "down", hysteresis = 0) {
  if (!direction || (direction.x === 0 && direction.y === 0)) return lastFacing;

  const angle = normalizeAngle(Math.atan2(direction.y, direction.x));
  const currentIndex = FACING_TO_INDEX[lastFacing];
  if (currentIndex !== undefined) {
    const currentCenter = currentIndex * SECTOR_SIZE;
    if (angularDistance(angle, currentCenter) <= SECTOR_HALF_SIZE + hysteresis) return lastFacing;
  }

  const nearestIndex = Math.floor((angle + SECTOR_HALF_SIZE) / SECTOR_SIZE) % CHARACTER_FACINGS.length;
  return CHARACTER_FACINGS[nearestIndex];
}
