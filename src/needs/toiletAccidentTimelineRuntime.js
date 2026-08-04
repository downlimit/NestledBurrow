export const TOILET_ACCIDENT_PHASE = Object.freeze({
  free: "free",
  shake: "shake",
  recovery: "recovery",
});

export const TOILET_ACCIDENT_TIMELINE_TUNING = Object.freeze({
  zeroGameMinutes: 10,
  shakeCount: 3,
  shakeIntervalMs: 750,
  shakeOffsetPx: 1,
  recoveryMs: 2000,
  recoveryToilet: 70,
});

export function createToiletAccidentTimelineRuntime({
  tuning = TOILET_ACCIDENT_TIMELINE_TUNING,
  getBasePose = () => ({ x: 0, y: 0 }),
  setPresentationPose = () => {},
  onPuddle = () => {},
  onRecoveryProgress = () => {},
  onComplete = () => {},
} = {}) {
  let state = freeState();

  function begin({ witnessed = false } = {}) {
    if (isLocked()) return { status: "busy", mutated: false };
    state = {
      phase: TOILET_ACCIDENT_PHASE.shake,
      elapsedMs: 0,
      basePose: poseFrom(getBasePose()),
      witnessed: Boolean(witnessed),
      puddleOutput: null,
    };
    setPresentationPose(shakePose(state.basePose, 0, tuning));
    return { status: "started", mutated: false, phase: state.phase };
  }

  function update(deltaMs) {
    let remainingMs = finiteNonNegative(deltaMs);
    while (remainingMs > 0 && isLocked()) {
      const phaseDuration = state.phase === TOILET_ACCIDENT_PHASE.shake
        ? tuning.shakeCount * tuning.shakeIntervalMs
        : tuning.recoveryMs;
      const stepMs = Math.min(remainingMs, phaseDuration - state.elapsedMs);
      state.elapsedMs += stepMs;
      remainingMs -= stepMs;
      if (state.phase === TOILET_ACCIDENT_PHASE.shake) {
        setPresentationPose(shakePose(state.basePose, state.elapsedMs, tuning));
        if (state.elapsedMs < phaseDuration) continue;
        state.phase = TOILET_ACCIDENT_PHASE.recovery;
        state.elapsedMs = 0;
        state.puddleOutput = Object.freeze({
          type: "toilet-accident-puddle",
          localPuddle: true,
          witnessed: state.witnessed,
          position: Object.freeze({ x: state.basePose.x, y: state.basePose.y }),
        });
        setPresentationPose(state.basePose);
        onPuddle(state.puddleOutput);
        onRecoveryProgress(0);
        continue;
      }
      const progress = phaseDuration > 0 ? state.elapsedMs / phaseDuration : 1;
      onRecoveryProgress(progress);
      if (state.elapsedMs < phaseDuration) continue;
      setPresentationPose(null);
      state = freeState();
      onComplete();
    }
    return getState();
  }

  function getState() {
    const shakeDurationMs = tuning.shakeCount * tuning.shakeIntervalMs;
    const remainingMs = state.phase === TOILET_ACCIDENT_PHASE.shake
      ? shakeDurationMs - state.elapsedMs + tuning.recoveryMs
      : state.phase === TOILET_ACCIDENT_PHASE.recovery ? tuning.recoveryMs - state.elapsedMs : 0;
    return Object.freeze({
      phase: state.phase,
      profileId: state.phase === TOILET_ACCIDENT_PHASE.free ? null : "toilet-accident",
      protectedNeed: state.phase === TOILET_ACCIDENT_PHASE.free ? null : "toilet",
      effectActive: state.phase !== TOILET_ACCIDENT_PHASE.free,
      remainingMs: Math.max(0, remainingMs),
      shakeIndex: state.phase === TOILET_ACCIDENT_PHASE.shake
        ? Math.min(tuning.shakeCount, Math.floor(state.elapsedMs / tuning.shakeIntervalMs) + 1)
        : tuning.shakeCount,
      recoveryProgress: state.phase === TOILET_ACCIDENT_PHASE.recovery ? state.elapsedMs / tuning.recoveryMs : 0,
      puddleOutput: state.puddleOutput,
    });
  }

  function isLocked() {
    return state.phase !== TOILET_ACCIDENT_PHASE.free;
  }

  return Object.freeze({ begin, update, getState, isLocked });
}

function shakePose(basePose, elapsedMs, tuning) {
  const intervalMs = Math.max(1, tuning.shakeIntervalMs);
  const phase = elapsedMs % intervalMs / intervalMs;
  return { ...basePose, x: basePose.x + Math.sin(phase * Math.PI * 2) * tuning.shakeOffsetPx };
}

function poseFrom(value = {}) {
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    facing: value.facing ?? "down",
    angle: Number(value.angle) || 0,
    originX: Number(value.originX ?? 0.5),
    originY: Number(value.originY ?? 1),
  };
}

function freeState() {
  return { phase: TOILET_ACCIDENT_PHASE.free, elapsedMs: 0, puddleOutput: null };
}

function finiteNonNegative(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
