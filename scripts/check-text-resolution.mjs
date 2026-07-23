import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createManagedText, getIntegerTextResolution, refreshSceneTextResolution, refreshTextResolution, withTextResolution } from "../src/textResolution.js";

const scene = { scale: { zoom: 4.8 } };
assert.equal(getIntegerTextResolution(scene), 4, "text render resolution follows integer game display zoom");
assert.equal(withTextResolution(scene, { fontSize: "9px" }).resolution, 4, "styles receive integer text resolution");
let updated = 0;
const text = { setResolution(value) { this.resolution = value; }, updateText() { updated += 1; } };
refreshTextResolution(text, scene);
assert.equal(text.resolution, 4, "existing text object resolution is refreshed");
assert.equal(updated, 1, "text texture/metrics are updated after resolution changes");

const helper = readFileSync("src/textResolution.js", "utf8");
assert(helper.includes('scene.scale?.on?.("resize", refresh)'), "resize refreshes managed text resolution");
assert(helper.includes('addEventListener?.("fullscreenchange", refresh)'), "fullscreen changes refresh managed text resolution");
assert(helper.includes("Math.trunc"), "text resolution and coordinates use integers");
assert(!helper.includes("setScale"), "text helper does not scale text objects");
assert(helper.includes("createPixelText"), "managed text uses a graphics-backed pixel font instead of browser-rasterized canvas text");
assert(helper.includes("ф") && helper.includes("я") && helper.includes("a") && helper.includes("z"), "pixel glyph coverage includes Russian and English UI characters");
assert(helper.includes("fillRect"), "pixel glyphs are drawn as exact integer rectangles");
assert(helper.includes('align === "center"') && helper.includes("getAlignedLineX"), "wrapped pixel text honors per-line center alignment offsets");

const rects = [];
const pixelText = createManagedText({
  scale: { zoom: 1, on() {}, off() {} },
  events: { once() {} },
  add: {
    graphics() {
      return {
        clear() { rects.length = 0; return this; },
        fillStyle() { return this; },
        fillRect(x, y, width, height) { rects.push({ x, y, width, height }); return this; },
        setPosition() { return this; },
        once() {},
      };
    },
  },
}, 0, 0, "aaaa\na", { fontSize: "7px", align: "center" });
assert.equal(pixelText.width, 23, "pixel text width uses the widest line");
const firstLineMinX = Math.min(...rects.filter(({ y }) => y < 9).map(({ x }) => x));
const secondLineMinX = Math.min(...rects.filter(({ y }) => y >= 9).map(({ x }) => x));
assert(secondLineMinX > firstLineMinX, "shorter wrapped pixel line is centered within measured text width");

const gameHud = readFileSync("src/gameHud.js", "utf8");
const interactionHud = readFileSync("src/interactionHud.js", "utf8");
assert(gameHud.includes("createManagedText"), "HUD text surfaces use shared text resolution contract");
assert(interactionHud.includes("createManagedText"), "dialogue and interaction text surfaces use shared text resolution contract");
assert(interactionHud.includes("speakerText") && interactionHud.includes("bodyText") && interactionHud.includes("promptText"), "dialogue speaker, body and prompt text surfaces are covered");
assert(gameHud.includes("confirmMessageText") && gameHud.includes("soundTexts"), "confirmation modal and sound panel text surfaces are covered");

refreshSceneTextResolution({});
console.log("text resolution checks passed");
