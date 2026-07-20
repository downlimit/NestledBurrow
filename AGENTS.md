# Codex operating rules

These rules apply to every task in this repository.

## Before editing

1. Read `PROJECT.md` and `LIBRARY.md`.
2. Read the files directly related to the task.
3. Confirm that the task branch starts from the current `main`.

## Mandatory validation

A task is not complete because the code compiles. Before creating a PR, run:

```bash
npm ci
python -m pip install -r requirements-dev.txt
npm run check
```

For any visual, animation, input, layout or runtime change, also launch the game and inspect the actual result in a browser:

```bash
npm run dev -- --host 0.0.0.0
```

Verify every changed state, not only that the page opens. At minimum, visual gameplay changes must be checked at the native logical game size and at a mobile/coarse-pointer viewport when touch behavior is involved.

For player movement or animation changes, explicitly verify:

- idle after input is released;
- walk up, down, left and right;
- sprite facing matches movement direction;
- diagonal movement does not increase speed;
- keyboard and mobile joystick still work;
- room and world boundaries remain correct.

For room, world or tile changes, explicitly verify:

- the intended floor and outdoor ground tiles fill their areas;
- horizontal and vertical walls use the intended tiles;
- all corners and wall bands connect and face the correct direction;
- doors or openings are genuinely traversable;
- no unrelated sprites appear;
- pixels remain crisp;
- every generated preview artifact is the intended result.

## Pixel-grid protocol

All world art drawn from the same source pixel grid must use one visual pixel size.

- Do not assign separate display scales to the player, room, outdoor ground or props when their source assets share the same 16×16 grid.
- Prefer native-size world assets and one shared logical render grid over independently scaled sprites.
- The displayed canvas must be an integer multiple of the logical game resolution. Letterboxing is acceptable; fractional canvas scaling is not.
- Use nearest-neighbor rendering only: `pixelArt: true`, `antialias: false`, `roundPixels: true` and `image-rendering: pixelated`.
- Camera following must not introduce subpixel sampling. Camera scroll and follow results must be rounded to the logical pixel grid.
- A visual change must be checked at at least two different viewport sizes. Confirm that one source pixel remains one consistently sized square block within each viewport.
- Automated checks must reject reintroduction of independent world-art scale constants or fractional display zoom.

UI may use its own typography and dimensions, but it must be fixed to the camera with `scrollFactor(0)` and must not change the world-art pixel scale.

## Third-party spritesheet protocol

Never select production assets by guessing raw spritesheet frame indexes.

Before integrating a spritesheet pack:

1. Read the pack metadata, tile dimensions, margin and spacing.
2. Prefer standalone source PNG files when the pack provides them.
3. Generate a labeled contact sheet for every source frame when a sheet must be inspected.
4. Render supplied sample maps when available to confirm how related tiles are assembled.
5. Select frames only after visual inspection.
6. Extract the selected art into semantically named standalone files or a compact semantic atlas. Runtime code must never load a large source sheet by raw numeric IDs.
7. Record the source pack, source sheet geometry, original frame number or rectangle and SHA-256 in a canonical manifest.
8. Reference semantic frame names in gameplay code. Raw source frame numbers belong only in the audit manifest.
9. Pin the selected asset hashes and the pixel hash of approved visual previews.

When an atlas, layout or world composition changes, `npm run check` must generate the relevant preview artifacts. Do not update an approved preview hash until the image has been opened and visually approved. The PR workflow must upload the same preview for inspection before merge.

## Completion report

The final task response must list:

- exact commands that were run;
- whether each command passed;
- which runtime states were manually inspected;
- which preview or screenshot artifacts were inspected;
- which viewport sizes were checked for pixel consistency;
- any check that could not be performed and why.

Do not claim that a visual task is complete, and do not update `PROJECT.md` as completed, when the runtime result was not inspected. If browser inspection is unavailable, state that clearly and leave the task for review instead of presenting it as finished.

## Scope

- Do not invent the next game mechanic.
- Do not add dependencies, architecture or infrastructure unrelated to the task.
- Preserve the existing build-id and `pages/live` publication flow unless the task explicitly changes it.
