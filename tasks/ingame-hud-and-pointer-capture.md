# Task: in-game HUD and persistent mobile pointer capture

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `1`
- Work branch: use the single branch supplied by Codex; do not create or push additional branches
- Lifecycle: `ephemeral`
- Create PR: `yes` — exactly once, after implementation and applicable validation
- Delete task branch after merge: `yes` — handled by GitHub automatic head-branch deletion
- Codex deletes its own active branch: `no`
- Persistent/protected branch: `no`

## Goal

Move the fullscreen control and build identifier into the Phaser-rendered game HUD, replace the unsuitable browser font with an original low-resolution bitmap UI style, and keep an active mobile joystick pointer alive when the finger leaves the canvas or letterboxed game area.

## Read before editing

- `AGENTS.md`
- `PROJECT.md`
- `LIBRARY.md`
- `REVIEW.md`
- `src/main.js`
- `src/input.js`
- `src/fullscreen.js`
- `src/style.css`
- existing input/fullscreen checks in `scripts/`

## Requirements

### In-game fullscreen control

- Remove the visible DOM fullscreen button from webpage space.
- Render the fullscreen control inside the Phaser game as a screen-space HUD element fixed to the logical viewport, unaffected by camera movement.
- Use a compact original pixel-art icon with a sufficiently large invisible hit area for touch.
- Reuse the existing Fullscreen API logic rather than duplicating browser-state handling.
- Keep the icon state synchronized after entering fullscreen, leaving through the button, leaving through `Esc`, browser-driven fullscreen loss, resize and scene recreation.
- A pointer starting on the HUD control must never create, move or cancel the gameplay joystick.
- The control must remain aligned to whole logical pixels at every supported integer zoom.

### Persistent joystick pointer

- Capture the native pointer on the game canvas when a valid joystick interaction begins, using the active `pointerId`.
- While capture remains active, continue receiving movement when the pointer leaves the canvas, the rendered game rectangle or letterbox area.
- Do not cancel the joystick merely because Phaser reports `gameout`, `pointerout` or an equivalent boundary-leave event while that same pointer is still captured.
- Clamp the visual joystick handle and movement vector to the configured maximum radius even when external coordinates are far outside the game rectangle.
- Release and reset only on a genuine end or safety event: matching `pointerup`, `pointercancel`, `lostpointercapture`, `window.blur`, hidden document, scene shutdown/destroy, or a fullscreen transition that invalidates coordinates.
- Ignore unrelated secondary pointers and HUD pointers.
- Keep `touch-action: none` on the actual interactive surface so browser scrolling or zoom does not steal ordinary joystick drags.
- Do not claim that system edge gestures or a pointer leaving the browser/application itself can be prevented; handle every state available inside the browsing context correctly.

### Pixel build label

- Remove the visible DOM/browser-font build label.
- Render the build identifier inside the same Phaser screen-space HUD.
- Use an original in-project bitmap glyph set designed for the 320×180 logical resolution. Do not import a trademarked Sega/Nintendo font or add a font dependency.
- Target a warm 8/16-bit console UI character: crisp 5×7, 6×8 or similarly compact glyphs, whole-pixel placement, restrained contrast, and a one-pixel shadow or outline when needed for readability.
- Display a compact value such as `v 4e090db`; do not use the word `build`.
- Keep the label secondary to gameplay and visually coherent with the fullscreen icon.
- The bitmap glyph source and mapping must be centralized and reusable by future HUD text rather than hard-coded as arbitrary per-letter drawing calls in the scene.

### Structure

- Keep fullscreen browser integration, HUD rendering and input ownership clearly separated.
- A small reusable HUD module is appropriate. Do not create a second Phaser scene or a general UI framework for these two elements.
- Add no runtime dependency and preserve keyboard movement, dynamic joystick placement, movement tuning, collision, camera, world layout and integer pixel-grid behavior.

## Validation

Use review class `visual/runtime`.

Add or extend automated checks for:

- HUD pointers being excluded from joystick ownership;
- pointer down inside the joystick region, movement beyond canvas bounds while captured, continued non-zero input, then matching release and complete reset;
- no reset from boundary-leave events while the active pointer is captured;
- reset on cancel, lost capture, blur, hidden document and fullscreen-coordinate invalidation;
- fullscreen state synchronization after external exit;
- removal of the visible DOM fullscreen button and DOM build label;
- bitmap HUD alignment and use of the canonical build identifier.

Inspect the actual rendered result before PR creation at desktop and narrow/mobile viewports. Verify normal mode, fullscreen mode, `Esc` exit, HUD tapping, joystick dragging beyond every canvas edge, release outside the canvas, letterboxing and integer zoom. Include an actual preview or screenshot showing the final HUD at native logical scale and at displayed scale.

## Scope boundary

Do not redesign the rest of the HUD, add menus, settings, audio, new gameplay, a font library, a UI framework, a second scene, or unrelated input architecture.

## Delivery

Finish implementation, self-review and applicable validation before opening exactly one final PR from the single task branch. Use the adaptive `.github/pull_request_template.md`; keep only sections relevant to the task. Do not create a draft PR, replacement PR, additional remote branch or close/reopen cycle as a development mechanism. Remove this completed task file in the final implementation PR unless it still contains genuinely reusable unfinished work.