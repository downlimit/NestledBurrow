<!-- audience: main-chat-review -->
# Review protocol for the main ChatGPT chat

## Audience and ownership

This document is the canonical procedure for the main ChatGPT chat acting as virtual lead and reviewer.

Codex does **not** read this file by default. Codex implementation rules are self-contained in `AGENTS.md`; this file governs independent discovery, review, repair, merge, publication and documentation maintenance performed by the main chat.

The user supplies vision and evaluates the game. The main chat owns the pipeline and must not require the user to maintain branches, CI, architecture, tool routing or Markdown consistency.

## 1. Operational trigger

Messages such as `сделал PR`, `проверь PR`, `прими PR`, `исправь и смержи`, `проверь публикацию` or `посмотри ветку` are execution commands, not requests for a plan or tutorial.

On such a request, the main chat must in the same turn:

1. discover the relevant open PR or branch in `downlimit/NestledBurrow`;
2. obtain the diff or changed files, current head SHA, CI state and applicable artifacts;
3. review and repair the existing branch when needed;
4. merge only after the applicable gate passes;
5. wait for `pages/live: success` and verify ephemeral branch deletion;
6. report the product result and any real remaining limitation.

A response that only restates this procedure, describes future actions, asks the user to provide a diff that can be fetched, or stops after saying that a tool is needed does not satisfy the request.

## 2. Tool acquisition and blocker standard

Tool schemas may be loaded dynamically. Missing a callable function from the current visible context is not proof that the connector action is unavailable.

Use this order:

1. call the direct `GitHub` function when it is already available;
2. otherwise call `api_tool.list_resources` with `paths: ["GitHub"]` and a short exact action keyword such as `fetch_pr_patch`, `workflow`, `artifact`, `merge`, `branch` or `update_file`;
3. invoke the discovered function;
4. when one action is unsuitable, use another supported route that obtains the same evidence, such as changed filenames plus per-file patches instead of one full diff.

Do not claim `fetch_pr_patch` or another described action is unavailable merely because its schema was not preloaded. An environment blocker may be reported only after actual discovery and invocation attempts fail. The report must identify the exact attempted operation and returned error.

Do not ask the user for a PR number, branch name, diff, CI result or manual GitHub action when the repository is known and the information can be discovered.

A side question during active review does not cancel the operation: answer briefly and continue tool calls in the same turn.

## 3. Review classes and proportionality

Choose the lightest class that covers realistic failure modes.

### Documentation-only

Use when only Markdown, comments, templates or non-executable metadata changed.

Required:

- inspect the complete diff;
- confirm no executable, asset, dependency or workflow file changed;
- run or inspect `check:docs` when available;
- require successful repository CI;
- do not install runtime or visual dependencies solely for formality.

### Code, non-visual

Use for logic that cannot plausibly change rendered output, assets, input presentation, camera, layout or screen-space behavior.

Required:

- inspect changed files and relevant surrounding code;
- verify targeted tests cover changed behavior and boundary cases;
- inspect CI for the final head SHA;
- do not demand visual artifacts unless presentation can be affected indirectly.

### Visual/runtime

Use for assets, animation, world generation, camera, fullscreen, resize, scaling, input behavior, CSS canvas behavior or any change whose correctness is visible or interactive.

Required:

- inspect the complete relevant diff;
- inspect automated checks and stated limitations;
- download the latest artifact from the final head SHA;
- open every required preview or screenshot;
- compare the result to the user's request, not merely to a stored hash;
- verify successful final-head CI before merge.

When uncertain, choose the stricter class. Proportionality removes irrelevant work, not relevant safety gates.

Routine product iterations move directly from user vision to one Codex branch and one final PR. Do not require a preparatory task-file PR, issue, checklist, report table, workflow or artifact merely to demonstrate process compliance.

## 4. Efficient discovery

Start with one compact pass:

1. find the newest relevant open PR;
2. record PR number, title, base SHA, head SHA, branch, lifecycle and draft state;
3. confirm the target is `main` and no unexpected remote branches exist;
4. fetch changed filenames or one complete diff;
5. fetch CI state for the current head;
6. identify preview or screenshot artifacts.

After the initial pass, use targeted reads and per-file patches. Do not repeatedly fetch the same full diff. Independent reads should run in parallel when tooling permits.

## 5. One-pass defect collection and repair

Before writing to the PR branch:

1. read all relevant changed files;
2. inspect applicable tests and previews;
3. build the complete defect list;
4. separate blockers from optional cleanup;
5. decide one consolidated repair set.

Treat as blockers unless explicitly required:

- unrelated dependency, workflow or persistent infrastructure changes;
- fake or partial vendored replacements for unavailable dependencies;
- weakened tests or validation bypasses;
- claims that unavailable checks passed;
- regression from stale `main`;
- extra remote branches without an approved persistent purpose;
- canonical documentation that materially contradicts the delivered behavior or process;
- a report or audit presented as completion when the requested mutation did not occur.

Repair the existing PR branch. Default to one consolidated repair batch followed by one final CI run. Tool-forced intermediate commits are acceptable; do not evaluate intermediate CI as final evidence.

When a stale branch conflicts with current `main`, preserve the user's implementation, reconcile the branch, remove any temporary mechanism before final review, and ensure the final diff contains no persistent workaround infrastructure.

## 6. CI and evidence discipline

- Evaluate only the workflow for the final intended head SHA.
- Rerun a failed job only when failure is transient and the branch did not change.
- Never rerun CI to conceal a deterministic failure.
- Confirm artifacts belong to the same final head SHA.
- A Codex-local proxy, package or browser-install failure is not a reason to alter canonical dependencies or tests.
- Successful compilation is not proof of correct runtime behavior.

Changes to runtime entry points, input, fullscreen, HUD, world, visual config, CSS canvas behavior, assets or rendering dependencies require visual/runtime validation.

## 7. Visual and interactive review

A matching hash proves reproducibility, not correctness.

For visual/runtime PRs:

1. download final-head artifacts;
2. open all required previews;
3. inspect geometry, tile meaning, joins, facing, scale and unrelated sprites;
4. ensure previews cover the changed states;
5. compare synthetic previews and actual runtime screenshots when both exist;
6. record untested mobile, coarse-pointer, fullscreen, resize or cancellation states as explicit limitations.

Synthetic previews do not prove Phaser runtime behavior. When neither Codex nor the reviewer can perform the exact interaction, state the limitation and require post-publication user acceptance when residual risk is acceptable.

Do not allow guessed spritesheet IDs. When visual meaning is ambiguous, produce a labeled atlas, obtain user approval and then integrate semantic choices.

## 8. Documentation drift gate

The main chat owns documentation accuracy proactively. The user must never need to request routine Markdown maintenance.

Before merge, compare the delivered change against each canonical owner:

- `PROJECT.md` — published state, product architecture, role boundaries, workflow and durable decisions;
- `LIBRARY.md` — important files, entry points and canonical addresses;
- `AGENTS.md` — Codex-only execution rules;
- `REVIEW.md` — main-chat-only review and delivery rules;
- `ASSETS.md` — external sources, licensing, hashes and asset policy;
- `tasks/*.md` — only the explicit durable contract of an active complex task.

Rules:

1. update only documents whose owned facts changed;
2. repair stale documentation in the same implementation branch when safe;
3. do not ask the user to identify drift or choose the Markdown file;
4. keep one canonical owner for each rule instead of copying full text across documents;
5. do not record planned or unverified behavior as shipped;
6. after merge and `pages/live: success`, recheck that `PROJECT.md` describes the published build;
7. when the process itself changes, create and complete one focused documentation PR without waiting for another reminder.

`check:docs` catches explicit contract regressions but does not replace semantic review.

## 9. PR and branch discipline

- One coherent implementation concern per PR unless the user explicitly combines concerns and a single delivery unit is safer.
- One ephemeral remote task branch for ordinary work.
- PR opened once after implementation and applicable validation.
- No draft, close/reopen or replacement-PR cycles as a normal development mechanism.
- Never push ordinary work directly to protected `main`.
- Do not split work into intermediate PRs that knowingly leave the playable build broken.
- Persistent `release/*`, `archive/*` or `keep/*` branches require explicit reason and repository-side protection.
- Temporary repair workflows or scripts must remove themselves and must not remain in the final diff.

The PR description is evidence to investigate, not proof. It must identify review class, scope, branch/lifecycle, final head SHA, validation and real limitations.

## 10. Merge and publication gate

Merge only when all applicable conditions are true:

- branch is safely based on current `main`;
- no unresolved blocker remains;
- final-head CI succeeded;
- required final-head artifacts were opened and accepted;
- interactive limitations are explicit and residual risk is acceptable;
- canonical documentation is accurate;
- PR is not a draft.

After merge:

1. record merge SHA;
2. wait for `pages/live: success` on that SHA;
3. verify automatic deletion of the ephemeral head branch;
4. recheck published-state documentation when affected;
5. only then report the public build as ready.

If the branch remains, report the exact branch or use the dedicated cleanup task. Do not improvise mass cleanup.

## 11. Communication

- Ask the user only about real product, visual or priority ambiguity.
- Do not ask about branch strategy, tests, connector routing or internal implementation unless it changes the product in a way only the user can decide.
- For a clean PR, review silently and return the result.
- When repairs require another CI cycle, send one concise status update and continue work.
- Do not narrate every API call or intermediate commit.
- Do not say work continues unless the next action actually invokes tools.
- Final messages state material repairs, CI, merge/publication and remaining limitations—not the full internal report.
