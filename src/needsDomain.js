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

export const NEED_ACTIVITY = Object.freeze({
  ordinary: "ordinary",
  walking: "walking",
  running: "running",
});

export function normalizeNeedValue(value, fallback = 100) {
  const number = Number(value);
  return Number.isFinite(number) ? clamp(number, 0, 100) : fallback;
}

export function normalizeNeeds(value = {}) {
  return Object.fromEntries(PERSISTED_NEED_IDS.map((id) => [id, normalizeNeedValue(value?.[id])]));
}

export function pressure(value, threshold) {
  const q = Math.max(0, Number(threshold) || 0);
  return q > 0 ? clamp((q - normalizeNeedValue(value, 0)) / q, 0, 1) : 0;
}

export function hungerPressure(satiety) {
  return pressure(satiety, 30);
}

export function energyRecoveryMultiplier(needs, { shared = false } = {}) {
  const hungerMultiplier = 1 - 0.4 * hungerPressure(needs?.satiety);
  const dialogueMultiplier = shared ? 1 : 1 - 0.25 * pressure(needs?.dialogue, 30);
  return hungerMultiplier * dialogueMultiplier;
}

export function activityEnergyRate(activity = NEED_ACTIVITY.ordinary, satiety = 100, toilet = 100) {
  const surcharge = activity === NEED_ACTIVITY.running ? 3 : activity === NEED_ACTIVITY.walking ? 0.5 : 0;
  const urgentRunningMultiplier = activity === NEED_ACTIVITY.running ? toiletExertionMultiplier(toilet) : 1;
  return 5 + surcharge * (1 + 0.5 * hungerPressure(satiety)) * urgentRunningMultiplier;
}

export function physicalActionEnergyCost(baseCost, needs = {}, { repeatedLabour = false } = {}) {
  const hungerMultiplier = 1 + 0.5 * hungerPressure(needs.satiety ?? 100);
  const toiletMultiplier = toiletExertionMultiplier(needs.toilet ?? 100);
  const repetitionMultiplier = repeatedLabour ? 1 + 0.3 * pressure(needs.novelty ?? 100, 30) : 1;
  return Math.max(0, Number(baseCost) || 0) * hungerMultiplier * toiletMultiplier * repetitionMultiplier;
}

export function toiletExertionMultiplier(toilet) {
  return normalizeNeedValue(toilet, 0) <= 25 ? 1.25 : 1;
}

export function energyMovementMultiplier(energy) {
  const value = normalizeNeedValue(energy, 0);
  if (value >= 30) return 1;
  if (value >= 10) return 0.8 + 0.2 * (value - 10) / 20;
  if (value > 0) return 0.6 + 0.2 * value / 10;
  return 0;
}

export function toiletRunningSpeedMultiplier(toilet) {
  return normalizeNeedValue(toilet, 0) <= 25 ? 1.15 : 1;
}

export function lustreMovementMultiplier(lustre) {
  return 1 - 0.5 * pressure(lustre, 33);
}

export function consciousMovementMultiplier(needs = {}) {
  return clamp(
    energyMovementMultiplier(needs.energy) * lustreMovementMultiplier(needs.lustre),
    0.5,
    1,
  );
}

export function canRun(needs = {}) {
  return normalizeNeedValue(needs.energy, 0) >= 20;
}

export function canStartLongAction(needs = {}) {
  return normalizeNeedValue(needs.toilet, 0) >= 20;
}

export function computeNeedRates(activity = {}, tuning) {
  const facility = activity.facility ?? null;
  const lustreNoveltyMultiplier = 1 + 0.5 * pressure(activity.needs?.lustre, 33);
  const dialogueNoveltyMultiplier = 1 + 0.25 * pressure(activity.needs?.dialogue, 30);
  const sharedRest = Boolean(activity.sharedRest);
  return Object.freeze({
    novelty: tuning.novelty.base * lustreNoveltyMultiplier * dialogueNoveltyMultiplier,
    satiety: facility === "table" ? tuning.facilityRecoveryPerGameHour : tuning.satiety.base,
    toilet: facility === "toilet" ? tuning.facilityRecoveryPerGameHour : tuning.toilet.base,
    lustre: facility === "shower" ? tuning.facilityRecoveryPerGameHour : tuning.lustre.base - lustreActivitySurcharge(activity, tuning),
    dialogue: sharedRest ? tuning.dialogue.sharedRest : activity.npcNearby ? 0 : tuning.dialogue.base,
  });
}

export function applyNeedsUpdate(needs, deltaRealSeconds, activity, tuning, { sleeping = false, collapsed = false, protectedNeed = null } = {}) {
  const delta = Number(deltaRealSeconds);
  if (!Number.isFinite(delta) || delta < 0) throw new Error("Needs delta must be a non-negative finite number");
  const gameHours = delta / 60;
  const rates = computeNeedRates({ ...activity, needs }, tuning);
  const effectiveRates = { ...rates };
  for (const id of PERSISTED_NEED_IDS) {
    const activeWhileSleeping = id === "satiety" || id === "toilet" || id === "lustre" || activity?.sharedRest && id === "dialogue";
    const rate = id === protectedNeed && rates[id] < 0 || sleeping && !collapsed && !activeWhileSleeping ? 0 : rates[id];
    effectiveRates[id] = rate;
    needs[id] = normalizeNeedValue(needs[id] + rate * gameHours);
  }
  return createNeedsFlowSnapshot(effectiveRates, tuning);
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

export function applyToiletAccidentConsequences(needs, { witnessed = false } = {}) {
  if (normalizeNeedValue(needs?.toilet) > 0) return null;
  const lustreBefore = normalizeNeedValue(needs.lustre);
  needs.novelty = normalizeNeedValue(needs.novelty - 20);
  if (witnessed) needs.dialogue = normalizeNeedValue(needs.dialogue - 15);
  return Object.freeze({
    type: "toilet-accident",
    witnessed: Boolean(witnessed),
    localScent: true,
    localPuddle: true,
    lustreBefore,
    lustreTarget: normalizeNeedValue(lustreBefore - 45),
  });
}

export function applyToiletAccidentRecovery(needs, progress, { recoveryToilet = 70, lustreBefore, lustreTarget } = {}) {
  const amount = clamp(Number(progress) || 0, 0, 1);
  needs.toilet = normalizeNeedValue(Math.max(0, Number(recoveryToilet) || 0) * amount);
  needs.lustre = normalizeNeedValue(Number(lustreBefore) + (Number(lustreTarget) - Number(lustreBefore)) * amount);
  return Object.freeze({ toilet: needs.toilet, lustre: needs.lustre });
}

export function lustreActivitySurcharge(activity = {}, tuning) {
  const tool = activity.activePhysicalTool
    ?? (activity.activeResourceKind === "log" ? "axe" : ["stone", "ruby"].includes(activity.activeResourceKind) ? "pickaxe" : null);
  if (tool) return Number(tuning.lustre.activitySurcharge?.[tool]) || 0;
  return activity.running ? Number(tuning.lustre.activitySurcharge?.running) || 0 : 0;
}

export function applyDiscreteLustreDelta(needs, delta) {
  const before = normalizeNeedValue(needs?.lustre);
  needs.lustre = normalizeNeedValue(before + (Number(delta) || 0));
  return Object.freeze({ lustreBefore: before, lustre: needs.lustre, delta: needs.lustre - before });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
