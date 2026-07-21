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
assert(main.includes("isExcludedPoint: (x, y) => this.isHudPoint(x, y)"), "fullscreen hit area is passed to MobileJoystick as an exclusion callback");
assert(!main.includes("isHudPointer(pointer)"), "scene no longer exposes the legacy pointer-shaped HUD check");

console.log("hud checks passed");
import { createInteractionHud } from "../src/interactionHud.js";

function createEmitterObject() {
  return {
    interactive: false, destroyed: 0, handlers: new Map(), depth: 0, scrollFactor: 1,
    setOrigin() { return this; }, setDepth(value) { this.depth = value; return this; }, setScrollFactor(value) { this.scrollFactor = value; return this; },
    setInteractive() { this.interactive = true; return this; }, disableInteractive() { this.interactive = false; return this; },
    on(name, fn) { this.handlers.set(name, fn); return this; }, off(name) { this.handlers.delete(name); return this; },
    destroy() { this.destroyed += 1; }, emitPointerDown() { this.handlers.get("pointerdown")?.({ event: { stopped: false, stopPropagation() { this.stopped = true; } } }, 0, 0, { stopped: false, stopPropagation() { this.stopped = true; } }); },
  };
}
const fakeGraphics = { clearCount: 0, destroyed: 0, setDepth() { return this; }, setScrollFactor() { return this; }, clear() { this.clearCount += 1; return this; }, fillStyle() { return this; }, fillRect() { return this; }, lineStyle() { return this; }, strokeRect() { return this; }, destroy() { this.destroyed += 1; } };
const zones = [];
const hudScene = { add: { graphics() { return fakeGraphics; }, zone() { const zone = createEmitterObject(); zones.push(zone); return zone; } } };
const interactionHud = createInteractionHud(hudScene, { isCoarsePointer: () => false });
assert.equal(interactionHud.isPointInHud(12, 150), false, "invisible interaction area does not block joystick");
interactionHud.showPrompt({ prompt: "TALK" });
assert.equal(interactionHud.isPointInHud(12, 150), false, "visible right-side prompt leaves the left side available");
assert.equal(interactionHud.isPointInHud(GAME_WIDTH - 12, 150), true, "visible prompt area is active on the right side");
const clearAfterPrompt = fakeGraphics.clearCount;
interactionHud.showPrompt({ prompt: "TALK" });
assert.equal(fakeGraphics.clearCount, clearAfterPrompt, "repeat prompt show does not redraw or duplicate objects");
zones[0].emitPointerDown();
assert.equal(interactionHud.consumeInteractPressed(), true, "mobile prompt tap latches one interact");
assert.equal(interactionHud.consumeInteractPressed(), false, "consume clears mobile interact latch");
interactionHud.showDialogue({ speaker: "HOME NPC", text: "HELLO THERE.", continuePrompt: "NEXT" });
assert.equal(interactionHud.isPointInHud(270, 150), true, "visible dialogue action area blocks joystick");
assert.equal(interactionHud.isPointInHud(100, 135), true, "entire visible dialogue panel blocks joystick activation");
assert.equal(interactionHud.isPointInHud(100, 110), false, "area above dialogue panel remains available to gameplay input");
interactionHud.showDialogue({ speaker: "HOME NPC", text: "SEE YOU AROUND.", continuePrompt: "CLOSE" });
assert.equal(zones.length, 2, "dialogue updates reuse HUD objects");
zones[1].emitPointerDown();
assert.equal(interactionHud.consumeInteractPressed(), true, "dialogue tap advances exactly one latched action");
interactionHud.hideDialogue();
assert.equal(interactionHud.isPointInHud(270, 150), false, "hidden dialogue area does not block joystick");
interactionHud.destroy();
interactionHud.destroy();
assert.equal(fakeGraphics.destroyed, 1, "interaction HUD destroy is idempotent for graphics");
assert.equal(zones[0].destroyed, 1, "interaction HUD destroy is idempotent for prompt zone");
assert(main.includes("Phaser.Input.Keyboard.JustDown(this.interactKeys.E)") && main.includes("Phaser.Input.Keyboard.JustDown(this.interactKeys.SPACE)"), "keyboard interaction uses edge-triggered JustDown for E and SPACE so hold does not repeat per frame");
