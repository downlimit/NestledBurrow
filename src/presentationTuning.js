function pulseProfile(fadeInMs, peakHoldMs, fadeOutMs, transparentHoldMs, peakAlpha = 0.9) {
  return Object.freeze({
    fadeInMs,
    peakHoldMs,
    fadeOutMs,
    transparentHoldMs,
    peakAlpha,
    cycleMs: fadeInMs + peakHoldMs + fadeOutMs + transparentHoldMs,
  });
}

export const NEED_FLOW_PULSE_TUNING = Object.freeze({
  slow: pulseProfile(180, 1140, 180, 3000),
  medium: pulseProfile(180, 1890, 180, 1750),
  strong: pulseProfile(180, 2640, 180, 500),
});

export const NEED_FLOW_PROFILE_BY_ARROWS = Object.freeze({
  1: NEED_FLOW_PULSE_TUNING.slow,
  2: NEED_FLOW_PULSE_TUNING.medium,
  3: NEED_FLOW_PULSE_TUNING.strong,
});
