import { clampVectorLength } from "./input.js";
import { DEFAULT_MOVEMENT_CONFIG, sanitizeMovementConfig } from "./movementConfig.js";

const ZERO_VECTOR = Object.freeze({ x: 0, y: 0 });

export function createMovementState({ facing = { x: 0, y: 1 } } = {}) {
  const initialFacing = normalizeOr(safeVector(facing), { x: 0, y: 1 });
  return {
    desiredDirection: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facingDirection: initialFacing,
    aimDirection: { ...initialFacing },
  };
}

export function stepCharacterMovement(state, inputVector, deltaMs, options = {}) {
  const config = options.config ?? DEFAULT_MOVEMENT_CONFIG;
  const dt = deltaSeconds(deltaMs, config);
  const desired = clampVectorLength(safeVector(inputVector));
  const targetVelocity = {
    x: desired.x * config.maxSpeed,
    y: desired.y * config.maxSpeed,
  };

  const integratedVelocity = moveVelocityToward(state.velocity, targetVelocity, dt, config);
  const nextVelocity = clampVectorMagnitude(integratedVelocity, config.maxSpeed);
  const explicitAim = options.aimDirection == null
    ? null
    : normalizeOr(safeVector(options.aimDirection), state.aimDirection);
  const targetFacing =
    explicitAim ??
    vectorDirection(nextVelocity, config.movingSpeedThreshold) ??
    vectorDirection(desired, 0) ??
    state.facingDirection;
  const facingDirection = rotateVectorToward(
    state.facingDirection,
    targetFacing,
    config.facingTurnSpeed * dt,
  );

  return {
    desiredDirection: desired,
    velocity: nextVelocity,
    facingDirection,
    aimDirection: explicitAim ?? facingDirection,
  };
}

export function movementDelta(state, deltaMs, config = DEFAULT_MOVEMENT_CONFIG) {
  const dt = deltaSeconds(deltaMs, config);
  return {
    x: state.velocity.x * dt,
    y: state.velocity.y * dt,
  };
}

export function applyBlockedAxes(state, blockedAxes) {
  return {
    ...state,
    velocity: {
      x: blockedAxes?.x ? 0 : state.velocity.x,
      y: blockedAxes?.y ? 0 : state.velocity.y,
    },
  };
}

export function movementSpeed(state) {
  return Math.hypot(state.velocity.x, state.velocity.y);
}

export function isMoving(state, config = DEFAULT_MOVEMENT_CONFIG) {
  return movementSpeed(state) >= config.movingSpeedThreshold;
}

export function createRuntimeMovementConfig(overrides = {}) {
  return sanitizeMovementConfig(overrides);
}

function deltaSeconds(deltaMs, config) {
  const finiteDelta = Number.isFinite(deltaMs) ? deltaMs : 0;
  return Math.min(Math.max(finiteDelta, 0), config.maxDeltaMs) / 1000;
}

function moveVelocityToward(current, target, dt, config) {
  if (dt === 0) return { ...current };

  const targetSpeed = Math.hypot(target.x, target.y);
  if (targetSpeed === 0) {
    return moveVectorToward(current, ZERO_VECTOR, config.brakingDeceleration * dt);
  }

  const targetDirection = { x: target.x / targetSpeed, y: target.y / targetSpeed };
  const currentAlongTarget = dot(current, targetDirection);
  const perpendicular = {
    x: current.x - targetDirection.x * currentAlongTarget,
    y: current.y - targetDirection.y * currentAlongTarget,
  };
  const alongRate = currentAlongTarget < 0 ? config.reverseAcceleration : config.acceleration;
  const nextAlong = moveNumberToward(currentAlongTarget, targetSpeed, alongRate * dt);
  const nextPerpendicular = moveVectorToward(
    perpendicular,
    ZERO_VECTOR,
    config.turnDeceleration * dt,
  );

  return {
    x: targetDirection.x * nextAlong + nextPerpendicular.x,
    y: targetDirection.y * nextAlong + nextPerpendicular.y,
  };
}

function moveVectorToward(current, target, maxDistance) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0 || distance <= maxDistance) return { ...target };
  if (maxDistance <= 0) return { ...current };
  const scale = maxDistance / distance;
  return { x: current.x + dx * scale, y: current.y + dy * scale };
}

function moveNumberToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  if (maxDelta <= 0) return current;
  return current + Math.sign(target - current) * maxDelta;
}

function clampVectorMagnitude(vector, maxLength) {
  if (maxLength <= 0) return { x: 0, y: 0 };
  const length = Math.hypot(vector.x, vector.y);
  if (length <= maxLength || length === 0) return { ...vector };
  const scale = maxLength / length;
  return { x: vector.x * scale, y: vector.y * scale };
}

function rotateVectorToward(current, target, maxRadians) {
  const from = normalizeOr(current, target);
  const to = normalizeOr(target, from);
  if (maxRadians <= 0) return from;
  const angle = Math.atan2(cross(from, to), dot(from, to));
  if (Math.abs(angle) <= maxRadians) return to;
  const nextAngle = Math.atan2(from.y, from.x) + Math.sign(angle) * maxRadians;
  return { x: Math.cos(nextAngle), y: Math.sin(nextAngle) };
}

function safeVector(vector = ZERO_VECTOR) {
  return {
    x: Number.isFinite(vector?.x) ? vector.x : 0,
    y: Number.isFinite(vector?.y) ? vector.y : 0,
  };
}

function normalizeOr(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { ...fallback };
  return { x: vector.x / length, y: vector.y / length };
}

function vectorDirection(vector, threshold) {
  return Math.hypot(vector.x, vector.y) > threshold ? normalizeOr(vector, ZERO_VECTOR) : null;
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y;
}

function cross(a, b) {
  return a.x * b.y - a.y * b.x;
}
