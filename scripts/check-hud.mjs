import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUILD_LABEL,
  FULLSCREEN_HIT_AREA,
  HUD_GLYPHS,
  compactBuildLabel,
  isPointInRect,
  measureBitmapText,
} from "../src/hud.js";
import { GAME_WIDTH } from "../src/worldConfig.js";

assert.equal(compactBuildLabel("4e090db123"), "v 4e090db", "HUD uses compact canonical short build identifier");
assert.equal(compactBuildLabel("dev"), "v dev", "dev identifier stays compact");
assert.equal(measureBitmapText("v 4e090db"), 51, "bitmap label width is deterministic for alignment");
assert(Number.isInteger(BUILD_LABEL.x) && Number.isInteger(BUILD_LABEL.y), "build label aligns to whole logical pixels");
assert(Number.isInteger(FULLSCREEN_HIT_AREA.x) && Number.isInteger(FULLSCREEN_HIT_AREA.y), "fullscreen hit area aligns to whole logical pixels");
assert.equal(FULLSCREEN_HIT_AREA.width, 30, "fullscreen hit area is larger than compact icon for touch");
assert.equal(FULLSCREEN_HIT_AREA.x + FULLSCREEN_HIT_AREA.width, GAME_WIDTH - 4, "fullscreen HUD is fixed to logical viewport edge");
assert.equal(isPointInRect(GAME_WIDTH - 20, 12, FULLSCREEN_HIT_AREA), true, "HUD pointer is detected inside hit area");
assert.equal(isPointInRect(GAME_WIDTH / 4, 90, FULLSCREEN_HIT_AREA), false, "gameplay joystick area is not HUD");
for (const char of "v devabcdef0123456789") {
  assert(HUD_GLYPHS[char], `bitmap glyph exists for ${char}`);
}

const css = readFileSync("src/style.css", "utf8");
assert(!css.includes("fullscreen-toggle"), "visible DOM fullscreen button styles were removed");
const main = readFileSync("src/main.js", "utf8");
assert(!main.includes("fullscreen-toggle"), "fullscreen button is not created in DOM");
assert(!main.includes("createFullscreenButton"), "legacy DOM fullscreen helper was removed");
assert(!main.includes("build:"), "DOM/browser-font build label text was removed");
assert(main.includes("drawBitmapText"), "scene renders build identifier with bitmap HUD text");
assert(main.includes("drawFullscreenIcon"), "scene renders fullscreen control in Phaser HUD");
assert(main.includes("this.isHudPointer(pointer)"), "HUD pointers are excluded before joystick ownership");

console.log("hud checks passed");
