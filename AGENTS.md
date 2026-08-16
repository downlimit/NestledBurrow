<!-- audience: codex -->
# Codex rules

## Route

- Codex flow: brief → implementation → local preview → `принято` → one Ready PR → CI → merge. Only ChatGPT direct may use a public Draft preview before `принято`.
- Never ask the user to operate GitHub.
- Stop before merge only for explicit `не сливать`, report-only work, a real blocker, or the `Delivery escalation` route below.
- Draft PR before acceptance is allowed only by explicit user command; it is a preview carrier, not a development or final-CI gate.
- Acceptance, Ready state, PR number and merge status never justify a source/documentation commit. Never create an empty commit.
- Preserve Task identity: `Task #<number> — <name>` and `task/<number>-<slug>`.
- Late Task-number collision: when a number was free at work start and becomes occupied on `origin/main` before publication finishes, Codex may assign the current `ROADMAP.md` next-free number without further confirmation. Rebase onto current `origin/main` and update the Task identity, task-specific files/checks, branch, commit and PR consistently while preserving the accepted name and scope.
- If the collided number already has a PR, close that obsolete PR, establish one replacement Ready PR, and then remove the obsolete remote branch. Treat this replacement as the same publication cycle.

## Context

Read:

1. the prompt;
2. this file and `AGENTS.override.md`;
3. only the system documents named in the prompt or selected through `LIBRARY.md`;
4. relevant source, tests and config.

Do not read `PROJECT.md`, `LEAD.md`, full `GAME.md`, full `ROADMAP.md`, `FAST_LOOP.md`, every `systems/*.md` or historical `tasks/*.md` unless the task explicitly changes their facts. Expand context only after finding a real dependency.

Before editing: fetch, branch from supplied Base SHA/current `origin/main`, preserve unrelated work, then run `npm run codex:preflight -- --base <sha> --install` in the isolated normal-permission worktree. For owner or coordinator refactors, run `npm run codex:impact -- --source <owner-path>` before edits and inspect importers plus contract checks.

When resuming accepted local work, reread current `origin/main:AGENTS.md`, fetch and make the accepted commit a descendant of current `origin/main` before first push/PR. Never spend CI on a knowingly stale head.

## Scope and architecture

- **Micro:** docs, metadata or local launcher with no runtime/dependency/deployment effect.
- **Fast:** gameplay, UI, content, config and bounded refactors.
- **Strict:** persistence/schema, central ownership, broad input/collision, dependencies, workflows/security, external assets or dependent PRs.

Use the smallest clean solution. Explicit exclusions in the task are hard scope limits: do not add authoring/editor/build/persistence/configurability or a generalized lifecycle merely because such a system already exists. Add an excluded capability only when the prompt requests it or a current invariant required for the requested observable result makes it unavoidable; report that concrete conflict instead of silently broadening scope.

In plain terms: src/main.js is composition only. New domain logic, state machines, persistence, build/editor workflow or service orchestration belongs in a system owner/coordinator. `npm run check:architecture` enforces the current line ceiling; do not bypass it by minifying or compressing code.

The Lead brief contains `Architecture pressure: none` or a concrete owner/trigger. Treat this declaration as binding Integration metadata. For a concrete pressure, read the relevant `ARCHITECTURE.md` section and perform the named local extraction in the same PR together with its system-contract update and targeted proof; do not defer it to an unspecified cleanup task. For `none`, do not invent a broad refactor, but report if the actual implementation necessarily crosses a documented trigger before proceeding.

If an accepted change alters a stable system contract, update the corresponding `systems/*.md` in the same PR. Do not add task history or implementation diaries.

## Changed contracts

For a changed identifier, rate, save field, localization key, action, selector, fixture, helper or config value: search once for old values and aliases, classify matches, update real consumers and targeted coverage. Never weaken a valid test for CI.

Durable regression checks assert current behavior, current contracts or exact assets owned by that check. A historical `check-task-*` must not inspect the current worktree against its old task SHA or `origin/main` to enforce the scope of a completed task; PR scope belongs to the current PR classifier and review.

## Visual assets

Codex never generates, redraws, regenerates, reinterprets, replaces, recompresses, recolors, resizes or otherwise authors game images.

Use only exact binaries already supplied and committed by the Lead in the stated Base SHA. Treat their canonical paths, dimensions, frame order, byte length and SHA-256 as immutable integration inputs.

A missing, mismatched or undecodable required binary is a blocker. Stop before implementation and report the exact missing contract. Do not use placeholders, procedural substitutes, external downloads, package copies or prompt wording as permission to manufacture an image.

The final report states `Image generation was not invoked.` and confirms that the changed-file list contains no new or modified tracked binary files.

## Validation

Use one strong proof per material risk. A successful proof remains valid until relevant inputs change.

**Feedback gate:** batch remarks and prove only hidden behavior. Codex uses one local managed preview for acceptance; ChatGPT direct may use one public Draft preview. Defer broad proof until acceptance.

**Micro-feedback:** presentation-only value changes may reuse prior proof and preview health. Hidden contract changes still receive one targeted check.

**Fast publication after `принято`:** acknowledge acceptance, stop local preview and inspect files/full diff once. Before the first push, run the publication gate below from the final candidate head. Do not use PR CI to discover failures that the local gate covers.

**Strict publication:** run the same publication gate with `codex:validate --full` plus only missing task-specific proof.

Use `npm run codex:validate -- --base <sha> --task <number>` for the local syntax/task/direct-check ladder. Add `--full` exactly once for Strict work. The ladder discovers source-address contract checks; do not rerun successful levels manually.

### Publication gate

After acceptance, player-visible or cross-system work gets one complete local gate before the first push:

1. `git diff --check`;
2. `npm run codex:validate -- --base <sha> --task <number>` (`--full` for Strict);
3. `npm run check` when the change affects shared runtime, interaction, persistence, build/authoring, world transitions or CI-sensitive contracts;
4. full Playwright through `npm run check:e2e:focused -- --workers=3`, which owns an ephemeral Vite port and sets `VITE_E2E=1`.

Collect every failure from the complete run before editing. Repair confirmed causes as one batch, run the failing specs for fast feedback, then rerun only the invalidated gate levels. Push one final candidate head. The target is one local gate and one final-head CI cycle, normally 5–10 minutes for Fast work.

Never point local Playwright at the persistent preview on port `4173`; it may lack the E2E bridge or serve another checkout. Validate required PR metadata and Architecture pressure before marking the PR Ready. Static source-contract checks must normalize CRLF/LF before exact multiline matching.

Environment:

- install dependencies only when missing/changed;
- Python checks use `scripts/run-python-check.mjs`;
- preview/E2E state belongs in OS temp;
- do not mix elevated and normal operations;
- on `EPERM`, inspect the exact path once and rerun only the failed command;
- keep successful logs compact;
- visible text verifies RU/EN, glyphs, wrapping and overlap at `640×360` and mobile.

## Preview acceptance

Required for gameplay, HUD/UI, input, scenes, localization, animation, audio and visual assets.

1. Codex uses `npm run preview:task` for local acceptance and publishes nothing before `принято`.
2. An authorized ChatGPT Draft carrier uses `executor: chatgpt` and `preview-acceptance: pending`; its workflow publishes the exact-head static preview.
3. Public PR links belong only to that ChatGPT route. StackBlitz/Codespaces are forbidden.
4. ChatGPT reuses one Draft URL through feedback.
5. Before `принято`: no Ready PR, auto-merge or merge. For ChatGPT direct implementation, `препроверка принята` authorizes only the task branch and Draft preview carrier.
6. After `принято`: set `preview-acceptance: accepted`, remove any ChatGPT preview, open/mark Ready, run final-head CI and merge. Preserve the SHA unless repair/rebase is required.
7. Player-visible repair returns to preview only when it changes the accepted experience.
8. Private preview artifacts use the same ChatGPT-only pending Draft gate. Accepted and Codex PRs publish no link.

## GitHub

Prefer the connector. Fill every `nestled-burrow-delivery:v1` field, including `executor`; invalid metadata fails scope and public preview. Codex creates one accepted non-draft PR. Only a ChatGPT pre-acceptance Draft may be `pending`. Eligible invisible work may enable native auto-merge through the connector. Verify head SHA and wait once for final CI.

When ChatGPT direct implementation has no local worktree, a coherent multi-file edit is published atomically: create one Git tree, one commit and move the task branch once. Contents API `create_file` / `update_file` publication is reserved for a genuinely single-file change. Never push one commit per edited file.

Before repair, wait until every job for current head is terminal and collect failures in one pass. Load only failing steps. Poll at least 45 seconds apart; prefer auto-merge and one bounded wait.

After green CI, merge and update local `main` unless prohibited. Never create review requests, issues, replacement PRs or extra branches without request.

## Delivery escalation

Codex quota is reserved primarily for implementation and user-feedback iteration. After `принято`, publication ownership is deliberately bounded.

Codex may perform one normal publication gate, first push/Ready PR and final-head CI. If that CI has a blocking failure clearly caused by the current task and the repair is bounded to the task's owners or task-specific proof, Codex may perform one repair batch and publish one repaired head.

Escalate immediately instead of continuing the delivery loop when any condition is true:

- the repaired head fails blocking CI again;
- a blocking failure belongs to an unrelated legacy test/system and fixing it would touch unrelated gameplay or test contracts;
- fixing publication would require `.github/workflows/**`, runner policy or shared test-harness changes not requested by the task;
- a same-head rerun is being considered without a concrete runner/network/transient infrastructure signal;
- failures migrate across unrelated suites or cannot be reduced to one task-local repair batch.

On escalation:

1. stop further diagnosis, local broad reruns and repair edits; do not create a cleanup or handoff commit;
2. preserve the current task state. If a PR exists, leave it open. If no PR exists yet, push the current task branch/head so ChatGPT can take over, but do not open a knowingly failing PR only to obtain more CI;
3. output only the minimal handoff below; do not paste logs, full diffs, timelines or speculative analysis;
4. do not resume that delivery unless the user explicitly sends Codex a new concrete repair command.

```text
codex-delivery-escalation:v1
ты интегратор. Продолжи публикацию Task #<number> — <name>.
PR: #<number> | none
Branch: task/<number>-<slug>
Current head: <sha>
Accepted head: <sha>
Trigger: <one factual sentence>
Failing evidence: <workflow/job/spec names in one line>
```

The handoff is sufficient. ChatGPT retrieves PR state, CI, logs and diff from GitHub and owns repair/CI/merge from that point.

## Special

- Existing-PR repair: `AGENTS.override.md`.
- Binary import: `BINARY_IMPORT.md` and `ASSETS.md`.
- Durable `tasks/*.md` only for named large/resumable work.
- Before completion report actual checks, final head/merge SHA, Task-first PR link and residual limitations.
