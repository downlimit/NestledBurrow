# Review protocol for the main chat

This document is the canonical operating procedure for the main ChatGPT chat when it reviews Codex pull requests, repairs them, merges them and verifies publication.

The goal is to keep review strict without wasting time on repeated full CI cycles, duplicate GitHub reads, branch clutter or visual ambiguity that should have been resolved before implementation.

## 1. Review classes

Classify every PR before deep inspection.

### Documentation-only

Use when only Markdown, comments, templates or non-executable project metadata changed.

Required review:

- inspect the complete diff;
- confirm no executable, asset, dependency or workflow file changed;
- require successful CI when the repository workflow runs it;
- no local application dependency installation, runtime inspection or visual artifact download is required solely for formality.

### Code, non-visual

Use for logic that does not change rendered output, assets, camera, layout, input presentation or screen-space behavior.

Required review:

- inspect changed files and relevant surrounding code;
- verify tests cover changed behavior and boundary cases;
- inspect CI steps and failures if any;
- no visual artifact download unless the change can indirectly affect runtime presentation.

### Visual/runtime

Use for assets, spritesheets, animation, layout, world generation, camera, fullscreen, resize, scaling, CSS canvas behavior, joystick placement or any change whose correctness is visible or interactive in the running game.

Required review:

- inspect the complete relevant diff;
- inspect automated checks and runtime-report limitations;
- download the latest workflow artifact once;
- open every required preview or screenshot;
- compare the artifact to the actual user request, not merely to its stored hash;
- verify the final head commit has successful CI before merge.

When uncertain, choose the stricter class.

## Proportionality rule

Review effort, evidence and reporting must be proportional to the real risk of the change.

- Use the lightest review class that fully covers the ways the change can fail.
- Do not demand runtime screenshots, device matrices, preview artifacts or local dependency installation for a documentation-only change.
- Do not turn a small non-visual code change into a visual review unless it can plausibly alter presentation or interaction.
- Do not create an issue, design document, checklist, report table, test harness, workflow or artifact merely to demonstrate process compliance.
- New process infrastructure is justified only when it materially reduces a recurring risk or will be reused.
- Prefer one canonical document over overlapping documents that repeat the same facts.
- In PR reports, omit non-applicable sections instead of producing long `N/A` lists.
- Do not repeat the same evidence across the task file, PR body, review comment and final user response.
- Safety gates remain strict for high-risk changes; proportionality means removing irrelevant work, not skipping relevant validation.

## 2. Efficient discovery

Start with one compact discovery pass:

1. Find the newest open PR.
2. Record PR number, title, base SHA, head SHA, task branch, lifecycle, draft state and changed-file count.
3. Confirm that the PR targets `main` and that no unexpected extra remote branch was created for the task.
4. Fetch the changed filename list or one complete diff.
5. Fetch CI state for the current head SHA.
6. Identify whether preview or screenshot artifacts exist.

Do not repeatedly fetch the same full PR diff after every small operation. After the initial pass, use targeted file reads or patches for files that require deeper inspection.

Independent reads should be performed in parallel when tooling permits: CI state, changed filenames, PR body and artifact metadata do not depend on one another.

## 3. One-pass defect collection

Before writing to the PR branch:

1. Read all relevant changed files.
2. Inspect applicable tests and generated previews.
3. Build a complete defect list.
4. Separate blockers from optional cleanup.
5. Decide the full repair set.

Treat these as blockers unless explicitly required by the task:

- unrelated dependency, workflow or infrastructure changes;
- vendored fake or partial replacements for unavailable dependencies;
- test bypasses or validation scripts weakened to accommodate a local environment;
- claims that unavailable browser, mobile or dependency checks passed;
- work based on stale `main` that discards or regresses already published behavior;
- extra remote branches created without a documented persistent purpose.

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
- A Codex-local proxy or package-install failure is not a reason to modify canonical dependencies; GitHub Actions is the canonical clean validation environment.

The preferred repository architecture is:

- a fast job for input, pure logic, static checks and production build;
- a visual job for Python dependencies, preview generation, browser screenshots and artifact upload;
- both jobs running in parallel;
- path-aware skipping of the visual job for documentation-only or clearly non-visual PRs.

Path filtering must remain conservative. Changes to `src/main.js`, `src/input.js`, `src/fullscreen.js`, `src/world*`, `src/roomLayout.js`, `src/visualConfig.js`, `src/style.css`, `public/assets/**`, visual scripts or rendering dependencies require visual/runtime validation.

## 5. Visual and interactive review protocol

A matching pixel hash proves reproducibility, not correctness. The reviewer must still open the images.

For each visual/runtime PR:

1. Download the latest artifact from the final head SHA.
2. Open all mandated previews.
3. Check geometry, tile meaning, joins, facing, scale consistency and unrelated sprites.
4. Check that previews cover the changed states rather than only a convenient static view.
5. Compare runtime screenshots and synthetic previews when both exist.
6. Treat an untested coarse-pointer/mobile, fullscreen, resize or cancellation state as an explicit remaining limitation.

Synthetic Python previews remain useful for asset and layout determinism but do not prove that Phaser rendered or behaved correctly.

Changes to joystick, fullscreen, resize, focus/cancellation or other interactive input require a real browser check whenever the available tools support it. When neither Codex nor the reviewer can perform that interaction, do not describe it as verified; document the limitation and require a post-publication user acceptance check if the remaining risk is acceptable.

Browser automation should eventually capture deterministic runtime screenshots for:

- logical 320×180 output;
- a desktop viewport with integer zoom;
- a narrow mobile viewport;
- indoor and outdoor camera positions;
- HUD and dynamic joystick screen-space placement;
- fullscreen enter/exit states where browser automation permits it.

## 6. Asset-selection gate

Do not let Codex guess visually ambiguous spritesheet IDs.

Before implementation when asset meaning is uncertain:

1. Produce a labeled contact sheet or an interactive numbered atlas.
2. Show it to the user.
3. Record the user-approved frame numbers or semantic choices.
4. Only then build or update the semantic atlas.

This gate is mandatory for directional corners, transition tiles, animation frames and other cases where several source frames are structurally valid but semantically different.

Runtime code must continue to use semantic names. Raw source IDs belong in the audit manifest and review material only.

## 7. PR and branch discipline

Prefer one coherent implementation concern per PR.

- Ordinary task work must stay on one ephemeral remote branch.
- The PR must be opened once, after implementation and applicable local validation are complete.
- Do not use drafts, close/reopen cycles or multiple replacement PRs as a normal development workflow.
- Repair the existing PR branch when safe; do not create a second remote repair branch merely for reviewer convenience.
- Do not push ordinary task repairs directly to protected `main`.
- Large changes should be split only when each part leaves `main` usable and testable.
- Do not split a task into intermediate PRs that knowingly leave the playable build broken.
- A PR that simultaneously changes assets, camera, collision, input, dependencies, CI and documentation is high-risk and must be reviewed through the visual/runtime path.

Persistent `release/*`, `archive/*` or `keep/*` branches require an explicit reason and repository-side deletion protection. The reviewer must not assume that a name alone provides protection.

## 8. Codex report contract

The PR description must use `.github/pull_request_template.md`, but keep only sections applicable to the review class and actual risk.

Every report must state:

- review class and concise scope;
- task branch, lifecycle and final head SHA;
- whether the PR was opened once and whether additional remote branches were created;
- validation performed and any real limitation.

Add runtime states, viewports, devices, artifacts, asset choices, dependency changes, workflow changes or infrastructure changes only when they apply. A concise docs-only report is correct; padding it with irrelevant fields is not.

The report is evidence to investigate, not proof. The main chat independently verifies code, CI and applicable artifacts.

## 9. Merge gate

Merge only when all applicable conditions are true:

- the branch is based on current `main` or is otherwise safely mergeable without regression;
- no unresolved blocker remains;
- required CI for the final head SHA succeeded;
- required visual artifacts from the final head SHA were opened and accepted;
- interactive limitations are explicit and the residual risk is acceptable;
- documentation accurately describes implemented behavior;
- the PR is no longer a draft.

After merge:

1. Record the merge SHA.
2. Wait for `pages/live: success` on that SHA.
3. Verify that GitHub automatic head-branch deletion removed the ephemeral task branch.
4. If the branch remains, do not improvise a mass cleanup; use `tasks/branch-cleanup.md` or report the specific branch.
5. Only then tell the user that the public build is ready and provide the full clickable URL.

## 10. Communication timing

Do not leave the user waiting without context during an unusually long review.

- For a quick clean PR, review silently and return the result.
- When repair and a repeated CI cycle are required, send one concise status message stating that defects were found and final CI is running.
- Do not narrate every API call or intermediate commit.
- If the user asks a minor question during an active review, answer it briefly and then continue the review in the same turn before sending the final result.
- Do not say that work is continuing unless the next action actually invokes the required tools.
- The final message should state only the outcome relevant to the user: material repairs, CI result, merge/publication status and any remaining blocker. Do not repeat the full PR report.

## 11. Current optimization backlog

The following infrastructure improvements are approved directions but are not considered implemented until they exist in the repository:

1. Split PR checks into parallel fast and visual jobs.
2. Add conservative path-aware visual-job skipping.
3. Add deterministic Playwright runtime screenshots.
4. Upload one clearly named artifact bundle per final head SHA.

The standard adaptive PR report template is implemented at `.github/pull_request_template.md`. npm and pip caches are already configured in the current workflows.

Until the remaining improvements are implemented, the reviewer follows the existing workflow and optimizes primarily by batching repairs, applying only relevant validation and avoiding redundant reads or reruns.
