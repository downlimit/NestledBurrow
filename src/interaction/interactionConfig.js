export const SEED_MERCHANT_INTERACTION_KIND = "seed-merchant-shop";
export const WORLD_OBJECT_ATTENTION_GROUP = "world-object";
export const WORLD_PLACEABLE_TARGETING_GROUP = "world-placeable";
export const WORLD_OBJECT_ATTENTION_DOT_THRESHOLD = 0.25;

export const INTERACTION_DEFINITIONS = deepFreeze([{
  id: "open-seed-merchant",
  entityId: "seed-merchant",
  kind: SEED_MERCHANT_INTERACTION_KIND,
  radius: 24,
  priority: 5,
  requiresFacing: true,
  facingDotThreshold: 0,
  prompt: "hud:interaction.openSeedShop",
  promptKey: "hud:interaction.openSeedShop",
  payload: {},
}]);

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
