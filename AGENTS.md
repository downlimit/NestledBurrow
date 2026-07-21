# Codex operating rules

These rules apply to every task in this repository.

## Before editing

1. Read `PROJECT.md` and `LIBRARY.md`.
2. Read the files directly related to the task.
3. Confirm that the task branch starts from the current `main`.
4. Read `REVIEW.md` before preparing the pull request and follow its report contract.

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

## Review-efficient delivery

Prepare work so the main-chat review can be strict without unnecessary repeated CI cycles or notification mail.

- Develop in a feature branch without an open pull request.
- Complete implementation, self-review, browser inspection and all known repairs before creating the PR.
- Run the mandatory local checks before creating the PR.
- Create the PR once, after the branch is ready for review. Do not use draft PRs as a development workspace.
- Classify the PR as `docs`, `code` or `visual` in its description.
- Do not knowingly open a PR with obvious visual defects merely because automated checks pass.
- Batch related final corrections before asking for review; avoid one push per small defect.
- Keep one coherent implementation concern per PR when `main` can remain usable between stages.
- Do not combine unrelated architecture, gameplay, visual and infrastructure changes.
- State every manual-test limitation explicitly. A missing browser, mobile device or coarse-pointer runtime is not a passed check.
- Ensure preview artifacts and the PR report refer to the final head commit.

When a visual choice is ambiguous, stop before production integration and provide labeled numbered options for user approval. This applies especially to wall corners, transitions, directional animation frames and visually similar tiles. Do not substitute a guessed transform for an unverified source tile.

## Branch lifecycle

Every task file must contain a `Git lifecycle` section based on `tasks/TEMPLATE.md`.

- Use the single remote task branch supplied by Codex, or the one explicit work branch named in the task. Do not create or push additional remote branches.
- Temporary local branches and worktrees are allowed, but they must never be pushed to `origin`.
- Normal task branches are `ephemeral`. GitHub is expected to delete them automatically after merge.
- A task may mark a branch `persistent` only for an explicit release, archive or long-lived integration purpose.
- Persistent branches must use one of these prefixes: `release/`, `archive/`, `keep/`.
- Never delete or rewrite `main`, `release/*`, `archive/*` or `keep/*`.
- Never delete a branch with an open pull request.
- A branch from a closed unmerged PR may be deleted only after verifying that its useful changes were merged elsewhere, explicitly superseded, or intentionally abandoned.
- Do not perform mass branch cleanup as a side effect of an implementation task. Cleanup requires a dedicated task.
- Before any cleanup, run `git fetch --prune`, inspect remote branches and associated PR state, and report the exact preserved and deleted sets.
- If branch status is ambiguous, preserve it and report the ambiguity instead of deleting it.

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
6. For semantically ambiguous frames, obtain explicit user approval of the numbered choices before integration.
7. Centralize selected frames behind semantic configuration names; gameplay behavior must not contain unexplained numeric indexes.
8. For large or ambiguous source sheets, extract selected art into semantically named standalone files or a compact semantic atlas.
9. A compact author-provided canonical sheet may be loaded directly only when its grid is verified, selected frames are centralized in one configuration module, the source is documented in `ASSETS.md`, and the rendered preview is visually approved.
10. Record source pack, sheet geometry, selected frame rectangles or indexes and asset hashes in canonical documentation or a manifest.
11. Pin or otherwise verify the pixel output of approved visual previews when the layout becomes a stable production baseline.

When an atlas, layout or world composition changes, `npm run check` must generate the relevant preview artifacts. The PR workflow must upload the same preview for inspection before merge.

## Completion report

The PR description and final task response must list:

- review class: `docs`, `code` or `visual`;
- exact commands that were run;
- whether each command passed;
- which runtime states were manually inspected;
- which preview or screenshot artifacts were inspected;
- which viewport sizes were checked for pixel consistency;
- any check that could not be performed and why;
- user-approved source frame numbers when asset selection was involved.

Do not claim that a visual task is complete, and do not update `PROJECT.md` as completed, when the runtime result was not inspected. If browser inspection is unavailable, state that clearly and leave the task for review instead of presenting it as finished.

## Scope

- Do not invent the next game mechanic.
- Do not add dependencies, architecture or infrastructure unrelated to the task.
- Preserve the existing build-id and `pages/live` publication flow unless the task explicitly changes it.
