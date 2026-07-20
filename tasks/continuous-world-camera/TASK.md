# Continuous indoor/outdoor world, camera follow and unified pixel grid

Work from the current `main` and obey the root `AGENTS.md`.

## Preflight

Read before editing:

- `PROJECT.md`
- `LIBRARY.md`
- `AGENTS.md`
- `ASSETS.md`
- `src/main.js`
- `src/input.js`
- `src/visualConfig.js`
- `src/roomLayout.js`
- `src/kenneyRoomConfig.json`
- `scripts/audit-spritesheet.py`
- `scripts/check-visual.mjs`
- `scripts/check-room-preview.py`
- `.github/workflows/pr-check.yml`

Confirm that current `main` contains the audited semantic Kenney room atlas from PR #18. If not, make no changes and report:

`OUTDATED BASE — CREATE A NEW TASK FROM LATEST MAIN`

## Purpose

Implement one continuous top-down world in a single Phaser scene:

- correct the upper wall corner orientation;
- keep the existing interior as part of the world;
- add a minimal outdoor area around it with free Kenney tiles in the same style;
- let the player walk through an actual doorway between interior and outdoor without loading, teleporting, fading or changing scenes;
- enlarge the world beyond the viewport;
- attach the camera to the player;
- establish one consistent pixel grid for all world art.

Do not add gameplay systems, furniture, NPCs, interactions, inventory, roofs, day/night, water, trees or decorative clutter in this task.

## 1. Fix the upper wall corners

The current layout reuses the same left/right edge tiles for top and bottom wall bands. The upper joining corners therefore face upward; they must face downward into the room.

Investigate the already audited Kenney source frames around the selected wall families. Do not guess from raw IDs.

Requirements:

- create separate semantic frame names for upper and lower wall edges;
- use native down-facing upper corner/edge art from the pack when it exists;
- only if the pack has no native counterpart, generate a pixel-exact transformed copy from a verified source frame and record the transform in the manifest;
- never apply unexplained runtime flips;
- keep raw source frame numbers only in the audit manifest, never in gameplay code;
- visually verify every upper-left and upper-right join at enlarged nearest-neighbor scale.

## 2. Select minimal outdoor assets from the same free pack

Use the historical official archive already referenced by `src/kenneyRoomConfig.json` and the existing `scripts/audit-spritesheet.py` workflow.

Select only a minimal coherent outdoor set from the same Kenney Roguelike/RPG Pack:

- one grass ground tile;
- one dirt/path tile;
- any additional edge tile only when required to avoid an obviously broken transition.

Do not mix in another asset pack in this task.

Before integration:

- generate labeled contact sheets for relevant outdoor candidates;
- inspect them visually;
- record exact source frame, source SHA-256, source sheet geometry and semantic role;
- add semantic names such as `grass` and `dirtPath`.

## 3. Binary transport constraint

Codex PR creation cannot reliably transport binary changes.

During local work you may generate and use PNG files, but the final Codex diff must not add, modify or delete binary files.

Create a small new semantic extension atlas locally containing:

- the corrected upper wall edge/corner frames;
- the selected outdoor frames.

Suggested final paths:

- `public/assets/third-party/kenney/world/kenney-world-extension.png`
- `public/assets/third-party/kenney/world/kenney-world-extension.json`

The JSON atlas file may be committed normally because it is text.

Encode the final PNG as complete base64 text at:

- `tasks/continuous-world-camera/export/kenney-world-extension.png.base64.txt`

Create:

- `tasks/continuous-world-camera/export/MANIFEST.json`

The export manifest must include:

- base64 source path;
- exact final PNG path;
- width and height;
- final PNG SHA-256;
- every semantic frame name and rectangle;
- original Kenney source frame and SHA-256;
- intended role;
- any transform applied;
- any obsolete binary files that the main chat should delete after decoding.

Do not decode the base64 back into the committed tree. The main chat will add the actual binary to the PR branch before CI and merge.

## 4. One consistent pixel system

The current implementation uses `ROOM_SCALE = 2`, `PLAYER_SCALE = 3` and a 960×540 game stretched by `Phaser.Scale.FIT`. This produces different world-pixel sizes and can also create fractional display scaling.

Replace that model with one shared pixel grid.

Required target:

- logical game resolution: `320 × 180`;
- all 16×16 Kenney world assets rendered at native scale `1`;
- player rendered at native scale `1`;
- no independent `ROOM_SCALE`, `PLAYER_SCALE`, outdoor scale or prop scale;
- preserve perceived movement speed by converting the old speed into the new logical coordinate system rather than blindly keeping `260`;
- display the 320×180 canvas only at an integer zoom factor;
- use Phaser's documented maximum integer display zoom, such as `Phaser.Scale.MAX_ZOOM`, with a scale mode that preserves the logical 320×180 buffer instead of fractionally resampling it;
- center the canvas and accept letterboxing when the viewport is not an exact multiple;
- retain `pixelArt: true`, `antialias: false`, `roundPixels: true` and CSS `image-rendering: pixelated`.

Do not solve this by scaling individual sprites back up.

Add automated checks that fail when:

- separate world-art scale constants are reintroduced;
- logical resolution is not 320×180;
- display zoom is fractional or `FIT` fractional resampling returns;
- player and tiles no longer share the same native source-pixel size.

## 5. Continuous world layout

Create a world larger than the viewport. A reasonable minimal target is approximately `64 × 48` source tiles, but the exact dimensions may be adjusted slightly for clean layout.

The world must contain:

- grass covering the outdoor ground;
- the existing room/house embedded inside this outdoor map;
- the audited interior floor and wall family;
- a centered two-tile-wide opening in the lower wall;
- a short dirt path leading away from the doorway;
- enough outdoor space in every direction that the camera visibly travels.

The room and outdoor must exist simultaneously in the same scene and coordinate system.

Forbidden:

- a second Phaser scene for outdoor;
- scene transitions;
- teleporting between indoor and outdoor coordinates;
- hiding one environment while showing the other;
- loading screens or fades;
- Tiled;
- procedural generation.

## 6. World collision without Phaser Physics

Keep the current no-physics approach.

Replace the old rectangular `roomBounds` clamp with deterministic world collision:

- world bounds stop the player's foot box at the map edges;
- wall tiles block movement;
- the two-tile doorway is open and traversable;
- outdoor grass and path are walkable;
- resolve movement one axis at a time so the player slides along walls rather than sticking diagonally;
- collision uses the player's foot box, not the full transparent sprite rectangle;
- walking from the room to the outdoor and back must require no special-case teleport.

Move pure layout and collision calculations out of `src/main.js` into small testable modules. Do not introduce ECS or a large scene architecture.

Add automated tests proving:

- the world is larger than 320×180;
- the doorway cells are not blocked;
- all other wall cells are blocked;
- there is a walkable route from the interior spawn point through the doorway to an outdoor point;
- movement cannot cross a solid wall;
- axis-separated movement slides along a wall;
- world bounds clamp correctly.

## 7. Camera follow

Use the main Phaser camera.

Requirements:

- set camera bounds to the complete world dimensions;
- start the player inside the room;
- follow the player continuously with no scene transition;
- keep the player centered whenever world bounds allow it;
- no smoothing that introduces fractional camera scroll or pixel shimmer;
- round camera scroll to the logical pixel grid;
- stop correctly at all world edges;
- demonstrate that the location is larger than the viewport by allowing travel far enough that the initial room leaves the screen.

The camera must follow the same player object used for movement and animation.

## 8. Fixed HUD and mobile joystick

The build label and virtual joystick are screen-space UI.

After camera follow is enabled:

- set `scrollFactor(0)` on the build label, joystick base and joystick knob;
- adapt joystick dimensions and position from the old 960×540 grid to the new 320×180 logical grid using integer values;
- preserve activation radius, dead-zone remapping, pointer ownership and all cancellation/reset behavior;
- pointer calculations must remain in screen coordinates;
- the joystick must remain in the lower-left corner while the camera moves;
- the build label must remain in the upper-right corner while the camera moves.

Keep keyboard and arrow controls unchanged.

## 9. Runtime structure

Rename `RoomScene` to a name that reflects the continuous world, such as `WorldScene`.

Suggested compact separation:

- `src/worldConfig.js` — logical resolution, tile size, world dimensions and semantic asset names;
- `src/worldLayout.js` — outdoor fill, house placement, doorway and blocked cells;
- `src/movement.js` — pure foot-box collision and axis-separated movement;
- `src/main.js` — Phaser loading, rendering, camera, input and animation glue.

Names may differ, but do not keep the whole world and collision implementation inside one large `create()` or `update()` method.

Do not add npm runtime dependencies.

## 10. Visual regression artifacts

Replace the old single-room-only preview with previews that cover the continuous world.

Generate and pin pixel hashes for:

- `artifacts/world-overview.png` — the complete world at native source resolution or a clearly documented integer scale;
- `artifacts/camera-indoor.png` — exact 320×180 camera view with the player spawn inside;
- `artifacts/camera-outdoor.png` — exact 320×180 camera view outside with the house and path visible;
- `artifacts/top-wall-detail.png` — enlarged nearest-neighbor crop proving the upper joins face downward.

The PR workflow must upload all four images as one artifact.

Do not update approved hashes before opening and visually inspecting every image.

Because generated preview PNGs are workflow artifacts, they do not need to be committed. Only their approved pixel hashes belong in the text manifest.

## 11. Manual self-test

Launch the game and explicitly verify:

### Pixel grid

- player, interior tiles and outdoor tiles all use the same source-pixel thickness;
- no object looks as if its pixels are 2× while another is 3×;
- at two differently sized browser viewports, the canvas zoom remains an integer;
- letterboxing appears instead of fractional resampling when needed;
- camera movement does not make vertical or horizontal edges shimmer.

### Interior and outdoor

- upper-left and upper-right joins face downward;
- lower joins remain correct;
- room floor is still correct;
- outdoor reads as grass rather than a prop or unrelated tile;
- dirt path reads correctly;
- the player walks through the doorway in both directions without transition;
- walls block movement outside the doorway;
- the room and outdoor remain present at the same time.

### Camera and controls

- camera follows the player;
- camera stops at all four world edges;
- player can move far enough that the room leaves the viewport;
- idle and all four walk directions still work;
- WASD and arrows still work;
- mobile joystick stays fixed on screen while the world scrolls;
- releasing or canceling the active touch stops movement;
- build label stays fixed in the upper-right.

List the exact observations in the final task response.

## 12. Documentation and cleanup

After successful runtime inspection:

- update `ASSETS.md` with the new semantic extension atlas and outdoor tile provenance;
- update `PROJECT.md` to record the continuous indoor/outdoor world, player-follow camera and unified pixel grid;
- update `LIBRARY.md` for any new canonical modules or manifests;
- remove obsolete single-room wording;
- do not invent the next gameplay mechanic.

Keep the reusable audit and preview tooling.

Leave `tasks/continuous-world-camera/export/` in the PR for the main chat to decode. The main chat will remove the task directory after adding the binary and completing review.

## 13. Commands

Run:

```bash
npm ci
python -m pip install -r requirements-dev.txt
npm run check
npm run dev -- --host 0.0.0.0
```

Before creating the PR, confirm that the final diff contains no binary additions, modifications or deletions.

Create one final commit.

Do not run `git push`.
Do not use `gh`.
