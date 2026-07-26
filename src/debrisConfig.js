import { TILE_SIZE } from "./worldConfig.js";

export { DEFAULT_GAMEPLAY_TUNING, normalizeGameplayTuning } from "./resourceConfig.js";
export const BED_INTERACTION_KIND = "sleep-bed";
export const BED_OBJECT_ID = "home-bed-01";
export const BED_WAKE_TILE = Object.freeze({ x: 32, y: 15 });
export const BED_WAKE_POSITION = Object.freeze({ x: BED_WAKE_TILE.x * TILE_SIZE + TILE_SIZE / 2, y: BED_WAKE_TILE.y * TILE_SIZE + TILE_SIZE / 2 });
export const BED_ASSET = Object.freeze({
  key: "furniture.bed",
  path: "assets/project/facilities/NestledBurrow_Bed.png",
  width: TILE_SIZE,
  height: TILE_SIZE,
});
export const BED_OBJECT = Object.freeze({
  id: BED_OBJECT_ID, entityId: BED_OBJECT_ID, roomId: "home", kind: BED_INTERACTION_KIND,
  position: Object.freeze({ x: 32 * TILE_SIZE + TILE_SIZE / 2, y: 14 * TILE_SIZE + TILE_SIZE / 2 }),
  radius: 26, priority: 2, requiresFacing: true, facingDotThreshold: -0.2,
  prompt: "hud:interaction.sleep", payload: Object.freeze({ bedId: BED_OBJECT_ID }),
});
