import { normalizeNeedValue } from "../needs/needsDomain.js";

const NUMBER_SLOT_START = 4;
const NUMBER_SLOT_END = 9;

export const COMBAT_QUICK_USE_PROFILES = Object.freeze({
  "fried-potato-dish": Object.freeze({ needId: "satiety", amount: 25, consumeItem: true }),
  "water-bucket": Object.freeze({
    needId: "lustre",
    amount: 20,
    consumeWater: 1,
    needDeltas: Object.freeze({ toilet: -5 }),
    repetitionKey: "water-bucket",
    spawnPuddle: true,
  }),
});

export function useCombatNumberSlot(gameplay, slotIndex, context = {}) {
  if (!gameplay || !Number.isInteger(slotIndex) || slotIndex < NUMBER_SLOT_START || slotIndex > NUMBER_SLOT_END) {
    return { status: "invalid-slot", mutated: false, messageKey: "hud:quickUse.unsupported" };
  }
  const slots = gameplay.combatLoadout?.slots;
  const item = slots?.[slotIndex] ?? null;
  if (!item) return { status: "empty-slot", mutated: false, messageKey: "hud:quickUse.empty" };
  const profile = COMBAT_QUICK_USE_PROFILES[item.id];
  if (!profile) return { status: "unsupported-item", mutated: false, messageKey: "hud:quickUse.unsupported" };
  const needs = gameplay.needs;
  const current = Number(needs?.[profile.needId]);
  if (!Number.isFinite(current) || current >= 100) {
    return { status: "need-full", mutated: false, messageKey: "hud:quickUse.needFull" };
  }
  if (profile.consumeWater) {
    const bucket = gameplay.farm?.waterBucket;
    if (!bucket || Number(bucket.currentWater) < profile.consumeWater) {
      return { status: "bucket-empty", mutated: false, messageKey: "hud:quickUse.bucketEmpty" };
    }
  }
  const needBefore = normalizeNeedValue(needs[profile.needId]);
  const noveltyBefore = normalizeNeedValue(needs.novelty);
  const toiletBefore = normalizeNeedValue(needs.toilet);
  if (profile.consumeWater) gameplay.farm.waterBucket.currentWater -= profile.consumeWater;
  needs[profile.needId] = normalizeNeedValue(needBefore + profile.amount);
  for (const [needId, delta] of Object.entries(profile.needDeltas ?? {})) {
    needs[needId] = normalizeNeedValue(normalizeNeedValue(needs[needId]) + delta);
  }
  if (profile.consumeItem) {
    if (item.quantity > 1) item.quantity -= 1;
    else slots[slotIndex] = null;
  }
  const repetition = profile.repetitionKey
    ? context.recordSelfUse?.(profile.repetitionKey, { drainsNovelty: true }) ?? null
    : context.recordSelfUse?.(item.id) ?? null;
  return {
    status: "used",
    mutated: true,
    itemId: item.id,
    needId: profile.needId,
    amount: normalizeNeedValue(needs[profile.needId]) - needBefore,
    toiletDelta: normalizeNeedValue(needs.toilet) - toiletBefore,
    noveltyDelta: normalizeNeedValue(needs.novelty) - noveltyBefore,
    spawnPuddle: Boolean(profile.spawnPuddle),
    consecutiveSelfUses: repetition?.consecutiveSelfUses ?? 1,
    messageKey: item.id === "water-bucket" ? "hud:quickUse.washed" : "hud:quickUse.ateRation",
  };
}
