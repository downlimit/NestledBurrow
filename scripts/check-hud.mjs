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
  RESOURCE_HUD_AREA,
  RESOURCE_HUD_LAYOUT,
  SOUND_SLIDER_RECTS,
  isEnergyCritical,
  needFlowPulseAlpha,
  shouldShakeEnergyAfterInteraction,
} from "../src/gameHud.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

const DIALOGUE_TOP = GAME_HEIGHT - 64;
const rects = [
  OPTIONS_HIT_AREA,
  CLOCK_HUD_AREA,
  FULLSCREEN_HIT_AREA,
  OPTIONS_PANEL_AREA,
  LANGUAGE_HIT_AREA,
  NEW_GAME_HIT_AREA,
  RESOURCE_HUD_AREA,
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

assert.equal(RESOURCE_HUD_AREA.y, NEEDS_HUD_AREA.y, "resource panel and needs block share a vertical anchor");
assert.equal(RESOURCE_HUD_AREA.height, NEEDS_HUD_AREA.height, "resource panel and needs block share a height");
assert(RESOURCE_HUD_AREA.x + RESOURCE_HUD_AREA.width < NEEDS_HUD_AREA.x, "needs block sits immediately right of resources");
assert(NEEDS_HUD_AREA.x + NEEDS_HUD_AREA.width <= GAME_WIDTH - 8, "right HUD keeps an edge margin");
assert(RESOURCE_HUD_AREA.y + RESOURCE_HUD_AREA.height < DIALOGUE_TOP, "resources stay above dialogue UI");
assert(NEEDS_HUD_AREA.y + NEEDS_HUD_AREA.height < DIALOGUE_TOP, "needs stay above dialogue UI");
assert.deepEqual(NEED_ROW_SYMBOLS.join(""), "NESTLD", "six rows use canonical NESTLD order");
assert.equal(NEED_ROW_IDS.length, 6);
for (const row of NEED_ROW_AREAS) {
  assert(isPointInRect(row.x + 1, row.y + 1, NEEDS_HUD_AREA), "need row hit zone starts inside block");
  assert(isPointInRect(row.x + row.width - 1, row.y + row.height - 1, NEEDS_HUD_AREA), "need row hit zone fits inside block");
}
assert(NEED_TOOLTIP_AREA.x + NEED_TOOLTIP_AREA.width < NEEDS_HUD_AREA.x, "tooltip opens left of needs block");
assert(NEED_TOOLTIP_AREA.x + NEED_TOOLTIP_AREA.width < RESOURCE_HUD_AREA.x, "tooltip does not cover resource counters");
for (const point of Object.values(RESOURCE_HUD_LAYOUT)) {
  assert(point.x >= RESOURCE_HUD_AREA.x && point.x < RESOURCE_HUD_AREA.x + RESOURCE_HUD_AREA.width, "resource elements stay inside the panel");
  assert(point.y >= RESOURCE_HUD_AREA.y && point.y < RESOURCE_HUD_AREA.y + RESOURCE_HUD_AREA.height, "resource elements stay inside the panel vertically");
}

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
assert.equal(shouldShakeEnergyAfterInteraction({ mutated: true, energyBefore: 19, currentEnergy: 15, maximumEnergy: 100 }), false, "exactly fifteen percent does not shake");
assert.equal(shouldShakeEnergyAfterInteraction({ mutated: false, energyBefore: 3, currentEnergy: 3, maximumEnergy: 100 }), false, "failed interactions do not shake");
assert.equal(shouldShakeEnergyAfterInteraction({ mutated: true, energyBefore: 12, currentEnergy: 12, maximumEnergy: 100 }), false, "energy-neutral updates do not shake");
assert.equal(isEnergyCritical(14, 100), true, "energy bar becomes red below the shake threshold");
assert.equal(isEnergyCritical(15, 100), false, "exactly fifteen percent remains the normal energy color");
const pulseSamples = [1, 2, 3, 4, 5, 6].flatMap((seed) => [0, 300, 600, 1000, 1800].map((time) => needFlowPulseAlpha(2, time, seed)));
assert(pulseSamples.every((alpha) => alpha >= 0 && alpha <= 0.9), "flow pulse alpha stays within its draw range");
assert(pulseSamples.some((alpha) => alpha > 0.85), "a flow pulse reaches a visible brightness");
assert(pulseSamples.some((alpha) => alpha === 0), "each independent pulse leaves dark intervals");
const noisyPulseSamples = [1, 2, 3, 4, 5, 6].map((seed) => needFlowPulseAlpha(1, 0, seed).toFixed(4));
assert(new Set(noisyPulseSamples).size > 1, "stable per-row timing noise breaks synchronized pulses");
for (const char of "v devabcdef0123456789") assert(HUD_GLYPHS[char], `bitmap glyph exists for ${char}`);

const main = readFileSync("src/main.js", "utf8");
const gameHud = readFileSync("src/gameHud.js", "utf8");
const interactionHud = readFileSync("src/interactionHud.js", "utf8");
const debrisRuntime = readFileSync("src/debrisRuntime.js", "utf8");
const resourceVisuals = readFileSync("src/resourceVisuals.js", "utf8");
const ruHud = JSON.parse(readFileSync("public/locales/ru/hud.json", "utf8"));
const enHud = JSON.parse(readFileSync("public/locales/en/hud.json", "utf8"));
const debugPanel = readFileSync("src/movementDebugPanel.js", "utf8");

assert(main.includes("onNewGame: () => this.startNewGame()"), "composition root wires New Game callback");
assert(main.includes("this.interactionHud?.setSuppressed?.(active)") && main.includes("if (!active) this.interactionRuntime?.refresh?.()"), "confirmation suppresses InteractionHud and refreshes its presentation after cancel");
assert(main.includes("isExcludedPoint: (x, y) => this.isHudPoint(x, y)"), "all interactive HUD areas exclude MobileJoystick input");
assert(gameHud.includes('localization.t("hud:options.title")'), "Options label is localized");
assert.equal(ruHud.options.title, "Опции");
assert.equal(enHud.options.title, "Options");
assert(gameHud.includes('localization.t("hud:progress.newGame")'), "New Game remains localized inside Options");
assert(gameHud.includes('localization.t(`hud:sound.${channel}`)'), "audio settings remain localized inside Options");
assert(gameHud.includes("fontFamily: localization.getLocale().fontKey"), "localized HUD text uses locale Unicode font");
assert(gameHud.includes("drawBitmapTextInto(graphics, OPTIONS_BUILD_LABEL.x, OPTIONS_BUILD_LABEL.y, buildLabel)"), "build ID is rendered only by the Options panel pass");
assert(!gameHud.includes("drawBitmapText(scene"), "normal gameplay no longer creates a permanent build label");
assert(gameHud.includes("NEED_ROW_SYMBOLS") && gameHud.includes("renderNeeds(gameplay)"), "energy is integrated into the six-row needs block");
assert(gameHud.includes("drawLog(woodIcon, 0)") && gameHud.includes("drawStone(stoneIcon, 0)") && gameHud.includes("drawRuby(rubyIcon, 0)"), "resource HUD renders all three canonical icons");
assert(debrisRuntime.includes('from "./resourceVisuals.js"'), "world debris uses the shared canonical resource visuals");
assert(resourceVisuals.includes("export function drawLog") && resourceVisuals.includes("export function drawStone") && resourceVisuals.includes("export function drawRuby"));
assert(gameHud.includes("ratio > 0 ? Math.max(1, Math.round(23 * ratio))"), "low non-zero needs remain visibly filled");
assert(gameHud.includes("targets: energyBarGraphics"), "low-energy feedback shakes the integrated needs graphics");
assert(gameHud.includes("killTweensOf(energyBarGraphics)") && gameHud.includes("energyBarGraphics.setY(baseY)"), "retrigger resets the bar before shaking without accumulated offset");
assert(gameHud.includes('id === "energy" && ratio < 0.15'), "critical energy uses the red fill color");
assert(gameHud.includes("const flows = { ...gameplay.needsFlow, energy: gameplay.energyFlow }"), "each need row receives its current independent flow");
assert(gameHud.includes("needFlowPulseAlpha(arrows, nowMs, seed)") && gameHud.includes("if (alpha <= 0) return"), "need arrows blink with noisy intensity-dependent timing");
assert(gameHud.includes("pointerover") && gameHud.includes("pointerout") && gameHud.includes("renderNeedTooltip"), "need tooltip has hover lifecycle");
for (const id of NEED_ROW_IDS) {
  assert.equal(typeof enHud.needs[id].tooltip, "string", `${id} EN tooltip exists`);
  assert.equal(typeof ruHud.needs[id].tooltip, "string", `${id} RU tooltip exists`);
}
assert(gameHud.includes("setOptionsPanelInteractive(false)"), "confirmation disables hidden Options hit areas");
assert(interactionHud.includes("setSuppressed(value)") && interactionHud.includes("getPresentationState()") && interactionHud.includes("!suppressed &&"), "suppressed interaction presentation has no active HUD hit area and exposes deterministic state");
assert(interactionHud.includes("setCooldownProgress(value)") && interactionHud.includes("promptRect.x + promptRect.width - cooldownWidth"), "interaction prompt renders a right-to-left cooldown overlay");
assert(interactionHud.includes("duration: 300") && interactionHud.includes("alpha: targetAlpha"), "cooldown text fades over 0.3 seconds");
assert(gameHud.includes("isConfirming()"), "GameHud exposes deterministic confirmation state");
assert(debrisRuntime.includes("definition.cell.x * PLACEMENT_CELL_SIZE"), "resource visuals remain anchored to the 8 px placement grid");
assert(debugPanel.includes("if (input) input.value = String(this.gameplayTuning[field.key]);"), "Reset defaults keeps gameplay tuning inputs synchronized");

console.log("hud checks passed: 320x180 NESTLD rows, tooltips, exclusions and energy feedback are aligned");
