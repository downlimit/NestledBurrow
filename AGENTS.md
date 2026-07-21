# Codex operating rules

These rules apply to every task in this repository.

## Before editing

1. Read the task file first, including its `Git lifecycle` section.
2. Read `PROJECT.md`, `LIBRARY.md` and the files directly related to the task.
3. Run `git fetch --prune` and verify that the task branch starts from the current `origin/main`.
4. Use the single task branch already supplied by Codex, or the one explicit branch named in the task. Never push task work directly to `main` and never create an additional remote branch.
5. Read `REVIEW.md` before preparing the pull request and follow its report contract.

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

Never report an unavailable or unperformed check as passed. Record the exact limitation in the PR description.

### Dependency and environment integrity

A local network, proxy, package-index or browser-install failure does not authorize changing the repository merely to make the local environment pass.

- Do not vendor a fake or partial replacement for a missing dependency.
- Do not add fallback packages, compatibility modules, generated binaries, dependency changes, workflow changes or test bypasses unless the task explicitly requires them.
- Do not alter canonical validation scripts because a local install failed.
- Run every check that remains possible, report the limitation, and let the canonical GitHub Actions environment validate the unchanged dependency setup.
- Any genuine dependency or CI repair must be a deliberate, separately reviewed part of the task scope.

For player movement, joystick or animation changes, explicitly verify:

- idle after input is released;
- walk up, down, left and right;
- sprite facing matches movement direction;
- diagonal movement does not increase speed;
- keyboard and mobile joystick still work;
- cancellation, blur and lost-touch states do not leave movement stuck;
- room and world boundaries remain correct.

For fullscreen, resize or screen-space UI changes, explicitly verify:

- enter and exit through every supported path;
- state and icon synchronization after system exit or `Esc`;
- integer zoom and crisp pixels after resize/fullscreen transitions;
- desktop and mobile/coarse-pointer layouts;
- DOM UI does not trigger gameplay input.

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

- Develop in the single task branch without an open pull request.
- Complete implementation, self-review, browser inspection and all known repairs before creating the PR.
- Run the mandatory local checks before creating the PR.
- Create exactly one final PR after the branch is ready for review. Do not use draft PRs, closing/reopening, or repeated PR creation as a development or notification-suppression mechanism.
- Use `.github/pull_request_template.md` and classify the PR as `docs`, `code` or `visual/runtime`.
- Do not knowingly open a PR with obvious defects merely because automated checks pass.
- Batch related final corrections before asking for review; avoid one push per small defect.
- Keep one coherent implementation concern per PR when `main` can remain usable between stages.
- Do not combine unrelated architecture, gameplay, visual, dependency and infrastructure changes.
- State every manual-test limitation explicitly. A missing browser, mobile device or coarse-pointer runtime is not a passed check.
- Ensure preview artifacts and the PR report refer to the final head commit.

When a visual choice is ambiguous, stop before production integration and provide labeled numbered options for user approval. This applies especially to wall corners, transitions, directional animation frames and visually similar tiles. Do not substitute a guessed transform for an unverified source tile.

## Branch lifecycle

Every task file must contain a `Git lifecycle` section based on `tasks/TEMPLATE.md`.

- Normal tasks use exactly one remote task branch. Temporary local branches and worktrees are allowed but must never be pushed to `origin`.
- Never push ordinary task work directly to `main`.
- Normal task branches are `ephemeral`. GitHub automatic head-branch deletion handles them after merge.
- Do not try to delete the active task branch from inside the implementation task. After merge, the main chat verifies automatic deletion; any branch that remains is handled by the dedicated cleanup task.
- A task may mark a branch `persistent` only for an explicit release, archive or long-lived integration purpose.
- Persistent branches must use `release/`, `archive/` or `keep/`, include a written reason, and have repository-side deletion protection before they are relied upon.
- Never delete or rewrite `main`, `release/*`, `archive/*` or `keep/*`.
- Never modify branch protection, rulesets, repository settings or access tokens as part of a normal implementation task. Administrative changes require an explicit separate task and existing administrative authorization.
- Never ask for a broader administrative token merely to finish a normal code task.
- Never delete a branch with an open pull request.
- A branch from a closed unmerged PR may be deleted only after verifying that its useful changes were merged elsewhere, explicitly superseded, or intentionally abandoned.
- Do not perform mass branch cleanup as a side effect of an implementation task. Cleanup requires `tasks/branch-cleanup.md` or another dedicated maintenance task.
- Before cleanup, inspect remote branches, unique commits, associated PR state and any deployment/protection role. Report the exact preserved and deleted sets.
- If branch status is ambiguous or deletion permission is unavailable, preserve it and report the blocker instead of guessing or weakening protection.

## Pixel-grid protocol

All world art drawn from the same source pixel grid must use one visual pixel size.

- Do not assign separate display scales to the player, room, outdoor ground or props when their source assets share the same 16×16 grid.
- Prefer native-size world assets and one shared logical render grid over independently scaled sprites.
- The displayed canvas must be an integer multiple of the logical game resolution. Letterboxing is acceptable; fractional canvas scaling is not.
- Use nearest-neighbor rendering only: `pixelArt: true`, `antialias: false`, `roundPixels: true` and `image-rendering: pixelated`.
- Camera following must not introduce subpixel sampling. Camera scroll and follow results must be rounded to the logical pixel grid.
- A visual change must be checked at at least two different viewport sizes. Confirm that one source pixel remains one consistently sized square block within each viewport.
- Automated checks must reject reintroduction of independent world-art scale constants or fractional display zoom.

UI may use its own typography and dimensions, but it must remain screen-space UI and must not change the world-art pixel scale.

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

- review class: `docs`, `code` or `visual/runtime`;
- task branch and final head SHA;
- confirmation that no additional remote branches were created;
- confirmation that the PR was opened once after implementation and validation;
- exact commands that were run and whether each passed;
- runtime states and viewport sizes manually inspected;
- preview or screenshot artifacts inspected;
- any check that could not be performed and why;
- user-approved source frame numbers when asset selection was involved;
- any deliberate dependency, workflow or infrastructure change in scope.

Do not claim that a visual/runtime task is complete, and do not update `PROJECT.md` as completed, when the runtime result was not inspected. If browser inspection is unavailable, state that clearly and leave the task for strict review instead of presenting it as fully verified.

## Scope

- Do not invent the next game mechanic.
- Do not add dependencies, architecture, compatibility layers, fallback packages or infrastructure unrelated to the task.
- Do not commit generated artifacts unless the repository explicitly tracks them or the task requires them.
- Preserve the existing build-id and `pages/live` publication flow unless the task explicitly changes it.
