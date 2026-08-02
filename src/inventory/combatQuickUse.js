const NUMBER_SLOT_START = 4;
const NUMBER_SLOT_END = 9;

export const COMBAT_QUICK_USE_PROFILES = Object.freeze({
  "fried-potato-dish": Object.freeze({ needId: "satiety", amount: 25, consumeItem: true }),
  "water-bucket": Object.freeze({ needId: "lustre", amount: 20, consumeWater: 1 }),
});

export function useCombatNumberSlot(gameplay, slotIndex) {
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
    bucket.currentWater -= profile.consumeWater;
  }
  needs[profile.needId] = Math.min(100, current + profile.amount);
  if (profile.consumeItem) {
    if (item.quantity > 1) item.quantity -= 1;
    else slots[slotIndex] = null;
  }
  return {
    status: "used",
    mutated: true,
    itemId: item.id,
    needId: profile.needId,
    amount: needs[profile.needId] - current,
    messageKey: item.id === "water-bucket" ? "hud:quickUse.washed" : "hud:quickUse.ateRation",
  };
}
