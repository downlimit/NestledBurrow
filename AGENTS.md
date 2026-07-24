<!-- audience: codex -->
# Codex rules

## Route and identity

- Normal flow: user → Lead's compact architecture-aware brief → Codex delivery. Lead inspects affected architecture, contracts, and consumers enough for safety.
- A direct change request means implement, validate proportionally, create one Ready PR, wait for final-head CI, repair the same branch, merge, and fast-forward local `main`.
- Stop before merge only for explicit `не сливать`, review/report-only work, or a real blocker. Never ask the user to operate GitHub.
- Integrator is optional; use only when explicitly requested for independent acceptance or genuinely dependent PRs.
- Report as `Task #<number> — <name>`; after PR creation add `(PR #<number>)`. PR number is secondary.
- Preserve supplied Task number, branch, title, and Base SHA. If changing the repo without a Task number, find the next free one with one targeted `ROADMAP.md` lookup. Answer-only work needs none.
- Final reports: result, actual checks, PR/merge, real limitation.

## Context and setup

Read the prompt, this file plus `AGENTS.override.md`, then relevant source/tests/config only. Read `PROJECT.md`, `GAME.md`, `ROADMAP.md`, `LEAD.md`, `REVIEW.md`, or `LIBRARY.md` only when changing its facts, allocating a Task number, or targeted search cannot find the owner. `ASSETS.md`/`BINARY_IMPORT.md` are only for external/user binaries.

Task briefs contain the result, key constraints, and acceptance; repository-wide detail stays here or in code.

Before editing:

1. Run `git fetch --prune`.
2. Branch from supplied Base SHA or current `origin/main`; never do normal work on `main`.
3. Inspect the owner and consumers of changed contracts.
4. Preserve unrelated user work; avoid unrelated cleanup.

For a dirty/shared checkout or another active task, use one isolated worktree; never switch the shared checkout. Default to Medium reasoning; raise only for concrete architecture/strict-risk ambiguity.

## Scope

- **Micro:** complete low-risk docs, text metadata, or local `.bat`/`.cmd` launchers that cannot affect runtime, dependencies, or deployment.
- **Fast (default):** gameplay, UI, content, config, local refactors, bounded fixes.
- **Strict:** persistence/schema, central state ownership, broad movement/input/collision contracts, dependencies, workflow/deployment/security, external assets/licensing, or dependent PRs.

Use the smallest clean solution; add no dependency, framework, asset, docs, or infrastructure without concrete need.

For a changed public identifier, save field, localization key, action, selector, fixture, E2E helper, or config value: search once for the old value and aliases; classify matches; update real consumers and targeted coverage; confirm no accidental stale expectation. Never weaken a valid test for CI.

## Validation

Use one strong proof per material risk; do not repeat equivalent checks.

**Micro:** inspect the file/diff once; run `git diff --check`; docs: `npm run check:docs`; launchers: one focused syntax/dependency check when supported. Skip installs, build, full checks, runtime, screenshots, E2E, audits, and extra artifacts.

**Routine code:** for interaction, note visibility/input owners, restore path, and stable fixtures before patching all owners/consumers once. Run targeted checks once; run `npm run build` once when production code changed and targeted checks exclude it. Run `npm run check:e2e:focused -- <spec>` or one focused runtime inspection. Full suite/E2E belongs to PR CI.

**Strict:** run `npm run check` once when supported (includes build), plus only missing task-specific checks and focused local E2E for changed interaction. Full E2E belongs to PR CI.

**Docs/process:** run `npm run check:docs` and `git diff --check`; workflow changes also require direct workflow inspection and PR CI.

Environment/evidence:

- Run `npm ci` only for missing/unusable dependencies or dependency/lock changes. Install Python requirements only when the required version is absent/changed.
- Use at most one temporary validation worktree for a real dirty/locked conflict.
- On deterministic failure, run that exact command once on current `main` to classify base versus branch. Never rerun unchanged failure or the full base suite.
- The focused E2E launcher owns Vite, readiness, and shutdown; diagnose its failure directly instead of trying alternate launch commands.
- Prefer assertions/stable fixtures. Avoid moving NPCs, live clocks, and whole-session equality unless tested. Use runtime for feel/interaction; maximum two focused screenshots.
- Inspect scope once with status, `git diff --check`, and diff/stat; reopen only unreviewed changed sections. Keep successful logs compact; show relevant full output only on failure.

## Preview acceptance

Required for player-visible gameplay, HUD/UI, input, scenes, localization, animation, audio, and visual assets. Other work keeps the automatic route.

1. Finish implementation/checks; launch the task worktree and send its URL.
2. Before explicit `принято`: edit → smallest named check (`--grep` when possible) → refresh the same preview. No full diff, stage, commit, push, PR, auto-merge, or merge.
3. Test servers use separate free ports and never stop the live preview. If a mutating Git result is unclear, inspect state read-only before retry.
4. After `принято`: stop preview; inspect the full diff once; commit once; push; create one Ready PR; wait for final-head CI; merge.

If no local/cloud preview URL is available, report the blocker and stop before publication.

Automation never replaces the user's runtime/visual verdict.

## GitHub

- Prefer the GitHub connector; use `gh` only for missing operations/Actions logs. A stale `gh` token cannot block connector-covered work.
- Create one non-draft PR after local validation and, when gated, `принято`. Draft is only user-requested WIP and never a CI gate.
- Micro PR classification may skip gameplay/Browser E2E while preserving required check names.
- Wait for final-head CI; repair deterministic failures in the same branch/PR. Interactive runtime/input/HUD/localization/scene/persistence/E2E-hook changes require green final-head Browser E2E.
- If local Chromium is unavailable, create the completed Ready PR and use canonical PR E2E. Diagnose its exact assertion; compare that command with current `main` once.
- Enable native auto-merge on a validated Ready PR when supported and only after `принято` when gated. CI remains the gate; never add repair/auto-merge workflows.
- After required CI passes, merge and fast-forward local `main` unless prohibited.
- Never request Codex review or create issues, replacement PRs, or extra branches unless asked.

## Special and done

- `AGENTS.override.md` owns existing-PR repair commands.
- External/user binaries follow `BINARY_IMPORT.md` and `ASSETS.md` preflight/provenance.
- Create `tasks/*.md` only for explicitly named large, dependent, resumable, or reused contracts.
- Pixel-grid/third-party spritesheets retain nearest-neighbor geometry and use metadata/contact sheets, not guessed frames.

Before completion confirm scope, actual checks, final head/merge SHA, Task-first PR link, residual limitations, and current local `main`.
