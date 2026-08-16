<!-- audience: codex -->
# Codex rules

## Route

- Codex flow: brief → implementation → local preview → `принято` → one Ready PR → CI → merge. Only ChatGPT direct may use a public Draft preview before `принято`.
- Never ask the user to operate GitHub. Stop before merge only for explicit `не сливать`, report-only work, a real blocker, or `Delivery escalation`.
- Codex never creates a Draft PR before acceptance and never publishes an online preview. Online preview is ChatGPT-only.
- Acceptance, Ready state, PR number and merge status never justify a source/documentation commit. Never create an empty commit.
- Preserve Task identity: `Task #<number> — <name>` and `task/<number>-<slug>`.
- Late Task-number collision: if a number free at work start becomes occupied on `origin/main`, assign the current `ROADMAP.md` next-free number without further confirmation; rebase and update Task identity, checks, branch, commit and PR consistently.
- If the collided number already has a PR, close it, establish one replacement Ready PR, then remove the obsolete branch. Treat this replacement as the same publication cycle.

## Context

Read:
1. the prompt;
2. this file and `AGENTS.override.md`;
3. only the system documents named in the prompt or selected through `LIBRARY.md`;
4. relevant source, tests and config.

Do not read `PROJECT.md`, `LEAD.md`, full `GAME.md`, full `ROADMAP.md`, `FAST_LOOP.md`, every `systems/*.md` or historical `tasks/*.md` unless the task changes their facts. Expand context only after a real dependency appears.

Before editing: fetch, branch from supplied Base SHA/current `origin/main`, preserve unrelated work, then run `npm run codex:preflight -- --base <sha> --install`. For owner/coordinator refactors, run `npm run codex:impact -- --source <owner-path>` and inspect importers plus contract checks.

When resuming accepted work, reread current `origin/main:AGENTS.md`, fetch and make the accepted commit a descendant of current `origin/main` before first push/PR. Do not spend CI on a knowingly stale head.

## Scope and architecture

- **Micro:** docs, metadata or local launcher with no runtime/dependency/deployment effect.
- **Fast:** gameplay, UI, content, config and bounded refactors.
- **Strict:** persistence/schema, central ownership, broad input/collision, dependencies, workflows/security, external assets or dependent PRs.

Use the smallest clean solution. Explicit exclusions are hard scope limits. Add an excluded capability only when requested or required by a current invariant for the requested observable result; report that conflict instead of silently broadening scope.

In plain terms: src/main.js is composition only. Domain logic, state machines, persistence, build/editor workflow and service orchestration belong in system owners/coordinators. `npm run check:architecture` enforces the boundary; do not bypass it by compressing code.

The Lead brief declares `Architecture pressure: none` or a concrete owner/trigger. For pressure, read the relevant `ARCHITECTURE.md` section and perform the named local extraction in the same PR with its system-contract update and targeted proof. For `none`, do not invent broad refactors, but report a real trigger before proceeding.

If accepted work changes a stable system contract, update its `systems/*.md` in the same PR. Do not add task diaries.

## Changed contracts

For a changed identifier, rate, save field, localization key, action, selector, fixture, helper or config value: search once for old values/aliases, classify matches, update real consumers and targeted coverage. Never weaken a valid test for CI.

Durable regression checks assert current behavior, current contracts or exact assets owned by that check. A completed-task regression protects that behavior, not old source formatting, internal call shape or unrelated global state. Exact source text is valid only when the text itself is the contract.

Tests use canonical constants/helpers instead of copied magic values. For live time, input, position or other moving state, freeze irrelevant motion or assert the invariant relative to current state rather than a stale absolute snapshot. If legitimate new behavior breaks an old check, decide which contract is current first: update a stale test assumption; change runtime only for a real regression. Prefer durable coverage in the owning system check; keep `check-task-*` only while it owns a genuinely task-specific contract.

A historical `check-task-*` must not compare the current worktree with its old task SHA or `origin/main` to enforce completed-task scope; PR scope belongs to the current classifier and review.

## Visual assets

Codex never generates, redraws, regenerates, reinterprets, replaces, recompresses, recolors, resizes or otherwise authors game images. Use only exact binaries already supplied and committed by the Lead in the stated Base SHA.

A missing, mismatched or undecodable required binary is a blocker. Do not use placeholders, procedural substitutes, downloads or package copies. Required binary paths, dimensions, frame order, byte length and SHA-256 are immutable integration inputs.

The final report states `Image generation was not invoked.` and confirms no new or modified tracked binary files.

## Validation

Use one strong proof per material risk; a successful proof remains valid until relevant inputs change.

**Feedback gate:** batch remarks and prove only hidden behavior. Codex uses one local managed preview; ChatGPT direct may use one public Draft preview. Broad repository proof belongs to PR CI.

**Micro-feedback:** presentation-only values may reuse prior proof/preview health; hidden contract changes still get one targeted check.

**Fast publication after `принято`:** stop preview, inspect files/full diff once, run the publication gate, then push one Ready PR. Strict publication adds only missing task-specific proof; PR CI owns broad validation.

Use `npm run codex:validate -- --base <sha> --task <number>` for the local syntax/task/direct-check ladder. Use `--full` only when explicitly required.

### Publication gate

1. `npm run codex:validate -- --base <sha> --task <number>`;
2. run only missing task-specific proof whose relevant inputs changed;
3. push one final candidate head as the Ready PR. GitHub runs owner/system contracts, regressions and build before browser regression.

Do not mirror full PR CI locally, repeat `git diff --check`, or rerun proofs whose inputs did not change. Repair confirmed task-local causes as one batch. Static source-contract checks normalize CRLF/LF before exact multiline matching.

Environment: install dependencies only when missing/changed; Python checks use `scripts/run-python-check.mjs`; preview/E2E state belongs in OS temp; do not mix elevated/normal operations; on `EPERM`, inspect the exact path once and rerun only the failed command; visible text verifies RU/EN, glyphs, wrapping and overlap at `640×360` and mobile.

## Preview acceptance

Required for gameplay, HUD/UI, input, scenes, localization, animation, audio and visual assets.

1. Codex uses `npm run preview:task`, publishes nothing and creates no pre-acceptance PR.
2. ChatGPT Draft carrier uses `executor: chatgpt` + `preview-acceptance: pending`; only this route may publish a public/private preview before `принято`.
3. Before `принято`: no Ready PR, auto-merge or merge. `препроверка принята` authorizes only the ChatGPT task branch/Draft preview carrier.
4. After `принято`: set `preview-acceptance: accepted` while the PR is still Draft, remove preview, mark the same PR Ready, run final-head CI and merge. Preserve SHA unless repair/rebase is required.
5. Player-visible repair returns to preview only when it changes the accepted experience. StackBlitz/Codespaces are forbidden.

## GitHub

Prefer the connector. Fill every `nestled-burrow-delivery:v1` field, including `executor`. Eligible invisible work may enable native auto-merge through the connector. Verify head SHA and final CI once.

Never write or push directly to `main`. Every repository mutation, including docs/process-only micro work, uses a branch and PR. Invisible micro work needs no preview or user gate: create one Ready PR, run required CI, then merge.

Without a local worktree, ChatGPT publishes a coherent multi-file edit atomically with one Git tree/commit/branch move. Contents API publication is only for a genuinely single-file change.

Before repair, wait for all jobs on current head to become terminal, collect failures once and load only failing steps. Re-run only infrastructure failures.

After green CI, merge and update local `main` unless prohibited. Never create review requests, issues, replacement PRs or extra branches without request.

## Delivery escalation

After `принято`, Codex owns one publication cycle and at most one task-local repair. On a second failed repaired head, unrelated legacy failure, required workflow/shared-harness change, unjustified same-head rerun, or failures migrating across unrelated suites: read `DELIVERY_ESCALATION.md`, emit its handoff, and stop. Resume only by explicit user repair command.

## Special

- Existing-PR repair: `AGENTS.override.md`.
- Binary import: `BINARY_IMPORT.md` and `ASSETS.md`.
- Durable `tasks/*.md` only for named large/resumable work.
- Before completion report actual checks, final head/merge SHA, Task-first PR link and residual limitations.
