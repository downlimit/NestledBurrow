import assert from "node:assert/strict";
import { isFullscreenActive, isFullscreenSupported, toggleFullscreen } from "../src/fullscreen.js";

let requested = 0;
let exited = 0;
const element = { requestFullscreen: async () => { requested += 1; } };
const documentRef = { fullscreenElement: null, exitFullscreen: async () => { exited += 1; documentRef.fullscreenElement = null; } };

assert.equal(isFullscreenSupported(element), true);
assert.equal(isFullscreenSupported({}), false);
assert.equal(isFullscreenActive(documentRef, element), false);
assert.equal(await toggleFullscreen({ documentRef, element }), true, "enter resolves true");
assert.equal(requested, 1, "enter requests fullscreen on #game element");
documentRef.fullscreenElement = element;
assert.equal(isFullscreenActive(documentRef, element), true, "state follows document.fullscreenElement");
assert.equal(await toggleFullscreen({ documentRef, element }), false, "repeat exits fullscreen");
assert.equal(exited, 1, "exitFullscreen is called on active toggle");
const rejected = { requestFullscreen: async () => { throw new Error("denied"); } };
assert.equal(await toggleFullscreen({ documentRef: { fullscreenElement: null }, element: rejected }), false, "rejected request is handled");
assert.equal(await toggleFullscreen({ documentRef, element: {} }), false, "unsupported toggle is a no-op");

console.log("fullscreen checks passed");
