<!-- audience: codex -->
# Codex rules

## Route

- Normal flow: compact Lead brief → implementation → public PR preview acceptance when visible → one Ready PR → final-head CI → merge.
- Never ask the user to operate GitHub.
- Stop before merge only for explicit `не сливать`, report-only work or a real blocker.
- Draft PR before acceptance is allowed only by explicit user command; it is not a development or CI gate.
- Preserve Task identity: `Task #<number> — <name>` and `task/<number>-<slug>`.

## Context

Read:

1. the prompt;
2. this file and `AGENTS.override.md`;
3. only the system documents named in the prompt or selected through `LIBRARY.md`;
4. relevant source, tests and config.

Do not read `PROJECT.md`, `LEAD.md`, full `GAME.md`, full `ROADMAP.md`, `FAST_LOOP.md`, every `systems/*.md` or historical `tasks/*.md` unless the task explicitly changes their facts. Expand context only after finding a real dependency.

Before editing: fetch, branch from supplied Base SHA/current `origin/main`, inspect owner and consumers, preserve unrelated work. Use one isolated normal-permission worktree when needed.

When resuming accepted local work, reread current `origin/main:AGENTS.md`, fetch and make the accepted commit a descendant of current `origin/main` before first push/PR. Never spend CI on a knowingly stale head.

## Scope and architecture

- **Micro:** docs, metadata or local launcher with no runtime/dependency/deployment effect.
- **Fast:** gameplay, UI, content, config and bounded refactors.
- **Strict:** persistence/schema, central ownership, broad input/collision, dependencies, workflows/security, external assets or dependent PRs.

Use the smallest clean solution. In plain terms: src/main.js is composition only. New domain logic, state machines, persistence, build/editor workflow or service orchestration belongs in a system owner/coordinator. `npm run check:architecture` enforces the current line ceiling; do not bypass it by minifying or compressing code.

If an accepted change alters a stable system contract, update the corresponding `systems/*.md` in the same PR. Do not add task history or implementation diaries.

## Changed contracts

For a changed identifier, rate, save field, localization key, action, selector, fixture, helper or config value: search once for old values and aliases, classify matches, update real consumers and targeted coverage. Never weaken a valid test for CI.

## Visual assets

Codex never generates, redraws, regenerates, reinterprets, replaces, recompresses, recolors, resizes or otherwise authors game images.

Use only exact binaries already supplied and committed by the Lead in the stated Base SHA. Treat their canonical paths, dimensions, frame order, byte length and SHA-256 as immutable integration inputs.

A missing, mismatched or undecodable required binary is a blocker. Stop before implementation and report the exact missing contract. Do not use placeholders, procedural substitutes, external downloads, package copies or prompt wording as permission to manufacture an image.

The final report states `Image generation was not invoked.` and confirms that the changed-file list contains no new or modified tracked binary files.

## Validation

Use one strong proof per material risk. A successful proof remains valid until relevant inputs change.

**Feedback gate:** batch remarks, use one healthy public PR preview for user acceptance, add only the smallest check for hidden behavior. A local managed preview is internal proof, not the user-facing link. Defer diff review, build, full checks, screenshots and E2E until acceptance.

**Micro-feedback:** presentation-only value changes may reuse prior proof and preview health. Hidden contract changes still receive one targeted check.

**Fast publication after `принято`:** acknowledge acceptance, stop local preview, inspect files/full diff once, run only still-unproven targeted checks for code changed since the last proof. Skip local full check, full/focused E2E and standalone build unless a specific bundling/dependency/hidden risk requires them.

**Strict publication:** run `npm run check` once plus only missing task-specific proof. Local E2E is exceptional; full E2E belongs to PR CI.

Environment:

- install dependencies only when missing/changed;
- Python checks use `scripts/run-python-check.mjs`;
- preview/E2E state belongs in OS temp;
- do not mix elevated and normal operations;
- on `EPERM`, inspect the exact path once and rerun only the failed command;
- keep successful logs compact;
- visible text verifies RU/EN, glyphs, wrapping and overlap at `320×180` and mobile.

## Preview acceptance

Required for gameplay, HUD/UI, input, scenes, localization, animation, audio and visual assets.

1. Use `npm run preview:task` only for local health: exact URL, HTTP, page errors and 320×180 canvas.
2. After an explicitly authorized Draft exception, push the task branch. The PR workflow must build and publish a direct static preview from the exact current head.
3. Give the user only the stable public link posted by the PR workflow. StackBlitz, Codespaces and other links that first construct a development environment are forbidden as acceptance previews.
4. Reuse the same PR URL through feedback; every synchronize event updates its contents.
5. Before `принято`: no Ready PR, auto-merge or merge. For ChatGPT direct implementation, `препроверка принята` authorizes only the task branch and Draft preview carrier.
6. After `принято`: applicable publication route once, Ready PR, native auto-merge and final-head CI.
7. Player-visible repair returns to preview only when it changes the accepted experience.

## GitHub

Prefer the connector. Create one non-draft PR after acceptance/local validation. Wait for final-head CI; repair deterministic failures in the same branch/PR.

Before repair, wait until every job for current head is terminal and collect failures in one pass. Load only failing steps. Poll at least 45 seconds apart; prefer auto-merge and one bounded wait.

After green CI, merge and update local `main` unless prohibited. Never create review requests, issues, replacement PRs or extra branches without request.

## Special

- Existing-PR repair: `AGENTS.override.md`.
- Binary import: `BINARY_IMPORT.md` and `ASSETS.md`.
- Durable `tasks/*.md` only for named large/resumable work.
- Before completion report actual checks, final head/merge SHA, Task-first PR link and residual limitations.
