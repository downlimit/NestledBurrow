<!-- audience: main-chat-review -->
# Review protocol for the main ChatGPT chat

## Audience

This document is the canonical procedure for the main ChatGPT chat acting as virtual lead and reviewer.

Codex does **not** read this file by default. Codex implementation rules are self-contained in `AGENTS.md`; this file governs independent review, repair, merge, publication and documentation maintenance performed by the main chat.

The user supplies vision and evaluates the game. The main chat owns the pipeline and must not require the user to maintain branches, CI, architecture or Markdown consistency.

## 1. Review classes

Classify every PR before deep inspection.

### Documentation-only

Use when only Markdown, comments, templates or non-executable project metadata changed.

Required:

- inspect the complete diff;
- confirm no executable, asset, dependency or workflow file changed;
- run or inspect `check:docs` when available;
- require successful repository CI;
- do not install application or visual dependencies solely for formality.

### Code, non-visual

Use for logic that cannot plausibly change rendered output, assets, input presentation, camera, layout or screen-space behavior.

Required:

- inspect changed files and relevant surrounding code;
- verify targeted tests cover changed behavior and boundary cases;
- inspect CI for the final head SHA;
- download no visual artifact unless presentation can be affected indirectly.

### Visual/runtime

Use for assets, animation, layout, world generation, camera, fullscreen, resize, scaling, CSS canvas behavior, joystick behavior or any change whose correctness is visible or interactive.

Required:

- inspect the complete relevant diff;
- inspect automated checks and stated limitations;
- download the latest final-head artifact once;
- open every required preview or screenshot;
- compare the result to the user's request, not merely to a stored hash;
- verify successful final-head CI before merge.

When uncertain, choose the stricter class.

## 2. Proportionality

Use the lightest process that fully covers realistic failure modes.

- Routine product iterations move directly from user vision to one Codex branch and one final PR.
- Do not require a task-file PR, issue or planning PR before normal implementation.
- A durable task file is reserved for large, high-risk, multi-stage, resumable or repeatedly reused work.
- Do not create documents, checklists, tables, workflows or artifacts merely to demonstrate compliance.
- Do not repeat the same evidence in the prompt, PR body, review comment and final response.
- Omit non-applicable report sections instead of filling long `N/A` lists.
- Strictness applies to relevant risk; proportionality removes irrelevant work, not safety gates.

## 3. Efficient discovery

Start with one compact pass:

1. find the newest relevant open PR;
2. record PR number, title, base SHA, head SHA, branch, lifecycle and draft state;
3. confirm target `main` and no unexpected remote branches;
4. fetch changed filenames or one complete diff;
5. fetch CI state for the current head;
6. identify preview or screenshot artifacts.

After the initial pass, use targeted file reads or patches. Do not repeatedly fetch the same full diff.

Independent reads should run in parallel when tooling permits.

## 4. One-pass defect collection

Before writing to the PR branch:

1. read all relevant changed files;
2. inspect applicable tests and previews;
3. build the complete defect list;
4. separate blockers from optional cleanup;
5. decide one consolidated repair set.

Treat as blockers unless explicitly required:

- unrelated dependency, workflow or infrastructure changes;
- fake or partial vendored replacements for unavailable dependencies;
- weakened tests or validation bypasses;
- claims that unavailable checks passed;
- regression from stale `main`;
- extra remote branches without an approved persistent purpose;
- canonical documentation that materially contradicts the delivered behavior or process.

Default to one repair batch followed by one final CI run. Intermediate tool-forced commits are acceptable; do not evaluate CI until the full repair batch is complete.

## 5. CI discipline

- Ignore intermediate runs while repairs are still being written.
- Evaluate only the workflow for the final intended head SHA.
- Rerun a failed job only when the failure is transient and the branch did not change.
- Never rerun CI to conceal a deterministic failure.
- Confirm artifacts belong to the same final head SHA.
- A Codex-local proxy or install failure is not a reason to alter canonical dependencies.

Path filtering must remain conservative. Changes to runtime entry points, input, fullscreen, HUD, world, visual config, CSS canvas behavior, assets or rendering dependencies require visual/runtime validation.

## 6. Visual and interactive review

A matching hash proves reproducibility, not correctness.

For visual/runtime PRs:

1. download final-head artifacts;
2. open all required previews;
3. inspect geometry, tile meaning, joins, facing, scale and unrelated sprites;
4. ensure previews cover changed states;
5. compare synthetic previews and actual runtime screenshots when both exist;
6. record untested mobile, coarse-pointer, fullscreen, resize or cancellation states as explicit limitations.

Synthetic previews do not prove Phaser runtime behavior.

Interactive input changes require a real browser check whenever available. When neither Codex nor the reviewer can perform the exact gesture, state the limitation and require post-publication user acceptance if residual risk is acceptable.

## 7. Asset-selection gate

Do not allow guessed spritesheet IDs.

When visual meaning is ambiguous:

1. produce a labeled contact sheet or numbered atlas;
2. show it to the user;
3. record approved semantic choices;
4. only then integrate production frames.

Runtime code uses semantic names; raw IDs belong in audit material or manifests.

## 8. Documentation drift gate

The main chat owns documentation accuracy proactively. The user must never need to request routine Markdown maintenance.

Before merge, compare the delivered change against each canonical document by ownership:

- `PROJECT.md` — published state, product architecture, role boundaries, workflow and durable decisions;
- `LIBRARY.md` — important files, entry points and canonical addresses;
- `AGENTS.md` — Codex-only execution rules;
- `REVIEW.md` — main-chat-only review and delivery rules;
- `ASSETS.md` — external asset sources, licensing, hashes and asset policy;
- `tasks/*.md` — only the explicit durable contract of an active complex task.

Rules:

1. Update only documents whose owned facts actually changed.
2. Repair stale documentation in the same implementation branch during review when safe.
3. Do not ask the user to identify drift or choose which Markdown file to edit.
4. Do not copy the same rule into multiple documents; keep one canonical owner and link to it.
5. Do not record planned or unverified behavior as shipped.
6. After merge and `pages/live: success`, recheck that `PROJECT.md` describes the published build rather than the pre-merge branch.
7. If the process itself changes outside an implementation task, create and complete one dedicated documentation PR without waiting for another user reminder.

The automated `check:docs` guard catches audience and routing regressions, but it does not replace semantic review.

## 9. PR and branch discipline

- One coherent implementation concern per PR.
- One ephemeral remote task branch for ordinary work.
- PR opened once after implementation and applicable validation.
- No drafts, close/reopen cycles or replacement PRs as normal workflow.
- Repair the existing branch; do not create a reviewer convenience branch.
- Never push ordinary repairs directly to protected `main`.
- Do not split a task into intermediate PRs that knowingly leave the playable build broken.
- Persistent `release/*`, `archive/*` or `keep/*` branches require explicit reason and repository-side protection.

## 10. Codex report contract

The PR description uses `.github/pull_request_template.md` and keeps only applicable sections.

Every report identifies:

- review class and concise scope;
- work branch, lifecycle and final head SHA;
- whether the PR was opened once and whether extra remote branches were created;
- validation performed;
- real limitations.

Runtime states, devices, artifacts, assets, dependencies and infrastructure are included only when relevant.

The report is evidence to investigate, not proof. The main chat independently verifies it.

## 11. Merge gate

Merge only when all applicable conditions are true:

- branch is safely based on current `main`;
- no unresolved blocker remains;
- final-head CI succeeded;
- required final-head artifacts were opened and accepted;
- interactive limitations are explicit and residual risk is acceptable;
- canonical documentation is accurate for the delivered change;
- PR is not a draft.

After merge:

1. record merge SHA;
2. wait for `pages/live: success` on that SHA;
3. verify automatic deletion of the ephemeral head branch;
4. recheck published-state documentation when the change affected it;
5. only then report the ready public build to the user.

If the branch remains, report the specific branch or use the dedicated cleanup task; do not improvise mass cleanup.

## 12. Communication

- Ask the user only about real product, visual or priority ambiguity.
- Do not ask about branch strategy, test architecture or internal implementation unless it changes the product in a way only the user can decide.
- For a clean PR, review silently and return the result.
- When repairs require another CI cycle, send one concise status update and continue work in the same turn.
- Do not narrate every API call or intermediate commit.
- Do not claim work continues unless the next action actually invokes tools.
- Final messages state material repairs, CI, merge/publication and remaining limitations—not the full internal report.

## 13. Approved optimization backlog

These are directions, not implemented facts until present in the repository:

1. parallel fast and visual PR jobs;
2. conservative path-aware visual skipping;
3. deterministic Playwright runtime screenshots;
4. one clearly named artifact bundle per final head SHA.