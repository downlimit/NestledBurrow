import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BUILD_LABEL, FULLSCREEN_HIT_AREA, HUD_GLYPHS, compactBuildLabel, isPointInRect, measureBitmapText } from "../src/hud.js";
import {
  LANGUAGE_HIT_AREA,
  SOUND_HIT_AREA,
  SOUND_PANEL_AREA,
  NEW_GAME_CANCEL_HIT_AREA,
  NEW_GAME_CONFIRM_HIT_AREA,
  NEW_GAME_CONFIRM_PANEL,
  NEW_GAME_HIT_AREA,
  RESOURCE_HUD_AREA,
} from "../src/gameHud.js";
import { GAME_HEIGHT, GAME_WIDTH } from "../src/worldConfig.js";

assert.equal(compactBuildLabel("4e090db123"), "v 4e090db", "HUD uses compact canonical short build identifier");
assert.equal(measureBitmapText("v 4e090db"), 51, "bitmap label width is deterministic for alignment");
assert(Number.isInteger(BUILD_LABEL.x) && Number.isInteger(BUILD_LABEL.y), "build label aligns to whole logical pixels");
assert.equal(FULLSCREEN_HIT_AREA.width, 30, "fullscreen hit area remains touch sized");
assert(NEW_GAME_HIT_AREA.x + NEW_GAME_HIT_AREA.width < RESOURCE_HUD_AREA.x, "New Game and resource HUD do not overlap");
assert(RESOURCE_HUD_AREA.x + RESOURCE_HUD_AREA.width < SOUND_HIT_AREA.x, "New Game and right HUD group do not overlap");
assert(measureBitmapText("EN 100/100 W0 R0") <= RESOURCE_HUD_AREA.width - 10, "default English resource summary fits inside its HUD panel before the right controls");
assert(SOUND_HIT_AREA.x + SOUND_HIT_AREA.width <= LANGUAGE_HIT_AREA.x, "sound and language hit areas do not overlap");
assert(LANGUAGE_HIT_AREA.x + LANGUAGE_HIT_AREA.width <= FULLSCREEN_HIT_AREA.x, "language and fullscreen hit areas do not overlap");
assert(BUILD_LABEL.x < SOUND_HIT_AREA.x, "build label is placed left of the right HUD controls");
for (const rect of [NEW_GAME_HIT_AREA, RESOURCE_HUD_AREA, SOUND_HIT_AREA, LANGUAGE_HIT_AREA, FULLSCREEN_HIT_AREA, SOUND_PANEL_AREA, NEW_GAME_CONFIRM_PANEL, NEW_GAME_CONFIRM_HIT_AREA, NEW_GAME_CANCEL_HIT_AREA]) {
  assert(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= GAME_WIDTH && rect.y + rect.height <= GAME_HEIGHT, "GameHud rectangle stays inside logical viewport");
}
assert(isPointInRect(NEW_GAME_CONFIRM_HIT_AREA.x + 2, NEW_GAME_CONFIRM_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "confirm action stays inside confirmation panel");
assert(isPointInRect(NEW_GAME_CANCEL_HIT_AREA.x + 2, NEW_GAME_CANCEL_HIT_AREA.y + 2, NEW_GAME_CONFIRM_PANEL), "cancel action stays inside confirmation panel");
for (const char of "v devabcdef0123456789") assert(HUD_GLYPHS[char], `bitmap glyph exists for ${char}`);
const main = readFileSync("src/main.js", "utf8");
const gameHud = readFileSync("src/gameHud.js", "utf8");
const debrisRuntime = readFileSync("src/debrisRuntime.js", "utf8");
const debugPanel = readFileSync("src/movementDebugPanel.js", "utf8");
assert(main.includes("onNewGame: () => this.startNewGame()"), "composition root wires New Game callback");
assert(main.includes("isExcludedPoint: (x, y) => this.isHudPoint(x, y)"), "all HUD areas exclude MobileJoystick input");
assert(gameHud.includes('localization.t("hud:progress.newGame")'), "New Game label is localized");
assert(gameHud.includes('localization.t(`hud:sound.${channel}`)'), "sound panel labels are localized");
assert(gameHud.includes("fontFamily: localization.getLocale().fontKey"), "localized HUD text uses locale Unicode font");
assert(gameHud.includes("graphics.clear();"), "sound icon render starts from a cleared Graphics surface through the HUD render pass");
assert(!gameHud.includes("strokeCircle"), "sound icon avoids closed circular waves");
assert(!gameHud.includes("fillCircle"), "sound icon avoids closed circular slider elements");
const soundButtonSource = gameHud.slice(gameHud.indexOf("function renderSoundButton()"), gameHud.indexOf("function renderSoundPanel()"));
const iconRects = [...soundButtonSource.matchAll(/\.fillRect\(x \+ (\d+), y \+ (\d+), (\d+), (\d+)\)/g)].map((match) => ({ x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) }));
assert(iconRects.length >= 9, "sound icon uses explicit pixel rectangles");
for (const rect of iconRects) {
  assert(rect.x >= 3 && rect.y >= 3, "sound icon pixels stay inside the button's top-left border");
  assert(rect.x + rect.width <= SOUND_HIT_AREA.width - 3, "sound icon pixels stay inside the button's right border");
  assert(rect.y + rect.height <= SOUND_HIT_AREA.height - 3, "sound icon pixels stay inside the button's bottom border");
}
assert(gameHud.includes("hud:resources.summary"), "energy and wood HUD label is localized");
assert(gameHud.includes("isConfirming()"), "GameHud exposes deterministic confirmation state");
assert(debrisRuntime.includes(".setPosition(definition.tile.x * TILE_SIZE, definition.tile.y * TILE_SIZE)"), "debris visuals are anchored at their world tiles before scaling");
assert(debrisRuntime.includes("drawLog(graphics, stateFor(definition)?.remainingHits ?? 5);"), "debris geometry is drawn in local coordinates with progress state");
assert(!debrisRuntime.includes("drawLog(graphics, DEBRIS_OBJECT.tile.x * TILE_SIZE"), "debris animation does not scale absolute world coordinates around the origin");
assert(debugPanel.includes("if (input) input.value = String(this.gameplayTuning[field.key]);"), "Reset defaults synchronizes gameplay tuning inputs from gameplay state");
assert(!debugPanel.includes("for (const [key, input] of this.inputs)"), "gameplay inputs are not synchronized from movement config");
console.log("hud checks passed: layout, localized controls, anchored debris feedback and tuning input synchronization are aligned");
