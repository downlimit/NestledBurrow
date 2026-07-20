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

Verify every changed state, not only that the page opens. At minimum, visual gameplay changes must be checked at the native `960 × 540` game size and at a mobile/coarse-pointer viewport when touch behavior is involved.

For player movement or animation changes, explicitly verify:

- idle after input is released;
- walk up, down, left and right;
- sprite facing matches movement direction;
- diagonal movement does not increase speed;
- keyboard and mobile joystick still work;
- room boundaries remain correct.

For room or tile changes, explicitly verify:

- the intended floor tile fills the interior;
- horizontal and vertical walls use the intended tiles;
- all corners and wall bands connect correctly;
- no unrelated sprites appear;
- pixels remain crisp;
- the generated `artifacts/room-preview.png` is the intended result.

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
9. Pin the selected asset hashes and the pixel hash of an approved room preview.

When the room atlas or layout changes, `npm run check` must generate `artifacts/room-preview.png`. Do not update `approvedPreviewSha256` until that image has been opened and visually approved. The PR workflow uploads the same preview as an artifact; it must be inspected before merge.

## Completion report

The final task response must list:

- exact commands that were run;
- whether each command passed;
- which runtime states were manually inspected;
- which preview or screenshot artifact was inspected;
- any check that could not be performed and why.

Do not claim that a visual task is complete, and do not update `PROJECT.md` as completed, when the runtime result was not inspected. If browser inspection is unavailable, state that clearly and leave the task for review instead of presenting it as finished.

## Scope

- Do not invent the next game mechanic.
- Do not add dependencies, architecture or infrastructure unrelated to the task.
- Preserve the existing build-id and `pages/live` publication flow unless the task explicitly changes it.
