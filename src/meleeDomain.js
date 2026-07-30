import { getMeleeWeaponProfile, MELEE_TURN_MODES } from "./meleeConfig.js";

const EPSILON = 1e-9;
const DEFAULT_FACING = Object.freeze({ x: 0, y: 1 });
export const MELEE_BODY_CENTER_Y_OFFSET = 8;

export function createMeleeCombatState() {
  return {
    phase: "idle",
    weaponId: null,
    stepIndex: 0,
    elapsedMs: 0,
    cooldownRemainingMs: 0,
    buffered: false,
    hitEmitted: false,
    direction: { ...DEFAULT_FACING },
  };
}

export function requestMeleeAttack(state, weaponId, moveDirection, currentFacing) {
  const profile = getMeleeWeaponProfile(weaponId);
  if (!profile) return { status: "not-melee", accepted: false };
  if (state.phase === "cooldown") return { status: "cooldown", accepted: false };
  if (isMeleeStepActive(state)) {
    if (state.buffered) return { status: "buffer-full", accepted: false };
    state.buffered = true;
    return { status: "buffered", accepted: true };
  }
  beginMeleeStep(state, profile, 0, moveDirection, currentFacing);
  return { status: "started", accepted: true, stepIndex: 0 };
}

export function advanceMeleeCombat(state, deltaMs, {
  readMoveDirection = () => ({ x: 0, y: 0 }),
  readFacing = () => DEFAULT_FACING,
} = {}) {
  const delta = Math.max(0, Number(deltaMs) || 0);
  const events = [];
  if (state.phase === "idle" || delta === 0) return events;
  if (state.phase === "cooldown") {
    state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - delta);
    if (state.cooldownRemainingMs === 0) resetMeleeCombatState(state);
    return events;
  }

  const profile = getMeleeWeaponProfile(state.weaponId);
  const step = profile.steps[state.stepIndex];
  const previousElapsed = state.elapsedMs;
  state.elapsedMs = Math.min(step.totalDurationMs, previousElapsed + delta);
  if (!state.hitEmitted && previousElapsed < step.windupMs && state.elapsedMs >= step.windupMs) {
    state.hitEmitted = true;
    state.phase = state.elapsedMs === step.windupMs ? "hit" : "recovery";
    events.push({ type: "hit", weaponId: profile.id, stepIndex: state.stepIndex });
  } else if (state.hitEmitted && state.elapsedMs > step.windupMs) {
    state.phase = "recovery";
  }

  if (state.elapsedMs < step.totalDurationMs) return events;
  const completedStepIndex = state.stepIndex;
  const isFinalStep = completedStepIndex >= profile.comboLength - 1;
  if (isFinalStep) {
    state.phase = "cooldown";
    state.cooldownRemainingMs = profile.postComboCooldownMs;
    state.elapsedMs = step.totalDurationMs;
    state.buffered = false;
    events.push({ type: "combo-complete", weaponId: profile.id, stepIndex: completedStepIndex });
    return events;
  }
  if (!state.buffered) {
    resetMeleeCombatState(state);
    events.push({ type: "step-ended", weaponId: profile.id, stepIndex: completedStepIndex });
    return events;
  }

  beginMeleeStep(
    state,
    profile,
    completedStepIndex + 1,
    readMoveDirection(),
    readFacing(),
  );
  events.push({ type: "step-start", weaponId: profile.id, stepIndex: state.stepIndex });
  return events;
}

export function isMeleeStepActive(state) {
  return ["windup", "hit", "recovery"].includes(state?.phase);
}

export function currentMeleeStep(state) {
  const profile = getMeleeWeaponProfile(state?.weaponId);
  return profile?.steps?.[state.stepIndex] ?? null;
}

export function createMeleeGeometrySnapshot({ origin, facingAxis, radius, arcDeg, swingDirection, baseHalfWidthPx = 0 }) {
  return Object.freeze({
    origin: Object.freeze(finitePoint(origin)),
    facingAxis: Object.freeze(normalizeDirection(facingAxis, DEFAULT_FACING)),
    radius: Math.max(0, Number(radius) || 0),
    arcDeg: Math.min(360, Math.max(0, Number(arcDeg) || 0)),
    baseHalfWidthPx: Math.max(0, Number(baseHalfWidthPx) || 0),
    swingDirection,
  });
}

export function queryMeleeTargets(snapshot, targets, alreadyHitIds = new Set()) {
  return (targets ?? []).filter((target) => (
    target?.id
    && !alreadyHitIds.has(target.id)
    && isCombatAnchorInMeleeSnapshot(snapshot, target.combatAnchor)
  ));
}

export function isCombatAnchorInMeleeSnapshot(snapshot, anchor) {
  const target = finitePoint(anchor);
  const dx = target.x - snapshot.origin.x;
  const dy = target.y - snapshot.origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance > snapshot.radius + EPSILON) return false;
  if (snapshot.arcDeg >= 360 || distance <= EPSILON) return true;
  return pointInPolygonInclusive(target, meleeShapePoints(snapshot));
}

export function meleeBodyCenter(position) {
  const point = finitePoint(position);
  return { x: point.x, y: point.y - MELEE_BODY_CENTER_Y_OFFSET };
}

export function meleeShapePoints(snapshot, segments = 20) {
  if (snapshot.arcDeg >= 360) return [];
  const centerAngle = Math.atan2(snapshot.facingAxis.y, snapshot.facingAxis.x);
  const halfArc = snapshot.arcDeg * Math.PI / 360;
  const perpendicular = { x: -snapshot.facingAxis.y, y: snapshot.facingAxis.x };
  const base = snapshot.baseHalfWidthPx ?? 0;
  const points = [{ x: snapshot.origin.x - perpendicular.x * base, y: snapshot.origin.y - perpendicular.y * base }];
  for (let index = 0; index <= segments; index += 1) {
    const angle = centerAngle - halfArc + index / segments * halfArc * 2;
    points.push({
      x: snapshot.origin.x + Math.cos(angle) * snapshot.radius,
      y: snapshot.origin.y + Math.sin(angle) * snapshot.radius,
    });
  }
  points.push({ x: snapshot.origin.x + perpendicular.x * base, y: snapshot.origin.y + perpendicular.y * base });
  return points;
}

export function resolveAutoTargetDirection(snapshot, targets, blend = 0) {
  const candidates = queryMeleeTargets(snapshot, targets);
  const amount = Math.min(1, Math.max(0, Number(blend) || 0));
  if (!candidates.length || amount === 0) return { direction: { ...snapshot.facingAxis }, targets: candidates };
  const center = candidates.reduce((sum, target) => ({
    x: sum.x + target.combatAnchor.x / candidates.length,
    y: sum.y + target.combatAnchor.y / candidates.length,
  }), { x: 0, y: 0 });
  const toward = normalizeDirection({ x: center.x - snapshot.origin.x, y: center.y - snapshot.origin.y }, snapshot.facingAxis);
  return {
    direction: normalizeDirection({
      x: snapshot.facingAxis.x * (1 - amount) + toward.x * amount,
      y: snapshot.facingAxis.y * (1 - amount) + toward.y * amount,
    }, snapshot.facingAxis),
    targets: candidates,
  };
}

export function createAutoTargetSearchSnapshot(snapshot, scale = 1) {
  const multiplier = Math.max(1, Number(scale) || 1);
  return createMeleeGeometrySnapshot({
    ...snapshot,
    radius: snapshot.radius * multiplier,
    arcDeg: snapshot.arcDeg * multiplier,
    baseHalfWidthPx: snapshot.baseHalfWidthPx * multiplier,
  });
}

export function chooseHeavyReversalDirection(currentFacing, requestedDirection, targets, origin) {
  const current = normalizeDirection(currentFacing, DEFAULT_FACING);
  const requested = normalizeDirection(requestedDirection, current);
  if (current.x * requested.x + current.y * requested.y > -0.999) return requested;
  const point = finitePoint(origin);
  const nearest = [...(targets ?? [])].sort((a, b) => (
    distanceSquared(a.combatAnchor, point) - distanceSquared(b.combatAnchor, point)
  ))[0];
  if (!nearest) return requested;
  const toward = normalizeDirection({ x: nearest.combatAnchor.x - point.x, y: nearest.combatAnchor.y - point.y }, current);
  const side = Math.sign(current.x * toward.y - current.y * toward.x);
  if (!side) return requested;
  const perpendicular = { x: -current.y * side, y: current.x * side };
  return normalizeDirection({ x: requested.x + perpendicular.x * 0.001, y: requested.y + perpendicular.y * 0.001 }, requested);
}

export function effectiveKnockbackDistance(distancePx, resistance = 0) {
  return Math.max(0, Number(distancePx) || 0) * (1 - Math.min(1, Math.max(0, Number(resistance) || 0)));
}

export function knockbackEaseOut(progress) {
  const t = Math.min(1, Math.max(0, Number(progress) || 0));
  return 1 - (1 - t) ** 3;
}

export function applyTrainingDummyDamage(targetId, requestedDamage) {
  const damage = Number(requestedDamage) >= 2 ? 2 : 1;
  return {
    status: "damaged",
    targetId,
    damage,
    acceptedDamage: damage,
    defeated: false,
    knockback: true,
    mutated: false,
  };
}

function beginMeleeStep(state, profile, stepIndex, moveDirection, currentFacing) {
  state.phase = "windup";
  state.weaponId = profile.id;
  state.stepIndex = stepIndex;
  state.elapsedMs = 0;
  state.cooldownRemainingMs = 0;
  state.buffered = false;
  state.hitEmitted = false;
  state.direction = chooseStepDirection(moveDirection, currentFacing);
  if (profile.turnMode === MELEE_TURN_MODES.instant) {
    state.direction = { ...state.direction };
  }
}

function resetMeleeCombatState(state) {
  Object.assign(state, createMeleeCombatState());
}

function chooseStepDirection(moveDirection, currentFacing) {
  const move = finitePoint(moveDirection);
  if (Math.hypot(move.x, move.y) > EPSILON) return normalizeDirection(move, DEFAULT_FACING);
  return normalizeDirection(currentFacing, DEFAULT_FACING);
}

function normalizeDirection(value, fallback) {
  const point = finitePoint(value);
  const length = Math.hypot(point.x, point.y);
  if (length <= EPSILON) return { ...fallback };
  return { x: point.x / length, y: point.y / length };
}

function finitePoint(value) {
  return {
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0,
  };
}

function pointInPolygonInclusive(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const a = polygon[previous];
    const b = polygon[index];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    const within = point.x >= Math.min(a.x, b.x) - EPSILON && point.x <= Math.max(a.x, b.x) + EPSILON
      && point.y >= Math.min(a.y, b.y) - EPSILON && point.y <= Math.max(a.y, b.y) + EPSILON;
    if (Math.abs(cross) <= EPSILON && within) return true;
    if ((a.y > point.y) !== (b.y > point.y)
      && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function distanceSquared(a, b) {
  const point = finitePoint(a);
  return (point.x - b.x) ** 2 + (point.y - b.y) ** 2;
}
