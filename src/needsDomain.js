export const NEED_IDS = Object.freeze(["novelty", "energy", "satiety", "toilet", "lustre", "dialogue"]);
export const PERSISTED_NEED_IDS = Object.freeze(NEED_IDS.filter((id) => id !== "energy"));
export const NEED_SYMBOLS = Object.freeze({
  novelty: "N",
  energy: "E",
  satiety: "S",
  toilet: "T",
  lustre: "L",
  dialogue: "D",
});
export const DEFAULT_NEEDS = Object.freeze(Object.fromEntries(PERSISTED_NEED_IDS.map((id) => [id, 100])));

export function normalizeNeedValue(value, fallback = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : fallback;
}

export function normalizeNeeds(value = {}) {
  return Object.fromEntries(PERSISTED_NEED_IDS.map((id) => [id, normalizeNeedValue(value?.[id])]));
}

export function computeNeedRates(activity = {}, tuning) {
  const facility = activity.facility ?? null;
  const resourceKind = activity.activeResourceKind ?? null;
  const running = Boolean(activity.running);
  return Object.freeze({
    novelty: resourceKind === "ruby"
      ? tuning.novelty.ruby
      : resourceKind
        ? tuning.novelty.commonResource
        : running
          ? tuning.novelty.running
          : tuning.novelty.base,
    satiety: facility === "table"
      ? tuning.satiety.table
      : resourceKind
        ? tuning.satiety.base * tuning.satiety.resourceMultiplier
        : running
          ? tuning.satiety.base * tuning.satiety.runningMultiplier
          : tuning.satiety.base,
    toilet: facility === "toilet"
      ? tuning.toilet.toilet
      : tuning.toilet.base * (facility === "shower" ? tuning.toilet.showerMultiplier : 1),
    lustre: facility === "shower"
      ? tuning.lustre.shower
      : tuning.lustre.base * (facility === "toilet" ? tuning.lustre.toiletMultiplier : 1),
    dialogue: activity.npcNearby ? tuning.dialogue.nearNpc : tuning.dialogue.base,
  });
}

export function applyNeedsUpdate(needs, deltaSeconds, activity, tuning) {
  const delta = Number(deltaSeconds);
  if (!Number.isFinite(delta) || delta < 0) throw new Error("Needs delta must be a non-negative finite number");
  const rates = computeNeedRates(activity, tuning);
  for (const id of PERSISTED_NEED_IDS) needs[id] = normalizeNeedValue(needs[id] + rates[id] * delta);
  return createNeedsFlowSnapshot(rates, tuning);
}

export function createNeedsFlowSnapshot(rates, tuning) {
  return Object.freeze(Object.fromEntries(PERSISTED_NEED_IDS.map((id) => {
    const rate = Number(rates[id]) || 0;
    const base = Math.abs(tuning[id].base);
    const intensity = base > 0 ? Math.abs(rate) / base : Math.abs(rate);
    const arrows = intensity >= tuning.flowArrowRatios[1] ? 3 : intensity > tuning.flowArrowRatios[0] ? 2 : 1;
    return [id, Object.freeze({ rate, direction: rate >= 0 ? "up" : "down", arrows })];
  })));
}
