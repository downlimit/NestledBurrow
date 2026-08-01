export const INTERACTION_PHASE = Object.freeze({
  free: "free",
  enter: "enter",
  active: "active",
  exit: "exit",
});

export const INTERACTION_TIMELINE_PROFILES = Object.freeze({
  shower: profile("lustre", 700, 900, 400),
  toilet: profile("toilet", 500, 600, 300),
  table: profile("satiety", 500, 650, 300),
  bed: profile("energy", 1000, 1200, 500),
});

export function createInteractionTimelineRuntime({
  getPresentationPosition = () => ({ x: 0, y: 0 }),
  getMotorPosition = getPresentationPosition,
  setPresentationPose = () => {},
} = {}) {
  let state = freeState();

  function begin({ profileId, targetPose, onActivate = () => {}, onDeactivate = () => {}, onComplete = () => {}, metadata = null } = {}) {
    const profile = INTERACTION_TIMELINE_PROFILES[profileId];
    if (!profile) return { status: "unknown-profile", mutated: false };
    if (state.phase !== INTERACTION_PHASE.free) return { status: "busy", mutated: false };
    const start = poseFrom(getPresentationPosition(), targetPose);
    state = {
      phase: INTERACTION_PHASE.enter, profileId, profile, elapsedMs: 0, durationMs: profile.enterMs,
      startPose: start, targetPose: poseFrom(targetPose, targetPose), onActivate, onDeactivate, onComplete,
      metadata, effectActive: false,
    };
    setPresentationPose(start);
    return { status: "entering", mutated: false, phase: state.phase, protectedNeed: profile.protectedNeed };
  }

  function update(deltaMs) {
    if (![INTERACTION_PHASE.enter, INTERACTION_PHASE.exit].includes(state.phase)) return getState();
    state.elapsedMs = Math.min(state.durationMs, state.elapsedMs + finiteNonNegative(deltaMs));
    const progress = state.durationMs > 0 ? state.elapsedMs / state.durationMs : 1;
    setPresentationPose(interpolatePose(state.startPose, state.targetPose, smoothstep(progress)));
    if (progress < 1) return getState();
    if (state.phase === INTERACTION_PHASE.enter) {
      state.phase = INTERACTION_PHASE.active;
      state.effectActive = true;
      setPresentationPose(state.targetPose);
      state.onActivate();
      return getState();
    }
    const complete = state.onComplete;
    setPresentationPose(null);
    state = freeState();
    complete();
    return getState();
  }

  function requestExit(priority = "normal") {
    if (state.phase === INTERACTION_PHASE.free) return { status: "free", mutated: false };
    if (state.phase === INTERACTION_PHASE.active) {
      startExit(priority === "emergency" ? state.profile.emergencyMs : state.profile.exitMs);
      return { status: "exiting", mutated: false, priority };
    }
    if (priority === "normal") return { status: "transition-locked", mutated: false, phase: state.phase };
    if (priority === "emergency" && state.phase === INTERACTION_PHASE.enter) {
      startExit(state.profile.emergencyMs);
      return { status: "emergency-exit", mutated: false, phase: state.phase };
    }
    const remaining = Math.max(0, state.durationMs - state.elapsedMs);
    const accelerated = priority === "urgent" ? remaining * 0.6 : Math.min(remaining, state.profile.emergencyMs);
    state.durationMs = state.elapsedMs + accelerated;
    return { status: "accelerated", mutated: false, priority, remainingMs: accelerated };
  }

  function startExit(durationMs) {
    if (state.effectActive) {
      state.effectActive = false;
      state.onDeactivate();
    }
    state.phase = INTERACTION_PHASE.exit;
    state.elapsedMs = 0;
    state.durationMs = durationMs;
    state.startPose = poseFrom(getPresentationPosition(), state.targetPose);
    state.targetPose = poseFrom(getMotorPosition(), { facing: "down", angle: 0, originX: 0.5, originY: 1, showSleepMarker: false });
  }

  function getState() {
    return Object.freeze({
      phase: state.phase,
      profileId: state.profileId ?? null,
      protectedNeed: state.profile?.protectedNeed ?? null,
      metadata: state.metadata ?? null,
      effectActive: Boolean(state.effectActive),
      remainingMs: state.durationMs === undefined ? 0 : Math.max(0, state.durationMs - state.elapsedMs),
    });
  }

  return Object.freeze({
    begin,
    update,
    requestExit,
    getState,
    getProtectedNeed: () => state.profile?.protectedNeed ?? null,
    isLocked: () => state.phase !== INTERACTION_PHASE.free,
  });
}

function profile(protectedNeed, enterMs, exitMs, emergencyMs) {
  return Object.freeze({ protectedNeed, enterMs, exitMs, emergencyMs });
}

function freeState() {
  return { phase: INTERACTION_PHASE.free };
}

function poseFrom(position, fallback = {}) {
  return {
    x: Number(position?.x ?? 0), y: Number(position?.y ?? 0),
    facing: position?.facing ?? fallback?.facing ?? "down",
    angle: Number(position?.angle ?? fallback?.angle ?? 0),
    originX: Number(position?.originX ?? fallback?.originX ?? 0.5),
    originY: Number(position?.originY ?? fallback?.originY ?? 0.5),
    depth: position?.depth ?? fallback?.depth,
    showSleepMarker: Boolean(position?.showSleepMarker ?? fallback?.showSleepMarker),
  };
}

function interpolatePose(from, to, amount) {
  return {
    ...to,
    x: from.x + (to.x - from.x) * amount,
    y: from.y + (to.y - from.y) * amount,
    angle: from.angle + (to.angle - from.angle) * amount,
    originX: from.originX + (to.originX - from.originX) * amount,
    originY: from.originY + (to.originY - from.originY) * amount,
    showSleepMarker: amount >= 1 && to.showSleepMarker,
  };
}

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
