<!-- audience: codex -->
# Codex rules

## Route

- Codex flow: brief → implementation → local preview → `принято` → one Ready PR → CI → merge. Only ChatGPT direct may use a public Draft preview before `принято`.
- Never ask the user to operate GitHub.
- Stop before merge only for explicit `не сливать`, report-only work, a real blocker, or `Delivery escalation` below.
- Codex never creates a Draft PR before acceptance and never publishes an online preview. Online preview belongs only to ChatGPT direct.
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

**Feedback gate:** batch remarks and prove only hidden behavior. Codex uses one local managed preview for acceptance; ChatGPT direct may use one public Draft preview. Defer broad repository proof to PR CI.

**Micro-feedback:** presentation-only value changes may reuse prior proof and preview health. Hidden contract changes still receive one targeted check.

**Fast publication after `принято`:** acknowledge acceptance, stop local preview and inspect files/full diff once. Run the targeted publication gate below from the final candidate head, then push one Ready PR.

**Strict publication:** use the same targeted local gate plus only missing task-specific proof. PR CI owns broad repository validation for both Fast and Strict work.

Use `npm run codex:validate -- --base <sha> --task <number>` for the local syntax/task/direct-check ladder. It already runs `git diff --check` and discovers source-address contract checks. Use `--full` only when an explicit task or repair command specifically requires a local full suite; it is not a publication default.

### Publication gate

After acceptance, player-visible or cross-system work gets one short local gate before the first push:

1. `npm run codex:validate -- --base <sha> --task <number>`;
2. run only missing task-specific proof whose relevant inputs changed since its last success; use focused specs/checks rather than the full repository corpus;
3. push one final candidate head as the Ready PR. GitHub runs owner/system contracts, historical regressions and build first; full browser regression starts only after that static gate is green.

Do not run full `npm run check` or full Playwright locally merely to mirror PR CI. Do not repeat `git diff --check` outside `codex:validate`. Repair confirmed task-local causes as one batch and rerun only invalidated targeted proof. The normal goal is one short local gate and one final-head CI cycle.

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

1. Codex uses `npm run preview:task` for local acceptance and publishes nothing before `принято`; it does not create a pre-acceptance PR.
2. An authorized ChatGPT Draft carrier uses `executor: chatgpt` and `preview-acceptance: pending`; its workflow publishes the exact-head static preview.
3. Public PR links belong only to that ChatGPT route. StackBlitz/Codespaces are forbidden.
4. ChatGPT reuses one Draft URL through feedback.
5. Before `принято`: no Ready PR, auto-merge or merge. For ChatGPT direct implementation, `препроверка принята` authorizes only the task branch and Draft preview carrier.
6. After `принято`: set `preview-acceptance: accepted` while the PR is still Draft, remove the ChatGPT preview, then mark the same PR Ready, run final-head CI and merge. Preserve the SHA unless repair/rebase is required.
7. Player-visible repair returns to preview only when it changes the accepted experience.
8. Private preview artifacts use the same ChatGPT-only pending Draft gate. Accepted and Codex PRs publish no link.

## GitHub

Prefer the connector. Fill every `nestled-burrow-delivery:v1` field, including `executor`; invalid metadata fails scope and public preview. Codex creates one accepted non-draft PR. Only a ChatGPT pre-acceptance Draft may be `pending`. Eligible invisible work may enable native auto-merge through the connector. Verify head SHA and wait once for final CI.

When ChatGPT direct implementation has no local worktree, a coherent multi-file edit is published atomically: create one Git tree, one commit and move the task branch once. Contents API `create_file` / `update_file` publication is reserved for a genuinely single-file change. Never push one commit per edited file.

Before repair, wait until every job for current head is terminal and collect failures in one pass. Load only failing steps. Poll at least 45 seconds apart; prefer auto-merge and one bounded wait.

After green CI, merge and update local `main` unless prohibited. Never create review requests, issues, replacement PRs or extra branches without request.

## Delivery escalation

After `принято`, Codex owns one publication cycle and at most one task-local repair. On a second failed repaired head, unrelated legacy failure, required workflow/shared-harness change, unjustified same-head rerun, or failures migrating across unrelated suites: read `DELIVERY_ESCALATION.md`, emit its handoff, and stop. Resume only by explicit user repair command.

## Special

- Existing-PR repair: `AGENTS.override.md`.
- Binary import: `BINARY_IMPORT.md` and `ASSETS.md`.
- Durable `tasks/*.md` only for named large/resumable work.
- Before completion report actual checks, final head/merge SHA, Task-first PR link and residual limitations.
