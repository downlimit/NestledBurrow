export const NEED_FLOW_WINDOW_MS = 660;
export const MEASURED_NEED_IDS = Object.freeze(["novelty", "energy", "satiety", "toilet", "lustre", "dialogue"]);

const perGameHour = (value) => value / 60;
const perMeasuredWindow = (value) => value / (NEED_FLOW_WINDOW_MS / 1000);

export const NEED_FLOW_NORMALIZATION = Object.freeze({
  novelty: directionalRanges(
    flowRange(perGameHour(1), perMeasuredWindow(1)),
    flowRange(perMeasuredWindow(6), perMeasuredWindow(25)),
  ),
  energy: directionalRanges(
    flowRange(perGameHour(5), perGameHour(9.5) + perMeasuredWindow(0.3 * 1.5 * 1.3)),
    flowRange(1 - perGameHour(5), perGameHour(14 * 32)),
  ),
  satiety: directionalRanges(
    flowRange(perGameHour(7), perGameHour(21)),
    flowRange(1, perGameHour(600)),
  ),
  toilet: directionalRanges(
    flowRange(perGameHour(6), perGameHour(18)),
    flowRange(1, perGameHour(600)),
  ),
  lustre: directionalRanges(
    flowRange(perGameHour(1), perGameHour(4)),
    flowRange(1, perGameHour(600)),
  ),
  dialogue: directionalRanges(
    flowRange(perGameHour(2), perMeasuredWindow(15)),
    flowRange(perGameHour(6), perMeasuredWindow(30)),
  ),
});

export function createNeedsFlowRuntime({
  initialValues = {},
  windowMs = NEED_FLOW_WINDOW_MS,
  normalization = NEED_FLOW_NORMALIZATION,
} = {}) {
  const normalizedWindowMs = Math.max(1, Number(windowMs) || NEED_FLOW_WINDOW_MS);
  let elapsedMs = 0;
  let values = normalizeValues(initialValues);
  let changes = Object.fromEntries(MEASURED_NEED_IDS.map((id) => [id, []]));

  function observe(nextValues) {
    recordChanges(nextValues, 0);
    return snapshot();
  }

  function advance(nextValues, deltaMs) {
    const durationMs = Math.max(0, Number(deltaMs) || 0);
    const startMs = elapsedMs;
    elapsedMs += durationMs;
    recordChanges(nextValues, durationMs, startMs);
    prune();
    return snapshot();
  }

  function reset(nextValues = values) {
    values = normalizeValues(nextValues);
    elapsedMs = 0;
    changes = Object.fromEntries(MEASURED_NEED_IDS.map((id) => [id, []]));
    return snapshot();
  }

  function recordChanges(nextValues, durationMs = 0, startMs = elapsedMs) {
    const normalized = normalizeValues(nextValues);
    for (const id of MEASURED_NEED_IDS) {
      const delta = normalized[id] - values[id];
      if (delta !== 0) changes[id].push({ startMs, endMs: elapsedMs, durationMs, delta });
    }
    values = normalized;
    prune();
  }

  function prune() {
    const cutoff = elapsedMs - normalizedWindowMs;
    for (const id of MEASURED_NEED_IDS) changes[id] = changes[id].filter((entry) => entry.endMs > cutoff);
  }

  function snapshot() {
    const durationSeconds = normalizedWindowMs / 1000;
    const cutoff = elapsedMs - normalizedWindowMs;
    return Object.freeze(Object.fromEntries(MEASURED_NEED_IDS.map((id) => {
      const delta = changes[id].reduce((total, entry) => total + windowedDelta(entry, cutoff), 0);
      return [id, measuredNeedFlow(delta / durationSeconds, normalization[id])];
    })));
  }

  return Object.freeze({ observe, advance, reset, getState: snapshot });
}

export function measuredNeedFlow(ratePerSecond, normalization) {
  const rate = Number(ratePerSecond) || 0;
  const magnitude = Math.abs(rate);
  const direction = rate > 0 ? "up" : "down";
  const range = normalization?.[direction];
  if (!range || magnitude < range.zeroBelowPerSecond - 1e-9) {
    return Object.freeze({ direction: null, arrows: 0, ratePerSecond: rate });
  }
  const arrows = magnitude <= range.weakRatePerSecond + 1e-6
    ? 1
    : magnitude < range.maximumRatePerSecond - 1e-6 ? 2 : 3;
  return Object.freeze({ direction, arrows, ratePerSecond: rate });
}

export function needMeterValues(gameplay = {}) {
  return {
    novelty: finiteValue(gameplay.needs?.novelty),
    energy: finiteValue(gameplay.currentEnergy),
    satiety: finiteValue(gameplay.needs?.satiety),
    toilet: finiteValue(gameplay.needs?.toilet),
    lustre: finiteValue(gameplay.needs?.lustre),
    dialogue: finiteValue(gameplay.needs?.dialogue),
  };
}

function flowRange(weakRatePerSecond, maximumRatePerSecond) {
  return Object.freeze({
    zeroBelowPerSecond: weakRatePerSecond * 0.1,
    weakRatePerSecond,
    maximumRatePerSecond,
  });
}

function directionalRanges(down, up) {
  return Object.freeze({ down, up });
}

function windowedDelta(entry, cutoff) {
  if (entry.durationMs <= 0) return entry.endMs > cutoff ? entry.delta : 0;
  const overlapMs = Math.max(0, entry.endMs - Math.max(entry.startMs, cutoff));
  return entry.delta * Math.min(1, overlapMs / entry.durationMs);
}

function normalizeValues(value) {
  return Object.fromEntries(MEASURED_NEED_IDS.map((id) => [id, finiteValue(value?.[id])]));
}

function finiteValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
