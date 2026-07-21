import { GAME_HEIGHT, GAME_WIDTH } from "./worldConfig.js";

export const JOYSTICK = {
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

export function getJoystickState(pointerX, pointerY, center, config = JOYSTICK) {
  const dx = pointerX - center.x;
  const dy = pointerY - center.y;
  const distance = Math.hypot(dx, dy);
  const limitedDistance = Math.min(distance, config.maxOffset);
  const unitX = distance === 0 ? 0 : dx / distance;
  const unitY = distance === 0 ? 0 : dy / distance;
  const deadZone = config.maxOffset * config.deadZoneRatio;
  const movementStrength = distance <= deadZone
    ? 0
    : Math.min((distance - deadZone) / (config.maxOffset - deadZone), 1);

  return {
    knobX: center.x + unitX * limitedDistance,
    knobY: center.y + unitY * limitedDistance,
    movementX: unitX * movementStrength,
    movementY: unitY * movementStrength,
  };
}

export function isInsideJoystickActivation(pointerX, _pointerY, gameWidth = GAME_WIDTH) {
  return pointerX >= 0 && pointerX < gameWidth / 2;
}

export function clampJoystickCenter(pointerX, pointerY, config = JOYSTICK, bounds = { width: GAME_WIDTH, height: GAME_HEIGHT }) {
  const left = config.baseRadius;
  const right = Math.max(left, bounds.width / 2 - config.baseRadius);
  const top = config.baseRadius;
  const bottom = Math.max(top, bounds.height - config.baseRadius);

  return {
    x: Math.min(Math.max(pointerX, left), right),
    y: Math.min(Math.max(pointerY, top), bottom),
  };
}
