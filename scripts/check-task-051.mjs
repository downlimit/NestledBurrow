import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { MELEE_WEAPON_SPRITE_ASSETS } from "../src/assets/meleeWeaponSpriteAssets.js";
import {
  createMeleeStartingWorldItems,
  findTrainingDummyPoint,
  findNearestFreeWorldItemPoint,
  getMeleeWeaponProfile,
  MELEE_COMBAT_ACTION_IDS,
  MELEE_DEBUG_ENABLED,
  MELEE_STARTER_ITEM_OFFSETS,
  MELEE_SWING_DIRECTIONS,
  MELEE_TURN_MODES,
  preloadMeleeAssets,
  resolveMeleeActionItem,
  SWORD_ATTACK_TIME_SCALE,
  TRAINING_DUMMY,
} from "../src/combat/meleeConfig.js";
import {
  advanceMeleeCombat,
  applyTrainingDummyDamage,
  chooseHeavyReversalDirection,
  createAutoTargetSearchSnapshot,
  createMeleeCombatState,
  createMeleeGeometrySnapshot,
  doesMeleeSnapshotIntersectRect,
  effectiveKnockbackDistance,
  isCombatAnchorInMeleeSnapshot,
  knockbackEaseOut,
  meleeBodyCenter,
  resolveAutoTargetDirection,
  queryMeleeTargets,
  requestMeleeAttack,
} from "../src/combat/meleeDomain.js";
import {
  dashDistanceForInterval,
  HELD_WEAPON_SCALE,
  heldWeaponAngleDeg,
  MELEE_HIT_SOUND_STAGGER_MS,
  meleeSectorPoints,
  SWORD_CAMERA_MAX_FOLLOW_SPEED,
  SWORD_SWING_VISUAL_SPEED_MULTIPLIER,
} from "../src/combat/meleeRuntime.js";
import { cameraFollowStep } from "../src/character/cameraFollowRuntime.js";
import {
  INVENTORY_ITEM_IDS,
  INVENTORY_TOOL_IDS,
  createInventoryItem,
  inventoryStackLimit,
} from "../src/inventory/inventoryDomain.js";
import { inventoryItemAsset } from "../src/inventory/inventoryVisuals.js";
import { createFreshGameSessionState, hitResourceNode, SESSION_STATE_VERSION } from "../src/session/gameSessionState.js";
import { DEFAULT_GAMEPLAY_TUNING, RESOURCE_OBJECTS } from "../src/resources/resourceConfig.js";
import { SAVE_SCHEMA_VERSION, deserializeSessionEnvelope, serializeSessionEnvelope } from "../src/session/sessionPersistence.js";
import { aggregateTransientNumber } from "../src/ui/transientNumberPresentation.js";

const sword = getMeleeWeaponProfile("sword");
const axe = getMeleeWeaponProfile("battle-axe");
assert.deepEqual(INVENTORY_TOOL_IDS.slice(-2), ["sword", "battle-axe"]);
assert(INVENTORY_ITEM_IDS.includes("sword") && INVENTORY_ITEM_IDS.includes("battle-axe"));
assert.equal(createInventoryItem("sword").kind, "tool");
assert.equal(createInventoryItem("battle-axe").kind, "tool");
assert.equal(inventoryStackLimit("sword"), 1);
assert.equal(inventoryStackLimit("battle-axe"), 1);
assert.equal(sword.damage, 1);
assert.equal(sword.rangePx, 48);
assert.equal(sword.comboLength, 5);
assert.equal(sword.postComboCooldownMs, 700);
assert.equal(sword.turnMode, MELEE_TURN_MODES.instant);
assert.equal(sword.movementSpeedMultiplier, 1);
assert.equal(sword.autoTargetBlend, 0.75);
assert.equal(sword.autoTargetSearchScale, 1.5);
assert.equal(sword.baseHalfWidthPx, 7);
assert.equal(sword.knockbackDistancePx, 15);
assert.equal(SWORD_ATTACK_TIME_SCALE, 0.85);
assert.equal(sword.forcedMoveDistancePx, 12.75);
assert.equal(MELEE_HIT_SOUND_STAGGER_MS, 50, "multiple hit sounds are staggered by 50 ms");
assert.equal(axe.resourceDamageMultiplier, 0.5, "battle axe deals half peaceful axe damage to logs");
assert.equal(sword.forcedMoveDurationMs, 42.5);
assert.equal(sword.movementLockAfterHitMs, 212.5);
assert.deepEqual(sword.steps.map(({ windupMs, totalDurationMs, hitArcDeg }) => [windupMs, totalDurationMs, hitArcDeg]), [
  [42.5, 255, 45], [42.5, 255, 45], [42.5, 255, 45], [42.5, 255, 45], [42.5, 255, 45],
]);
assert.deepEqual(sword.steps.map(({ swingDirection, trailDurationMs, trailAlpha }) => [swingDirection, trailDurationMs, trailAlpha]), [
  [MELEE_SWING_DIRECTIONS.clockwise, 102, 0.24],
  [MELEE_SWING_DIRECTIONS.counterclockwise, 102, 0.24],
  [MELEE_SWING_DIRECTIONS.clockwise, 119, 0.28],
  [MELEE_SWING_DIRECTIONS.counterclockwise, 102, 0.24],
  [MELEE_SWING_DIRECTIONS.clockwise, 119, 0.30],
]);
assert.equal(axe.damage, 2);
assert.equal(axe.rangePx, 48);
assert.equal(axe.comboLength, 4);
assert.equal(axe.postComboCooldownMs, 1000);
assert.equal(axe.turnMode, MELEE_TURN_MODES.multiplier);
assert.equal(axe.turnSpeedMultiplier, 0.5);
assert.equal(axe.movementSpeedMultiplier, 0.5);
assert.equal(axe.autoTargetBlend, 0);
assert.equal(axe.autoTargetSearchScale, 1);
assert.equal(axe.baseHalfWidthPx, 7);
assert.equal(axe.knockbackDistancePx, 45);
assert.deepEqual(axe.steps.map(({ windupMs, totalDurationMs, hitArcDeg }) => [windupMs, totalDurationMs, hitArcDeg]), [
  [150, 500, 60], [150, 500, 142.5], [150, 500, 225], [150, 500, 360],
]);
assert.equal(axe.steps[1].hitArcDeg, (axe.steps[0].hitArcDeg + axe.steps[2].hitArcDeg) / 2);

const combatResourceSession = createFreshGameSessionState();
const combatLog = RESOURCE_OBJECTS.find((definition) => definition.profileId === "log-small");
const combatEnergyBefore = combatResourceSession.gameplay.currentEnergy;
const combatLogResult = hitResourceNode(combatResourceSession, combatLog.id, {
  action: "chop",
  damage: DEFAULT_GAMEPLAY_TUNING.axeDamage * axe.resourceDamageMultiplier,
  energyPerHit: 0,
  tuning: DEFAULT_GAMEPLAY_TUNING,
});
assert.equal(combatLogResult.progress, 0.5 / DEFAULT_GAMEPLAY_TUNING.smallLogChopHp);
assert.equal(combatLogResult.currentEnergy, combatEnergyBefore, "log-node mutation does not double-charge the accepted melee action");

const loadedUris = [];
preloadMeleeAssets({ load: { image: (key, uri) => loadedUris.push([key, uri]) } });
assert.equal(loadedUris.length, 5);
for (const [key, uri] of loadedUris) {
  const asset = Object.values(MELEE_WEAPON_SPRITE_ASSETS).find((candidate) => candidate.textureKey === key);
  assert.equal(uri, asset.dataUri, `${key} loads the exact data URI`);
}

const manifest = JSON.parse(readFileSync("src/assets/meleeWeaponSpriteAssets.manifest.json", "utf8"));
for (const asset of Object.values(MELEE_WEAPON_SPRITE_ASSETS)) {
  const bytes = Buffer.from(asset.dataUri.split(",")[1], "base64");
  const entry = manifest.assets[asset.sourceName];
  assert(entry, `${asset.sourceName} exists in immutable manifest`);
  assert.equal(bytes.length, entry.byteLength);
  assert.equal(bytes.readUInt32BE(16), entry.width);
  assert.equal(bytes.readUInt32BE(20), entry.height);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
}
assert.deepEqual(manifest.heldPivot, { x: 16, y: 27, originX: 0.5, originY: 0.84375 });
assert.deepEqual(TRAINING_DUMMY.asset.depthAnchor, { x: 8, y: 30 });
assert.deepEqual(TRAINING_DUMMY.asset.collision, { left: 4, top: 24, right: 12, bottom: 31 });
assert.equal(TRAINING_DUMMY.returnMovement.maxSpeed, 43.5, "dummy returns at half the player's normal movement speed");
assert.equal(TRAINING_DUMMY.returnMovement.acceleration, 520);
assert.equal(TRAINING_DUMMY.returnMovement.brakingDeceleration, 620);
assert.equal(TRAINING_DUMMY.blockedPathWaitMs, 3000);
assert.equal(TRAINING_DUMMY.obstacleClearancePx, 16);
assert.deepEqual(TRAINING_DUMMY.hitReaction, { flashMs: 100, heightPx: 2, travelMs: 40, holdMs: 120, totalMs: 200 });
assert.equal(MELEE_DEBUG_ENABLED, false);
assert.equal(HELD_WEAPON_SCALE, 0.5);
assert.equal(SWORD_SWING_VISUAL_SPEED_MULTIPLIER, 3);
assert.equal(SWORD_CAMERA_MAX_FOLLOW_SPEED, 90);
assert.deepEqual(MELEE_COMBAT_ACTION_IDS, ["space", "lmb", "rmb", "shift"]);
const combatItems = new Map([
  ["space", createInventoryItem("sword")],
  ["lmb", createInventoryItem("battle-axe")],
  ["rmb", createInventoryItem("sword")],
  ["shift", createInventoryItem("battle-axe")],
  ["number-1", createInventoryItem("sword")],
]);
assert.deepEqual(
  MELEE_COMBAT_ACTION_IDS.map((id) => resolveMeleeActionItem([id], (actionId) => combatItems.get(actionId))?.id),
  ["sword", "battle-axe", "sword", "battle-axe"],
  "Space, LMB, RMB and Shift each resolve their own combat action slot",
);
assert.equal(resolveMeleeActionItem(["number-1"], (id) => combatItems.get(id)), null, "number and peaceful slots cannot trigger melee");
assert.equal(inventoryItemAsset("sword").textureKey, sword.itemAsset.textureKey);
assert.equal(inventoryItemAsset("battle-axe").textureKey, axe.itemAsset.textureKey);

const layout = {
  spawn: { x: 100, y: 80 },
  bounds: { left: 0, top: 0, right: 200, bottom: 160 },
  getBlockingColliders: () => [],
};
const starters = createMeleeStartingWorldItems(layout);
assert.deepEqual(starters.map((item) => item.item.id), ["sword", "battle-axe"]);
assert(starters.every((item) => item.item.kind === "tool" && item.item.quantity === 1));
const dummyPoint = findTrainingDummyPoint(layout);
assert.deepEqual(dummyPoint, { x: 144, y: 50 }, "training dummy stands beside the spawn with its feet aligned to the player");
assert.deepEqual(starters.map(({ x, y }) => ({ x, y })), [
  { x: dummyPoint.x + MELEE_STARTER_ITEM_OFFSETS.sword.x, y: dummyPoint.y + MELEE_STARTER_ITEM_OFFSETS.sword.y },
  { x: dummyPoint.x + MELEE_STARTER_ITEM_OFFSETS["battle-axe"].x, y: dummyPoint.y + MELEE_STARTER_ITEM_OFFSETS["battle-axe"].y },
], "starter sword and battle axe lie on either side of the training dummy");
const authoredDummy = { x: 152, y: 104 };
assert.deepEqual(createMeleeStartingWorldItems(layout, [], authoredDummy).map(({ x, y }) => ({ x, y })), [
  { x: authoredDummy.x + MELEE_STARTER_ITEM_OFFSETS.sword.x, y: authoredDummy.y + MELEE_STARTER_ITEM_OFFSETS.sword.y },
  { x: authoredDummy.x + MELEE_STARTER_ITEM_OFFSETS["battle-axe"].x, y: authoredDummy.y + MELEE_STARTER_ITEM_OFFSETS["battle-axe"].y },
], "authored dummy placement is the single source for starter weapon positions");
const blockedPreferred = findNearestFreeWorldItemPoint({
  ...layout,
  getBlockingColliders: (box) => box.left < 83 && box.right > 81 ? [{ id: "blocked" }] : [],
}, { x: 82, y: 80 });
assert.notDeepEqual(blockedPreferred, { x: 82, y: 80 });
const fresh = createFreshGameSessionState({ initialWorldItems: starters });
assert.deepEqual(fresh.gameplay.worldItems.map((item) => item.item.id), ["sword", "battle-axe"]);
assert.equal(fresh.gameplay.inventory.slots.some((item) => item?.id === "sword" || item?.id === "battle-axe"), false);
assert.equal(SESSION_STATE_VERSION, 17);
assert.equal(SAVE_SCHEMA_VERSION, 17);
const existing = createFreshGameSessionState();
const restored = deserializeSessionEnvelope(serializeSessionEnvelope(existing)).state;
assert.deepEqual(restored.gameplay.worldItems, [], "existing saves do not receive starter weapons");

const swordState = createMeleeCombatState();
assert.equal(requestMeleeAttack(swordState, "sword", { x: 1, y: 0 }, { x: 0, y: 1 }).status, "started");
assert.equal(swordState.phase, "windup");
assert.deepEqual(swordState.direction, { x: 1, y: 0 });
assert.deepEqual(advanceMeleeCombat(swordState, 42.5).map((event) => event.type), ["hit"]);
assert.equal(swordState.phase, "hit");
assert.equal(requestMeleeAttack(swordState, "sword", { x: 0, y: 1 }, { x: 1, y: 0 }).status, "buffered");
assert.equal(requestMeleeAttack(swordState, "sword", { x: 0, y: 1 }, { x: 1, y: 0 }).status, "buffer-full");
assert.deepEqual(advanceMeleeCombat(swordState, 212.5, {
  readMoveDirection: () => ({ x: 0, y: -1 }),
  readFacing: () => ({ x: 1, y: 0 }),
}).map((event) => event.type), ["step-start"]);
assert.equal(swordState.stepIndex, 1);
assert.deepEqual(swordState.direction, { x: 0, y: -1 }, "buffered step rereads the live movement command");
advanceMeleeCombat(swordState, 42.5);
requestMeleeAttack(swordState, "sword", { x: 0, y: 0 }, { x: -1, y: 0 });
advanceMeleeCombat(swordState, 212.5, {
  readMoveDirection: () => ({ x: 0, y: 0 }),
  readFacing: () => ({ x: -1, y: 0 }),
});
assert.equal(swordState.stepIndex, 2);
assert.deepEqual(swordState.direction, { x: -1, y: 0 }, "zero command falls back to current facing");
for (const expectedStep of [3, 4]) {
  advanceMeleeCombat(swordState, 42.5);
  requestMeleeAttack(swordState, "sword", { x: 1, y: 0 }, { x: 1, y: 0 });
  advanceMeleeCombat(swordState, 212.5, { readMoveDirection: () => ({ x: 1, y: 0 }) });
  assert.equal(swordState.stepIndex, expectedStep);
}
advanceMeleeCombat(swordState, 42.5);
advanceMeleeCombat(swordState, 212.5);
assert.equal(swordState.phase, "cooldown");
assert.equal(swordState.cooldownRemainingMs, 700);
advanceMeleeCombat(swordState, 699);
assert.equal(swordState.phase, "cooldown");
advanceMeleeCombat(swordState, 1);
assert.equal(swordState.phase, "idle");

const weaponSwitchState = createMeleeCombatState();
requestMeleeAttack(weaponSwitchState, "sword", { x: 1, y: 0 }, { x: 0, y: 1 });
advanceMeleeCombat(weaponSwitchState, 42.5);
assert.deepEqual(requestMeleeAttack(weaponSwitchState, "battle-axe", { x: 0, y: -1 }, { x: 1, y: 0 }), {
  status: "switched", accepted: true, previousWeaponId: "sword", weaponId: "battle-axe", stepIndex: 0,
});
assert.equal(weaponSwitchState.weaponId, "battle-axe");
assert.equal(weaponSwitchState.stepIndex, 0);
assert.equal(weaponSwitchState.buffered, false, "switching weapons clears the old combo buffer");
assert.deepEqual(advanceMeleeCombat(weaponSwitchState, 150), [{ type: "hit", weaponId: "battle-axe", stepIndex: 0 }]);

const axeState = createMeleeCombatState();
requestMeleeAttack(axeState, "battle-axe", { x: 0, y: 1 }, { x: 1, y: 0 });
assert.equal(advanceMeleeCombat(axeState, 149).length, 0);
assert.deepEqual(advanceMeleeCombat(axeState, 1).map((event) => event.type), ["hit"]);
assert.equal(axeState.elapsedMs, 150);

const boundaryAngle = 22.5 * Math.PI / 180;
const sector = createMeleeGeometrySnapshot({
  origin: { x: 0, y: 0 },
  facingAxis: { x: 1, y: 0 },
  radius: 48,
  arcDeg: 45,
  baseHalfWidthPx: 7,
  swingDirection: MELEE_SWING_DIRECTIONS.clockwise,
});
const boundary = { x: Math.cos(boundaryAngle) * 48, y: Math.sin(boundaryAngle) * 48 };
assert.equal(isCombatAnchorInMeleeSnapshot(sector, boundary), true, "range and angular boundaries are inclusive");
assert.equal(isCombatAnchorInMeleeSnapshot(sector, { x: boundary.x * 1.001, y: boundary.y * 1.001 }), false);
assert.equal(isCombatAnchorInMeleeSnapshot(sector, { x: 0, y: 6 }), true, "wide flat base crosses the character body");
assert.equal(isCombatAnchorInMeleeSnapshot(sector, { x: -0.01, y: 0 }), false, "hybrid shape does not damage behind its flat base");
assert.equal(doesMeleeSnapshotIntersectRect(sector, { left: 36, top: -4, right: 44, bottom: 4 }), true, "sword shape intersects a stone collider in front");
assert.equal(doesMeleeSnapshotIntersectRect(sector, { left: -12, top: -4, right: -4, bottom: 4 }), false, "stone collider behind the sword does not ring");
const fullCircle = createMeleeGeometrySnapshot({ ...sector, arcDeg: 360 });
assert.equal(isCombatAnchorInMeleeSnapshot(fullCircle, { x: -16, y: 0 }), true);
const alreadyHit = new Set();
const target = { id: "dummy", combatAnchor: { x: 48, y: 0 } };
assert.equal(queryMeleeTargets(sector, [target], alreadyHit).length, 1);
alreadyHit.add("dummy");
assert.equal(queryMeleeTargets(sector, [target], alreadyHit).length, 0, "one target is returned once per step");
assert.equal(queryMeleeTargets(fullCircle, [
  { id: "left", combatAnchor: { x: -10, y: 0 } },
  { id: "right", combatAnchor: { x: 10, y: 0 } },
]).length, 2, "one step can hit multiple targets");
assert.deepEqual(applyTrainingDummyDamage("dummy", 1), {
  status: "damaged", targetId: "dummy", damage: 1, acceptedDamage: 1, defeated: false, knockback: true, mutated: false,
});
assert.equal(applyTrainingDummyDamage("dummy", 2).acceptedDamage, 2);
assert.deepEqual(meleeBodyCenter({ x: 40, y: 50 }), { x: 40, y: 42 });
const swordSearch = createAutoTargetSearchSnapshot(sector, sword.autoTargetSearchScale);
assert.equal(swordSearch.radius, 72);
assert.equal(swordSearch.arcDeg, 67.5);
assert.equal(swordSearch.baseHalfWidthPx, 10.5);
const outsideAttackAngle = 30 * Math.PI / 180;
const searchOnlyTarget = { id: "search-only", combatAnchor: { x: Math.cos(outsideAttackAngle) * 40, y: Math.sin(outsideAttackAngle) * 40 } };
assert.equal(queryMeleeTargets(sector, [searchOnlyTarget]).length, 0, "target starts outside the real sword damage shape");
assert.equal(queryMeleeTargets(swordSearch, [searchOnlyTarget]).length, 1, "sword acquisition shape is 1.5x larger");
const oneTargetAim = resolveAutoTargetDirection(swordSearch, [searchOnlyTarget], sword.autoTargetBlend);
assert.equal(oneTargetAim.targets.length, 1);
assert(oneTargetAim.direction.y > 0.36, "sword blends 75% toward one target");
const twoTargetAim = resolveAutoTargetDirection(sector, [
  { id: "upper", combatAnchor: { x: 40, y: 16 } },
  { id: "lower", combatAnchor: { x: 40, y: -16 } },
], sword.autoTargetBlend);
assert.deepEqual(twoTargetAim.direction, { x: 1, y: 0 }, "two targets aim at their midpoint before blending");
const upperReversal = chooseHeavyReversalDirection(
  { x: 1, y: 0 }, { x: -1, y: 0 }, [{ id: "north", combatAnchor: { x: 0, y: -20 } }], { x: 0, y: 0 },
);
assert(upperReversal.y < 0, "heavy 180-degree reversal starts across the side nearest the target");
assert.equal(effectiveKnockbackDistance(45, 0), 45);
assert.equal(effectiveKnockbackDistance(45, 0.5), 22.5);
assert.equal(effectiveKnockbackDistance(45, 1), 0);
assert(knockbackEaseOut(0.25) > 0.5 && knockbackEaseOut(0.75) > 0.9, "knockback starts sharply and eases out");

assert.equal(dashDistanceForInterval(sword, 0, 21.25), 6.375);
assert.equal(dashDistanceForInterval(sword, 21.25, 21.25), 6.375);
assert.equal(dashDistanceForInterval(sword, 42.5, 50), 0);
assert.equal(dashDistanceForInterval(axe, 0, 500), 0);
const swordAngleState = { weaponId: "sword", stepIndex: 0, direction: { x: 1, y: 0 } };
assert.equal(heldWeaponAngleDeg({ ...swordAngleState, elapsedMs: 42.5 }, sword), 67.5, "sword holds its start pose through windup");
assert.equal(heldWeaponAngleDeg({ ...swordAngleState, elapsedMs: 59.5 }, sword), 90, "sword crosses the sector midpoint at triple visual speed");
assert.equal(heldWeaponAngleDeg({ ...swordAngleState, elapsedMs: 76.5 }, sword), 112.5, "sword finishes its visual swing at triple speed");
assert.equal(meleeSectorPoints(sector).length, 23);
assert.deepEqual(meleeSectorPoints(sector)[0], { x: 0, y: -7 });
assert.deepEqual(meleeSectorPoints(sector).at(-1), { x: 0, y: 7 });
assert.deepEqual(meleeSectorPoints(fullCircle), []);
assert.equal(Number.isFinite(heldWeaponAngleDeg({ ...axeState, elapsedMs: 250 }, axe)), true);

const limitedCamera = cameraFollowStep({
  presentation: { x: 0, y: 0 },
  back: { x: 0, y: 0 },
  front: { x: 0, y: 0 },
  target: { x: 0, y: 0 },
  progress: 1,
  moving: true,
}, {
  presentationPosition: { x: 20, y: 0 },
  speed: 144,
  movingSpeedThreshold: 2,
  deltaSeconds: 0.05,
  maxPresentationSpeed: SWORD_CAMERA_MAX_FOLLOW_SPEED,
});
assert.equal(limitedCamera.presentation.x, 4.5, "sword dash camera input is limited to normal walking speed");
assert.equal(limitedCamera.target.x, 4.5, "camera lead output is capped too, preventing a sprint-to-dash camera snap");

const damageTotals = new Map();
assert.equal(aggregateTransientNumber(damageTotals, {
  key: "dummy", amount: 1, nowMs: 100, targetId: "dummy",
}, 1000).amount, 1);
assert.equal(aggregateTransientNumber(damageTotals, {
  key: "dummy", amount: 1, nowMs: 400, targetId: "dummy",
}, 1000).amount, 2);
assert.equal(aggregateTransientNumber(damageTotals, {
  key: "dummy", amount: 1, nowMs: 700, targetId: "dummy",
}, 1000).amount, 3);
damageTotals.clear();
assert.deepEqual([2, 2, 2, 2].map((amount, index) => aggregateTransientNumber(damageTotals, {
  key: "dummy", amount, nowMs: index * 500, targetId: "dummy",
}, 1000).amount), [2, 4, 6, 8]);

const main = readFileSync("src/main.js", "utf8");
const locationRuntime = readFileSync("src/world/worldLocationRuntime.js", "utf8");
const worldBuildCoordinator = readFileSync("src/build/worldBuildCoordinator.js", "utf8");
const gameHud = readFileSync("src/ui/gameHud.js", "utf8");
const combatLoadout = readFileSync("src/combat/combatLoadoutRuntime.js", "utf8");
assert(locationRuntime.includes("melee: createMeleeRuntime") && locationRuntime.includes("this.factories.melee(this.renderingHost"));
assert(main.includes("getControllerMoveDirection: () => this.getControllerMoveDirection()"));
assert(locationRuntime.includes("this.owners.meleeRuntime?.beforeCharacterUpdate?.(deltaMs)"));
assert(locationRuntime.includes("this.owners.meleeRuntime?.afterCharacterUpdate?.(deltaMs)"));
assert(main.includes("getCombatActionItem"), "melee resolves weapons from combat action slots");
assert(main.includes("getFrameMeleeItem: () => this.frameMeleeItem")
  && locationRuntime.includes("getSelectedItem: () => this.callbacks.getFrameMeleeItem?.()"), "melee runtime receives only the pressed combat action item");
assert(main.includes("consumePointerAction") && main.includes('shiftPressed ? "shift" : null'), "LMB, RMB, Space and Shift share the combat action route");
assert(main.includes("primary: Boolean(this.frameMeleeItem) && !this.suppressNextInteract"), "stable combat mode permits its resolved melee action");
assert(main.includes("maxPresentationSpeed: this.meleeRuntime?.getCameraFollowSpeedLimit?.()"), "camera smoothing is enabled only by the active melee runtime");
assert(locationRuntime.includes("playEffect: (type) => this.globalOwners.audioRuntime?.playEffect?.(type)"), "melee hit timing routes synthetic SFX through the shared audio runtime");
assert(worldBuildCoordinator.includes("getBuildMoveTargetAt")
  && worldBuildCoordinator.includes("moveBuildTarget")
  && worldBuildCoordinator.includes("restoreBuildTarget"), "build move updates and undoes the dummy home anchor");
assert(gameHud.includes("mode.mode !== INVENTORY_MODES.COMBAT"), "combat action lookup is disabled outside stable combat HUD mode");
assert(combatLoadout.includes('slot.kind === "action" && slot.id === actionId'), "number slots cannot resolve as combat actions");
assert(!readFileSync("src/combat/meleeRuntime.js", "utf8").includes("addEventListener"));
const meleeRuntime = readFileSync("src/combat/meleeRuntime.js", "utf8");
assert(meleeRuntime.includes("getStartingLayoutFurniture") && meleeRuntime.includes("restoreStartingLayoutFurniture"), "training dummy is canonical-layout furniture");
assert(meleeRuntime.includes('result.status === "started" || result.status === "switched"'), "switching weapons immediately starts the new presentation");
assert(meleeRuntime.includes("activeTrails") && meleeRuntime.includes("meleeBodyCenter(getPlayerCharacter()?.motor?.position)"), "melee shapes follow the player's body center");
assert(meleeRuntime.includes("movementSpeedMultiplier") && meleeRuntime.includes("updateKnockbacks(deltaMs)") && meleeRuntime.includes("updateDummyReturn(deltaMs)"));
assert(meleeRuntime.includes("createActorNavigation") && meleeRuntime.includes("findGridPath"), "dummy return uses collision-aware A*");
assert(meleeRuntime.includes("isDummyPathBlocked") && meleeRuntime.includes("blockedWaitMs >= TRAINING_DUMMY.blockedPathWaitMs"), "dummy waits one cell before a blocker for three seconds before replanning");
assert(meleeRuntime.includes("dummyNavigationEnvironment(true)") && meleeRuntime.includes("getFootBox(motor.position"), "dummy movement preserves player collision");
assert(meleeRuntime.includes("ensureWhiteSilhouetteTexture") && meleeRuntime.includes("trainingDummy.flashSprite.setVisible(true)") && meleeRuntime.includes(".setAlpha(0.7)"), "dummy shows a 70%-opaque renderer-independent white silhouette on hit");
assert(meleeRuntime.includes("hold: TRAINING_DUMMY.hitReaction.holdMs") && meleeRuntime.includes("yoyo: true"), "dummy hit hop holds at its peak and lands within the 200 ms reaction");
assert(meleeRuntime.includes('groupKey === "resource:ruby-node"') && meleeRuntime.includes('"melee-metal-ring"'), "sword and battle axe ring when their real shape intersects stone or ruby");
assert(meleeRuntime.includes('startsWith("resource:log-")') && meleeRuntime.includes('"melee-log-thud"'), "logs produce a dull melee impact");
assert(meleeRuntime.includes("index * MELEE_HIT_SOUND_STAGGER_MS"), "multiple hit sounds from one swing use the shared stagger interval");
assert(meleeRuntime.includes('hitEffect: "training-dummy-hit"') && meleeRuntime.includes("target.hitEffect ?? combatEffect"), "training dummy routes its own impact sound through the shared stagger queue");
assert(locationRuntime.includes("damageLog: (resourceId, multiplier)") && meleeRuntime.includes("profile.resourceDamageMultiplier"), "battle axe resource damage routes only through log damage");
const persistence = readFileSync("src/session/sessionPersistence.js", "utf8");
assert(!persistence.includes('"sword"') && !persistence.includes('"battle-axe"'), "save migration does not inject melee weapons");

console.log("Task #051 checks passed: owned asset integrity, starter drops, timing, buffer, geometry, dash, dummy and damage aggregation");
