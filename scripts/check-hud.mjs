import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FULLSCREEN_HIT_AREA, HUD_GLYPHS, compactBuildLabel, isPointInRect, measureBitmapText } from "../src/hud.js";
import {
  CLOCK_HUD_AREA,
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
  needFlowPulseAlpha,
  shouldShakeEnergyAfterInteraction,
} from "../src/gameHud.js";
import { INVENTORY_HUD_AREA, INVENTORY_SLOT_AREAS } from "../src/inventoryRuntime.js";
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
assert.equal(INVENTORY_SLOT_AREAS.length, 10, "hotbar exposes ten slots");
assert.equal(INVENTORY_HUD_AREA.x + INVENTORY_HUD_AREA.width, 279, "hotbar is centered with equal 41 px margins");
assert.equal(INVENTORY_HUD_AREA.x, 41, "hotbar is centered with equal 41 px margins");
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
const pulseSamples = [1, 2, 3, 4, 5, 6].flatMap((seed) => [0, 300, 600, 1000, 1800].map((time) => needFlowPulseAlpha(2, time, seed)));
assert(pulseSamples.every((alpha) => alpha >= 0 && alpha <= 0.9));
assert(pulseSamples.some((alpha) => alpha > 0.85));
assert(pulseSamples.some((alpha) => alpha === 0));
for (const char of "v devabcdef0123456789") assert(HUD_GLYPHS[char], `bitmap glyph exists for ${char}`);

const main = readFileSync("src/main.js", "utf8");
const gameHud = readFileSync("src/gameHud.js", "utf8");
const inventoryRuntime = readFileSync("src/inventoryRuntime.js", "utf8");
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
assert(gameHud.includes("inventoryHud.isPointInHud(x, y)"), "hotbar excludes joystick input");
assert(!gameHud.includes("drawLog(woodIcon"), "old resource counter panel is removed");
assert(inventoryRuntime.includes("INVENTORY_SLOT_COUNT") && inventoryRuntime.includes('index === 9 ? "0"'), "hotbar renders 1-9 and 0");
assert(inventoryRuntime.includes("swapInventorySlots") && inventoryRuntime.includes("dropSlot(fromIndex)"), "drag swaps or drops items");
assert(inventoryRuntime.includes("TOOL_VISIBLE_MS") && inventoryRuntime.includes("TOOL_FADE_MS"), "tool miniature fades after one second");
assert(inventoryRuntime.includes("getBlockingColliders") && inventoryRuntime.includes("directionX *= -1"), "dropped items reflect from blocking world geometry");
assert(inventoryRuntime.includes("DROP_HITBOX_SIZE = 2"), "world item occupancy is 2x2 logical pixels");
assert(inventoryVisuals.includes('itemId === "axe"') && inventoryVisuals.includes('itemId === "watering-can"'), "tool placeholders are procedural game visuals");
assert(gameHud.includes("fontFamily: localization.getLocale().fontKey"), "localized HUD text keeps the managed font");
assert(inventoryRuntime.includes("drawBitmapTextInto"), "slot labels and quantities use crisp project bitmap glyphs");
assert(gameHud.includes("ratio > 0 ? Math.max(1, Math.round(23 * ratio))"), "low non-zero needs remain visibly filled");
assert(gameHud.includes("targets: energyBarGraphics"), "low-energy feedback remains intact");
assert(gameHud.includes("renderNeedTooltip"), "need tooltip remains intact");
assert(interactionHud.includes("setSuppressed(value)"), "interaction HUD suppression remains intact");
assert(debrisRuntime.includes('from "./resourceVisuals.js"'), "world debris uses shared resource visuals");
assert(resourceVisuals.includes("export function drawLog") && resourceVisuals.includes("export function drawStone") && resourceVisuals.includes("export function drawRuby"));

console.log("hud checks passed: ten-slot inventory, bitmap labels, world drops and existing HUD contracts are aligned");
