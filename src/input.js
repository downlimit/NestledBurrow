export const JOYSTICK = {
  centerX: 32,
  centerY: 180 - 32,
  baseRadius: 21,
  knobRadius: 9,
  maxOffset: 15,
  activationRadius: 31,
  deadZoneRatio: 0.15,
};

export function isTouchJoystickSupported({ maxTouchPoints = 0, coarsePointer = false } = {}) {
  return maxTouchPoints > 0 || coarsePointer;
}

export function clampVectorLength(vector, maxLength = 1) {
  const length = Math.hypot(vector.x, vector.y);

  if (length <= maxLength || length === 0) {
    return { x: vector.x, y: vector.y };
  }

  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale };
}

export function getJoystickState(pointerX, pointerY, config = JOYSTICK) {
  const dx = pointerX - config.centerX;
  const dy = pointerY - config.centerY;
  const distance = Math.hypot(dx, dy);
  const limitedDistance = Math.min(distance, config.maxOffset);
  const unitX = distance === 0 ? 0 : dx / distance;
  const unitY = distance === 0 ? 0 : dy / distance;
  const deadZone = config.maxOffset * config.deadZoneRatio;
  const movementStrength = distance <= deadZone
    ? 0
    : Math.min((distance - deadZone) / (config.maxOffset - deadZone), 1);

  return {
    knobX: config.centerX + unitX * limitedDistance,
    knobY: config.centerY + unitY * limitedDistance,
    movementX: unitX * movementStrength,
    movementY: unitY * movementStrength,
  };
}

export function isInsideJoystickActivation(pointerX, pointerY, config = JOYSTICK) {
  return Math.hypot(pointerX - config.centerX, pointerY - config.centerY) <= config.activationRadius;
}
