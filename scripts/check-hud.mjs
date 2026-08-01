import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FULLSCREEN_HIT_AREA, FULLSCREEN_PANEL_AREA, HUD_GLYPHS, compactBuildLabel, isPointInRect, measureBitmapText } from "../src/hud.js";
import {
  CLOCK_HUD_AREA,
  COIN_HUD_AREA,
  ENERGY_HUD_AREA,
  NEEDS_HUD_AREA,
  NEED_ROW_AREAS,
  NEED_ROW_IDS,
  NEED_ROW_SYMBOLS,
  NEED_TOOLTIP_AREA,
  LANGUAGE_HIT_AREA,
  NEW_GAME_CANCEL_HIT_AREA,
  NEW_GAME_CONFIRM_HIT_AREA,
  NEW_GAME_CONFIRM_PANEL,
  NEW_GAME_HIT_AREA,
  OPTIONS_BUILD_LABEL,
  OPTIONS_HIT_AREA,
  OPTIONS_PANEL_AREA,
  SOUND_SLIDER_RECTS,
  isEnergyCritical,
  needFlowPhaseOffset,
  needFlowPulseAlpha,
  shouldShakeEnergyAfterInteraction,
} from "../src/gameHud.js";
import { NEED_FLOW_PULSE_TUNING } from "../src/presentationTuning.js";
import { INVENTORY_HUD_AREA, INVENTORY_SLOT_AREAS } from "../src/inventoryRuntime.js";
import {
  COMBAT_PANEL_AREA,
  COMBAT_SLOT_DEFINITIONS,
  INVENTORY_MODE_LAYOUTS,
  INVENTORY_MODES,
  PEACEFUL_EAR_AREA,
  transformPresentationRect,
} from "../src/inventoryModeRuntime.js";
import {
  THROW_AIM_RADIUS,
  THROW_AIM_SIZE,
  createThrowAimIndicator,
  throwAimPixels,
  throwAimPose,
} from "../src/throwAimIndicator.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

const DIALOGUE_TOP = GAME_HEIGHT - 64;
const rects = [
  OPTIONS_HIT_AREA,
  CLOCK_HUD_AREA,
  FULLSCREEN_HIT_AREA,
  OPTIONS_PANEL_AREA,
  LANGUAGE_HIT_AREA,
  NEW_GAME_HIT_AREA,
  INVENTORY_HUD_AREA,
  ...INVENTORY_SLOT_AREAS,
  COMBAT_PANEL_AREA,
  ...COMBAT_SLOT_DEFINITIONS.map(({ x, y, width, height }) => ({ x, y, width, height })),
  PEACEFUL_EAR_AREA,
  ENERGY_HUD_AREA,
  NEEDS_HUD_AREA,
  NEED_TOOLTIP_AREA,
  ...NEED_ROW_AREAS,
  NEW_GAME_CONFIRM_PANEL,
  NEW_GAME_CONFIRM_HIT_AREA,
  NEW_GAME_CANCEL_HIT_AREA,
  ...Object.values(SOUND_SLIDER_RECTS),
];

for (const rect of rects) {
  for (const value of Object.values(rect)) assert(Number.isInteger(value), "HUD geometry aligns to whole logical pixels");
  assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= GAME_WIDTH && rect.y + rect.height <= GAME_HEIGHT, "GameHud rectangle stays inside logical viewport");
}

assert.equal(CLOCK_HUD_AREA.x + CLOCK_HUD_AREA.width / 2, GAME_WIDTH / 2, "clock panel is centered against the viewport");
assert(OPTIONS_HIT_AREA.x + OPTIONS_HIT_AREA.width < CLOCK_HUD_AREA.x, "Options and centered clock are separate top zones");
assert(CLOCK_HUD_AREA.x + CLOCK_HUD_AREA.width < FULLSCREEN_HIT_AREA.x, "centered clock and fullscreen are separate top zones");
assert.equal(FULLSCREEN_HIT_AREA.width, 30, "fullscreen hit area remains touch sized");
assert.equal(COIN_HUD_AREA.y, FULLSCREEN_PANEL_AREA.y, "coin panel aligns vertically with the visible fullscreen button");
assert.equal(COIN_HUD_AREA.height, FULLSCREEN_PANEL_AREA.height, "coin panel matches the visible fullscreen button height");
assert.equal(INVENTORY_SLOT_AREAS.length, 10, "hotbar exposes ten slots");
assert.equal(INVENTORY_HUD_AREA.x, 43, "hotbar shifts two pixels right to separate its standard first-slot outline from the Q/E ear");
assert.equal(INVENTORY_HUD_AREA.x + INVENTORY_HUD_AREA.width, 281, "shifted hotbar remains inside the 320 px viewport");
assert.equal(PEACEFUL_EAR_AREA.x + PEACEFUL_EAR_AREA.width, INVENTORY_HUD_AREA.x - 1, "Q/E ear leaves one logical pixel before the standard first-slot outline");
assert.deepEqual(COMBAT_SLOT_DEFINITIONS.map(({ label }) => label), ["SPACE", "LMB", "RMB", "SHIFT", "1", "2", "3", "4", "5", "6"]);
assert.equal(COMBAT_SLOT_DEFINITIONS.length, 10, "combat HUD exposes four action slots and six numbered slots");
const loadoutLayout = INVENTORY_MODE_LAYOUTS[INVENTORY_MODES.LOADOUT_EDIT];
const loadoutPeacefulRect = transformPresentationRect(INVENTORY_HUD_AREA, loadoutLayout.peaceful);
const loadoutCombatRect = transformPresentationRect(COMBAT_PANEL_AREA, loadoutLayout.combat);
assert(loadoutPeacefulRect.y + loadoutPeacefulRect.height < loadoutCombatRect.y, "loadout panels remain vertically separated at 320x180");
assert.equal(loadoutLayout.peaceful.alpha, 1);
assert.equal(loadoutLayout.combat.alpha, 1);
assert.equal(THROW_AIM_SIZE, 8, "throw aim is exactly 8x8 logical pixels");
assert.equal(THROW_AIM_RADIUS, 12, "throw aim orbits twelve logical pixels from the lower-torso pivot");
assert.deepEqual(throwAimPose({ x: 10, y: 20, displayHeight: 12 }, { x: 20, y: 16 }), {
  x: 22,
  y: 16,
  rotation: 0,
  direction: { x: 1, y: 0 },
  pivot: { x: 10, y: 16 },
});
const upwardThrowAim = throwAimPose({ x: 10, y: 20, displayHeight: 12 }, { x: 10, y: 0 });
assert.equal(upwardThrowAim.x, 10);
assert.equal(upwardThrowAim.y, 4);
assert.equal(upwardThrowAim.rotation, -Math.PI / 2);
const rightThrowAimPixels = throwAimPixels({ x: 1, y: 0 });
assert(rightThrowAimPixels.length > 8, "eight-pixel aim has a readable triangular silhouette");
assert(rightThrowAimPixels.some(({ inner }) => inner), "pixel aim preserves a bright interior");
assert(rightThrowAimPixels.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)), "pixel aim contains only sharp whole-pixel cells");
assert(rightThrowAimPixels.every(({ x, y }) => x >= -4 && x < 4 && y >= -4 && y < 4), "pixel aim stays inside its 8x8 bounds");
const throwAimEvents = new Map();
const throwAimGraphics = {
  visible: false,
  x: 0,
  y: 0,
  rotation: 0,
  destroyed: false,
  setVisible(value) { this.visible = value; return this; },
  clear() { return this; },
  fillStyle() { return this; },
  fillRect() { return this; },
  setPosition(x, y) { this.x = x; this.y = y; return this; },
  setRotation(value) { this.rotation = value; return this; },
  setDepth() { return this; },
  destroy() { this.destroyed = true; },
};
const throwAimCharacter = { sprite: { x: 10, y: 20, displayHeight: 12 }, lastFacing: "down" };
const throwAimRuntime = createThrowAimIndicator({
  add: { graphics: () => throwAimGraphics },
  events: {
    on(name, callback) { throwAimEvents.set(name, callback); },
    off(name, callback) { if (throwAimEvents.get(name) === callback) throwAimEvents.delete(name); },
  },
}, { getPlayerCharacter: () => throwAimCharacter });
throwAimRuntime.show({ x: 20, y: 16 });
assert.deepEqual(throwAimRuntime.getState(), {
  visible: true,
  x: 22,
  y: 16,
  rotation: 0,
  pivot: { x: 10, y: 16 },
  size: 8,
  radius: 12,
  target: { x: 20, y: 16 },
});
throwAimCharacter.sprite.x = 14;
throwAimEvents.get("update")();
assert.equal(throwAimRuntime.getState().x, 26, "throw aim follows the moving player pivot each frame");
throwAimRuntime.hide();
assert.equal(throwAimRuntime.getState().visible, false);
throwAimRuntime.destroy();
assert.equal(throwAimEvents.has("update"), false, "throw aim releases its frame listener");
assert.equal(throwAimGraphics.destroyed, true);
assert(INVENTORY_HUD_AREA.y + INVENTORY_HUD_AREA.height <= GAME_HEIGHT - 2, "hotbar keeps a bottom edge margin");
for (let index = 0; index < INVENTORY_SLOT_AREAS.length; index += 1) {
  const slot = INVENTORY_SLOT_AREAS[index];
  assert.equal(slot.width, 22, "each inventory slot remains touch-sized");
  assert.equal(slot.height, 22, "each inventory slot remains touch-sized");
  assert(isPointInRect(slot.x + 1, slot.y + 1, INVENTORY_HUD_AREA), "slot starts inside hotbar");
  assert(isPointInRect(slot.x + slot.width - 1, slot.y + slot.height - 1, INVENTORY_HUD_AREA), "slot fits inside hotbar");
}
assert(NEEDS_HUD_AREA.x + NEEDS_HUD_AREA.width <= GAME_WIDTH - 8, "right HUD keeps an edge margin");
assert(NEEDS_HUD_AREA.y + NEEDS_HUD_AREA.height < DIALOGUE_TOP, "needs stay above dialogue UI");
assert.deepEqual(NEED_ROW_SYMBOLS.join(""), "NESTLD", "six rows use canonical NESTLD order");
assert.equal(NEED_ROW_IDS.length, 6);
for (const row of NEED_ROW_AREAS) {
  assert(isPointInRect(row.x + 1, row.y + 1, NEEDS_HUD_AREA), "need row hit zone starts inside block");
  assert(isPointInRect(row.x + row.width - 1, row.y + row.height - 1, NEEDS_HUD_AREA), "need row hit zone fits inside block");
}
assert(NEED_TOOLTIP_AREA.x + NEED_TOOLTIP_AREA.width < NEEDS_HUD_AREA.x, "tooltip opens left of needs block");
assert(OPTIONS_PANEL_AREA.y + OPTIONS_PANEL_AREA.height <= DIALOGUE_TOP, "Options panel stays above dialogue UI");
for (const rect of [LANGUAGE_HIT_AREA, NEW_GAME_HIT_AREA, ...Object.values(SOUND_SLIDER_RECTS)]) {
  assert(isPointInRect(rect.x + 1, rect.y + 1, OPTIONS_PANEL_AREA), "Options controls stay inside their panel");
  assert(isPointInRect(rect.x + rect.width - 1, rect.y + rect.height - 1, OPTIONS_PANEL_AREA), "Options controls fit completely inside their panel");
}
assert(OPTIONS_BUILD_LABEL.x >= OPTIONS_PANEL_AREA.x && OPTIONS_BUILD_LABEL.y >= OPTIONS_PANEL_AREA.y, "build label starts inside Options");
assert(OPTIONS_BUILD_LABEL.x + measureBitmapText(compactBuildLabel("4e090db123")) <= OPTIONS_PANEL_AREA.x + OPTIONS_PANEL_AREA.width, "build label fits inside Options");
assert(NEW_GAME_CONFIRM_PANEL.y + NEW_GAME_CONFIRM_PANEL.height <= DIALOGUE_TOP, "confirmation stays above dialogue UI");
assert(isPointInRect(NEW_GAME_CONFIRM_HIT_AREA.x + 2, NEW_GAME_CONFIRM_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "confirm action stays inside confirmation panel");
assert(isPointInRect(NEW_GAME_CANCEL_HIT_AREA.x + 2, NEW_GAME_CANCEL_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "cancel action stays inside confirmation panel");

assert.equal(shouldShakeEnergyAfterInteraction({ mutated: true, energyBefore: 16, currentEnergy: 12, maximumEnergy: 100 }), true);
assert.equal(shouldShakeEnergyAfterInteraction({ mutated: true, energyBefore: 19, currentEnergy: 15, maximumEnergy: 100 }), false);
assert.equal(shouldShakeEnergyAfterInteraction({ mutated: false, energyBefore: 3, currentEnergy: 3, maximumEnergy: 100 }), false);
assert.equal(isEnergyCritical(14, 100), true);
assert.equal(isEnergyCritical(15, 100), false);
assert.deepEqual(Object.fromEntries(Object.entries(NEED_FLOW_PULSE_TUNING).map(([tier, profile]) => [tier, profile.cycleMs])), {
  slow: 4500,
  medium: 4000,
  strong: 3500,
});
assert.deepEqual(Object.fromEntries(Object.entries(NEED_FLOW_PULSE_TUNING).map(([tier, profile]) => [tier, profile.transparentHoldMs])), {
  slow: 3000,
  medium: 1750,
  strong: 500,
});
assert.deepEqual(Object.fromEntries(Object.entries(NEED_FLOW_PULSE_TUNING).map(([tier, profile]) => [tier, profile.cycleMs - profile.transparentHoldMs])), {
  slow: 1500,
  medium: 2250,
  strong: 3000,
});
assert(Object.values(NEED_FLOW_PULSE_TUNING).every(({ fadeInMs, fadeOutMs }) => fadeInMs === 180 && fadeOutMs === 180), "fade-in and fade-out stay constant across flow tiers");
assert.equal(NEED_FLOW_PULSE_TUNING.medium.transparentHoldMs, (NEED_FLOW_PULSE_TUNING.slow.transparentHoldMs + NEED_FLOW_PULSE_TUNING.strong.transparentHoldMs) / 2);
assert.equal(NEED_FLOW_PULSE_TUNING.medium.cycleMs - NEED_FLOW_PULSE_TUNING.medium.transparentHoldMs, ((NEED_FLOW_PULSE_TUNING.slow.cycleMs - NEED_FLOW_PULSE_TUNING.slow.transparentHoldMs) + (NEED_FLOW_PULSE_TUNING.strong.cycleMs - NEED_FLOW_PULSE_TUNING.strong.transparentHoldMs)) / 2);
assert(Object.isFrozen(NEED_FLOW_PULSE_TUNING) && Object.values(NEED_FLOW_PULSE_TUNING).every(Object.isFrozen), "need pulse tuning is deeply immutable");
const pulseAtPhase = (arrows, phase, seed = "energy") => {
  const profile = [null, NEED_FLOW_PULSE_TUNING.slow, NEED_FLOW_PULSE_TUNING.medium, NEED_FLOW_PULSE_TUNING.strong][arrows];
  return needFlowPulseAlpha(arrows, phase - needFlowPhaseOffset(seed, profile.cycleMs), seed);
};
for (const [arrows, profile] of Object.values(NEED_FLOW_PULSE_TUNING).map((profile, index) => [index + 1, profile])) {
  const fadeIn = [0, 0.25, 0.5, 0.75, 1].map((part) => pulseAtPhase(arrows, profile.fadeInMs * part));
  assert(fadeIn.every((alpha, index) => index === 0 || alpha >= fadeIn[index - 1]), `tier ${arrows} fade-in is monotonic`);
  assert.equal(fadeIn[0], 0);
  assert.equal(fadeIn.at(-1), profile.peakAlpha);
  assert.equal(pulseAtPhase(arrows, profile.fadeInMs + profile.peakHoldMs / 2), profile.peakAlpha, `tier ${arrows} holds peak alpha`);
  const fadeOutStart = profile.fadeInMs + profile.peakHoldMs;
  const fadeOut = [0, 0.25, 0.5, 0.75, 1].map((part) => pulseAtPhase(arrows, fadeOutStart + profile.fadeOutMs * part));
  assert(fadeOut.every((alpha, index) => index === 0 || alpha <= fadeOut[index - 1]), `tier ${arrows} fade-out is monotonic`);
  assert.equal(fadeOut[0], profile.peakAlpha);
  assert.equal(fadeOut.at(-1), 0);
  assert.equal(pulseAtPhase(arrows, profile.cycleMs - profile.transparentHoldMs / 2), 0, `tier ${arrows} transparent hold is exact zero`);
}
const needPhaseOffsets = NEED_ROW_IDS.map((id) => needFlowPhaseOffset(id, NEED_FLOW_PULSE_TUNING.medium.cycleMs));
assert.equal(new Set(needPhaseOffsets).size, NEED_ROW_IDS.length, "need rows have distinct stable phase offsets");
assert.deepEqual(NEED_ROW_IDS.map((id) => needFlowPhaseOffset(id, NEED_FLOW_PULSE_TUNING.medium.cycleMs)), needPhaseOffsets, "same row seeds reproduce the same rhythm");
assert.equal(needFlowPulseAlpha(0, 100, "energy"), 0, "zero arrows remain fully hidden");
for (const char of "v devabcdef0123456789<>") assert(HUD_GLYPHS[char], `bitmap glyph exists for ${char}`);

const main = readFileSync("src/main.js", "utf8");
const gameHud = readFileSync("src/gameHud.js", "utf8");
const inventoryRuntime = readFileSync("src/inventoryRuntime.js", "utf8");
const inventoryModeRuntime = readFileSync("src/inventoryModeRuntime.js", "utf8");
const throwAimIndicator = readFileSync("src/throwAimIndicator.js", "utf8");
const inventoryVisuals = readFileSync("src/inventoryVisuals.js", "utf8");
const interactionHud = readFileSync("src/interactionHud.js", "utf8");
const debrisRuntime = readFileSync("src/debrisRuntime.js", "utf8");
const resourceVisuals = readFileSync("src/resourceVisuals.js", "utf8");
const ruHud = JSON.parse(readFileSync("public/locales/ru/hud.json", "utf8"));
const enHud = JSON.parse(readFileSync("public/locales/en/hud.json", "utf8"));

assert(main.includes("onNewGame: () => this.startNewGame()"), "composition root wires New Game callback");
assert(main.includes("isExcludedPoint: (x, y) => this.isHudPoint(x, y)"), "all interactive HUD areas exclude MobileJoystick input");
assert(gameHud.includes('localization.t("hud:options.title")'));
assert.equal(ruHud.options.title, "Опции");
assert.equal(enHud.options.title, "Options");
assert(gameHud.includes("createInventoryRuntime(scene"), "GameHud composes the inventory owner");
assert(gameHud.includes("createInventoryModeRuntime(scene"), "GameHud composes peaceful/combat presentation owner");
assert(gameHud.includes("inventoryHud.isPointInHud(x, y)"), "hotbar excludes joystick input");
assert(!gameHud.includes("drawLog(woodIcon"), "old resource counter panel is removed");
assert(inventoryRuntime.includes("INVENTORY_SLOT_COUNT") && inventoryRuntime.includes('index === 9 ? "0"'), "hotbar renders 1-9 and 0");
assert(inventoryRuntime.includes("swapInventorySlots") && inventoryRuntime.includes("dropSlot(fromIndex, worldPointFromPointer(scene, pointer))"), "drag swaps or drops items toward the cursor");
assert(inventoryRuntime.includes("TOOL_VISIBLE_MS") && inventoryRuntime.includes("TOOL_FADE_MS"), "tool miniature fades after one second");
assert(inventoryRuntime.includes("getBlockingColliders") && inventoryRuntime.includes("directionX *= -1"), "dropped items reflect from blocking world geometry");
assert(inventoryRuntime.includes("DROP_HITBOX_SIZE = 2"), "world item occupancy is 2x2 logical pixels");
assert(inventoryVisuals.includes("lemonadeInventoryFrame"), "inventory visuals resolve the canonical lemonade/tool frames");
assert(gameHud.includes("fontFamily: localization.getLocale().fontKey"), "localized HUD text keeps the managed font");
assert(inventoryRuntime.includes("drawBitmapTextInto"), "slot labels and quantities use crisp project bitmap glyphs");
assert(inventoryRuntime.includes("slotQuantityGraphics") && inventoryRuntime.includes("shouldRenderInventoryQuantity(item)"), "stackable item quantities, including one, render immediately above gain icons");
assert(inventoryRuntime.includes("INVENTORY_WATER_BAR_WIDTH = 4") && inventoryRuntime.includes("renderWaterBar(rect)"), "bucket water uses a vertical in-slot gauge");
assert(inventoryModeRuntime.includes('drawBitmapTextInto(graphics, PEACEFUL_EAR_AREA.x + 1, PEACEFUL_EAR_AREA.y + 2, "Q"')
  && inventoryModeRuntime.includes("drawFilledArrow"), "first peaceful slot owns the compact Q/E ear with filled arrows");
assert(!inventoryRuntime.includes("if (index === 0)"), "every inventory slot uses the same typed rectangular outline");
assert(inventoryModeRuntime.includes("INVENTORY_MODE_TRANSITION_MS = 250") && inventoryModeRuntime.includes('INVENTORY_MODE_EASE = "Sine.InOut"'), "mode transition uses the accelerated duration and non-overshooting ease");
assert(gameHud.includes("notifyCoinDelta") && gameHud.includes('coinDeltaAmount > 0 ? "+" : ""'), "wallet feedback supports signed collected and dropped coin deltas");
assert(gameHud.includes("onCoinDrop(worldPointFromPointer(scene, pointer))"), "wallet drag forwards the same world cursor point used by inventory throws");
assert(gameHud.includes("throwAimIndicator.show(worldPointFromPointer(scene, pointer))"), "wallet drag shares its cursor point with the throw aim");
assert(inventoryRuntime.includes("setThrowAimTarget(worldPointFromPointer(scene, pointer))"), "inventory drag shares its cursor point with the throw aim");
assert(throwAimIndicator.includes("throwAimPixels(pose.direction)") && throwAimIndicator.includes("graphics.fillRect(x, y, 1, 1)"), "throw aim rerasterizes an eight-pixel triangle without rotated antialiasing");
assert(throwAimIndicator.includes('worldDepthFromAnchorY(sprite.y, "throw-aim", 499)'), "player world depth remains above the throw aim");
assert(gameHud.includes("ratio > 0 ? Math.max(1, Math.round(23 * ratio))"), "low non-zero needs remain visibly filled");
assert(gameHud.includes("targets: energyBarGraphics"), "low-energy feedback remains intact");
assert(gameHud.includes("renderNeedTooltip"), "need tooltip remains intact");
assert(interactionHud.includes("setSuppressed(value)"), "interaction HUD suppression remains intact");
assert(debrisRuntime.includes('from "./resourceVisuals.js"'), "world debris uses shared resource visuals");
assert(resourceVisuals.includes("export function drawLog") && resourceVisuals.includes("export function drawStone") && resourceVisuals.includes("export function drawRuby"));

console.log("hud checks passed: peaceful/combat/loadout layouts, ten-slot inventory, bitmap labels and world drops are aligned");
