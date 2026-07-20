import { clampVectorLength } from "./input.js";
import { cloneMovementConfig, DEFAULT_MOVEMENT_CONFIG } from "./movementConfig.js";

const ZERO_VECTOR = Object.freeze({ x: 0, y: 0 });

export function createMovementState({ facing = { x: 0, y: 1 } } = {}) {
  return {
    desiredDirection: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    facingDirection: normalizeOr(facing, { x: 0, y: 1 }),
    aimDirection: normalizeOr(facing, { x: 0, y: 1 }),
  };
}

export function stepCharacterMovement(state, inputVector, deltaMs, options = {}) {
  const config = options.config ?? DEFAULT_MOVEMENT_CONFIG;
  const dt = Math.min(Math.max(deltaMs, 0), config.maxDeltaMs) / 1000;
  const desired = clampVectorLength(inputVector ?? ZERO_VECTOR);
  const targetVelocity = {
    x: desired.x * config.maxSpeed,
    y: desired.y * config.maxSpeed,
  };

  const nextVelocity = moveVelocityToward(state.velocity, targetVelocity, dt, config);
  const aim = options.aimDirection ? normalizeOr(options.aimDirection, state.aimDirection) : null;
  const targetFacing = aim ?? vectorDirection(nextVelocity, config.movingSpeedThreshold) ?? vectorDirection(desired, 0) ?? state.facingDirection;
  const facingDirection = rotateVectorToward(
    state.facingDirection,
    targetFacing,
    config.facingTurnSpeed * dt,
  );

  return {
    desiredDirection: desired,
    velocity: nextVelocity,
    facingDirection,
    aimDirection: aim ?? facingDirection,
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
  return { ...cloneMovementConfig(), ...overrides };
}

function moveVelocityToward(current, target, dt, config) {
  if (dt === 0) return { ...current };

  const targetSpeed = Math.hypot(target.x, target.y);
  if (targetSpeed === 0) {
    return moveVectorToward(current, target, config.brakingDeceleration * dt);
  }

  const targetDirection = { x: target.x / targetSpeed, y: target.y / targetSpeed };
  const currentAlongTarget = dot(current, targetDirection);
  const perpendicular = {
    x: current.x - targetDirection.x * currentAlongTarget,
    y: current.y - targetDirection.y * currentAlongTarget,
  };
  const alongRate = currentAlongTarget < 0 ? config.reverseAcceleration : config.acceleration;
  const nextAlong = moveNumberToward(currentAlongTarget, targetSpeed, alongRate * dt);
  const nextPerpendicular = moveVectorToward(perpendicular, ZERO_VECTOR, config.turnDeceleration * dt);

  return {
    x: targetDirection.x * nextAlong + nextPerpendicular.x,
    y: targetDirection.y * nextAlong + nextPerpendicular.y,
  };
}

function moveVectorToward(current, target, maxDistance) {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= maxDistance || distance === 0) return { ...target };
  const scale = maxDistance / distance;
  return { x: current.x + dx * scale, y: current.y + dy * scale };
}

function moveNumberToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function rotateVectorToward(current, target, maxRadians) {
  const from = normalizeOr(current, target);
  const to = normalizeOr(target, from);
  const angle = Math.atan2(cross(from, to), dot(from, to));
  if (Math.abs(angle) <= maxRadians || maxRadians <= 0) return to;
  const nextAngle = Math.atan2(from.y, from.x) + Math.sign(angle) * maxRadians;
  return { x: Math.cos(nextAngle), y: Math.sin(nextAngle) };
}

function normalizeOr(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) return { ...fallback };
  return { x: vector.x / length, y: vector.y / length };
}

function vectorDirection(vector, threshold) {
  return Math.hypot(vector.x, vector.y) > threshold ? normalizeOr(vector, ZERO_VECTOR) : null;
}

function dot(a, b) { return a.x * b.x + a.y * b.y; }
function cross(a, b) { return a.x * b.y - a.y * b.x; }
