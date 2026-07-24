import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FULLSCREEN_HIT_AREA, HUD_GLYPHS, compactBuildLabel, isPointInRect, measureBitmapText } from "../src/hud.js";
import {
  CLOCK_HUD_AREA,
  ENERGY_HUD_AREA,
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

assert.equal(RESOURCE_HUD_AREA.y, ENERGY_HUD_AREA.y, "resource panel and energy bar share a vertical anchor");
assert.equal(RESOURCE_HUD_AREA.height, ENERGY_HUD_AREA.height, "resource panel and energy bar share a height");
assert(RESOURCE_HUD_AREA.x + RESOURCE_HUD_AREA.width < ENERGY_HUD_AREA.x, "energy is a separate bar immediately right of resources");
assert(ENERGY_HUD_AREA.x + ENERGY_HUD_AREA.width <= GAME_WIDTH - 8, "right HUD keeps an edge margin");
assert(RESOURCE_HUD_AREA.y + RESOURCE_HUD_AREA.height < DIALOGUE_TOP, "resources stay above dialogue UI");
assert(ENERGY_HUD_AREA.y + ENERGY_HUD_AREA.height < DIALOGUE_TOP, "energy stays above dialogue UI");
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
assert(!gameHud.includes('localization.t("hud:resources.energy"'), "energy is represented by the vertical bar without a letter label");
assert(gameHud.includes("drawLog(woodIcon, 0)") && gameHud.includes("drawStone(stoneIcon, 0)") && gameHud.includes("drawRuby(rubyIcon, 0)"), "resource HUD renders all three canonical icons");
assert(debrisRuntime.includes('from "./resourceVisuals.js"'), "world debris uses the shared canonical resource visuals");
assert(resourceVisuals.includes("export function drawLog") && resourceVisuals.includes("export function drawStone") && resourceVisuals.includes("export function drawRuby"));
assert(gameHud.includes("energyFillHeight = energyRatio > 0 ? Math.max(1"), "low non-zero energy remains visibly filled");
assert(gameHud.includes("ENERGY_HUD_AREA.y + 3 + innerHeight - energyFillHeight"), "energy fill grows from bottom to top");
assert(gameHud.includes("targets: energyBarGraphics"), "low-energy feedback shakes the complete energy bar graphics");
assert(gameHud.includes("killTweensOf(energyBarGraphics)") && gameHud.includes("energyBarGraphics.setY(baseY)"), "retrigger resets the bar before shaking without accumulated offset");
assert(gameHud.includes("energyCritical ? 0xd94a4a : HUD_COLORS.mid"), "critical energy uses the red fill color");
assert(gameHud.includes("now - event.time <= 1500"), "energy arrows summarize the most recent 1.5 seconds of real energy changes");
assert(gameHud.includes("duration: 500") && gameHud.includes("delay: 100"), "energy arrows fade in, briefly hold, then fade out");
assert(gameHud.includes("setOptionsPanelInteractive(false)"), "confirmation disables hidden Options hit areas");
assert(interactionHud.includes("setSuppressed(value)") && interactionHud.includes("getPresentationState()") && interactionHud.includes("!suppressed &&"), "suppressed interaction presentation has no active HUD hit area and exposes deterministic state");
assert(interactionHud.includes("setCooldownProgress(value)") && interactionHud.includes("promptRect.x + promptRect.width - cooldownWidth"), "interaction prompt renders a right-to-left cooldown overlay");
assert(gameHud.includes("isConfirming()"), "GameHud exposes deterministic confirmation state");
assert(debrisRuntime.includes("definition.cell.x * PLACEMENT_CELL_SIZE"), "resource visuals remain anchored to the 8 px placement grid");
assert(debugPanel.includes("if (input) input.value = String(this.gameplayTuning[field.key]);"), "Reset defaults keeps gameplay tuning inputs synchronized");

console.log("hud checks passed: 320x180 zones, Options lifecycle, resource stack and whole-bar energy feedback are aligned");
