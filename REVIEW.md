# Review protocol for the main chat

This document is the canonical operating procedure for the main ChatGPT chat when it reviews Codex pull requests, repairs them, merges them and verifies publication.

The goal is to keep review strict without wasting time on repeated full CI cycles, duplicate GitHub reads or visual ambiguity that should have been resolved before implementation.

## 1. Review classes

Classify every PR before deep inspection.

### Documentation-only

Use when only Markdown, comments or non-executable project metadata changed.

Required review:

- inspect the complete diff;
- confirm no executable, asset or workflow file changed;
- require successful fast CI when the repository workflow still runs it;
- no visual artifact download is required.

### Code, non-visual

Use for logic that does not change rendered output, assets, camera, layout or input presentation.

Required review:

- inspect changed files and relevant surrounding code;
- verify tests cover changed behavior and boundary cases;
- inspect CI steps and failures if any;
- no visual artifact download unless the change can indirectly affect runtime presentation.

### Visual/runtime

Use for assets, spritesheets, animation, layout, world generation, camera, scaling, CSS canvas behavior, joystick placement or any change whose correctness is visible in the running game.

Required review:

- inspect the complete relevant diff;
- inspect automated checks and runtime-report limitations;
- download the latest workflow artifact once;
- open every required preview or screenshot;
- compare the artifact to the actual user request, not merely to its stored hash;
- verify the final head commit has successful CI before merge.

When uncertain, choose the stricter class.

## 2. Efficient discovery

Start with one compact discovery pass:

1. Find the newest open PR.
2. Record PR number, title, base SHA, head SHA, draft state and changed-file count.
3. Fetch the changed filename list or one complete diff.
4. Fetch CI state for the current head SHA.
5. Identify whether preview artifacts exist.

Do not repeatedly fetch the same full PR diff after every small operation. After the initial pass, use targeted file reads or patches for files that require deeper inspection.

Independent reads should be performed in parallel when tooling permits: CI state, changed filenames, PR body and artifact metadata do not depend on one another.

## 3. One-pass defect collection

Before writing to the PR branch:

1. Read all relevant changed files.
2. Inspect tests and generated previews.
3. Build a complete defect list.
4. Separate blockers from optional cleanup.
5. Decide the full repair set.

Do not commit the first problem immediately after noticing it. The default is one consolidated repair batch followed by one repeated CI run.

Exceptions:

- a preliminary repair is required to make files readable or CI runnable;
- the branch changes underneath the review;
- a newly generated artifact reveals a genuinely new defect that could not have been known before the repair.

When multiple text files must be repaired through GitHub APIs, prefer one tree/commit operation when available. If tooling forces sequential commits, finish all edits before evaluating CI and do not wait for intermediate runs.

## 4. CI rerun discipline

Every push can trigger a full workflow. Avoid paying that cost repeatedly.

- Ignore intermediate runs while a repair batch is still being written.
- Evaluate only the workflow for the final intended head SHA.
- Rerun a failed job only when the failure is transient and the branch did not change.
- Do not rerun CI to conceal a deterministic test failure.
- After successful CI, confirm that the artifact belongs to the same final head SHA.

The preferred repository architecture is:

- a fast job for input, pure logic, static checks and production build;
- a visual job for Python dependencies, preview generation, browser screenshots and artifact upload;
- both jobs running in parallel;
- path-aware skipping of the visual job for documentation-only or clearly non-visual PRs.

Path filtering must remain conservative. Changes to `src/main.js`, `src/world*`, `src/roomLayout.js`, `src/visualConfig.js`, `src/style.css`, `public/assets/**`, visual scripts or rendering dependencies require visual validation.

## 5. Visual review protocol

A matching pixel hash proves reproducibility, not correctness. The reviewer must still open the images.

For each visual PR:

1. Download the latest artifact from the final head SHA.
2. Open all mandated previews.
3. Check geometry, tile meaning, joins, facing, scale consistency and unrelated sprites.
4. Check that previews cover the changed states rather than only a convenient static view.
5. Compare runtime screenshots and synthetic previews when both exist.
6. Treat an untested coarse-pointer/mobile state as an explicit remaining limitation.

Browser automation should eventually capture deterministic runtime screenshots for:

- logical 320×180 output;
- a desktop viewport with integer zoom;
- a narrow mobile viewport;
- indoor and outdoor camera positions;
- HUD and joystick screen-space placement.

Synthetic Python previews remain useful for asset and layout determinism but must not be treated as proof that Phaser rendered or behaved correctly.

## 6. Asset-selection gate

Do not let Codex guess visually ambiguous spritesheet IDs.

Before implementation when asset meaning is uncertain:

1. Produce a labeled contact sheet or an interactive numbered atlas.
2. Show it to the user.
3. Record the user-approved frame numbers or semantic choices.
4. Only then build or update the semantic atlas.

This gate is mandatory for directional corners, transition tiles, animation frames and other cases where several source frames are structurally valid but semantically different.

Runtime code must continue to use semantic names. Raw source IDs belong in the audit manifest and review material only.

## 7. PR sizing

Prefer one coherent implementation concern per PR.

Large changes should be split when each part can leave `main` usable and testable. Good boundaries include:

- render scale and camera infrastructure;
- world layout and collision;
- asset selection and visual composition.

Do not split a task into intermediate PRs that knowingly leave the playable build broken.

A PR that simultaneously changes assets, camera, collision, input, CI and documentation should be treated as high-risk and reviewed through the visual/runtime path.

## 8. Codex report contract

The PR description must state:

- review class: `docs`, `code` or `visual`;
- concise scope;
- exact commands run and results;
- runtime states inspected;
- viewport sizes inspected;
- artifact names inspected;
- limitations and skipped checks;
- user-approved source frame IDs when asset selection was involved.

The report is evidence to investigate, not proof. The main chat independently verifies code, CI and artifacts.

## 9. Merge gate

Merge only when all applicable conditions are true:

- the branch is based on current `main` or is otherwise safely mergeable;
- no unresolved blocker remains;
- required CI for the final head SHA succeeded;
- required visual artifacts from the final head SHA were opened and accepted;
- documentation accurately describes implemented behavior;
- the PR is no longer a draft.

After merge:

1. Record the merge SHA.
2. Wait for `pages/live: success` on that SHA.
3. Only then tell the user that the public build is ready and provide the full clickable URL.

## 10. Communication timing

Do not leave the user waiting without context during an unusually long review.

- For a quick clean PR, review silently and return the result.
- When repair and a repeated CI cycle are required, send one concise status message stating that defects were found and the final CI is running.
- Do not narrate every API call or intermediate commit.
- The final message should state what was repaired, CI result, merge SHA and publication status.

## 11. Current optimization backlog

The following infrastructure improvements are approved directions but are not considered implemented until they exist in the repository:

1. Split PR checks into parallel fast and visual jobs.
2. Add conservative path-aware visual-job skipping.
3. Add deterministic Playwright runtime screenshots.
4. Upload one clearly named artifact bundle per final head SHA.
5. Keep dependency caches for npm and pip.
6. Add a standard PR template matching the Codex report contract.

Until these are implemented, the reviewer follows the existing workflow and optimizes primarily by batching repairs and avoiding redundant reads or reruns.
