<!-- audience: codex -->
# Codex operating rules

## Default route

The usual product route is: the user describes the desired result in ordinary language to Lead, Lead turns it into a compact architecture-aware task brief, and Codex implements that brief end-to-end.

Lead must inspect the affected architecture, contracts and consumers deeply enough to keep the brief system-safe. Keep the inspection targeted to the task; never trade architectural correctness for prompt speed.

A direct implementation request that reaches Codex still means: implement, validate proportionally, open one Ready PR, wait for final-head CI, repair the same branch when needed, merge, and update local `main`.

Stop before merge only when the prompt explicitly says `не сливать`, asks for review/report only, or a real blocker remains. Do not ask the user to operate GitHub.

Lead prepares the usual product brief. Integrator is optional and is used only when the user explicitly requests independent acceptance or several dependent PRs genuinely require coordination.

## Task identity and communication

- Prefer `Task #<number> — <name>` in every user-facing update.
- After a PR exists, use `Task #<number> — <name> (PR #<number>)`.
- PR number is a secondary GitHub address.
- Preserve a supplied Task number, branch, title and Base SHA exactly.
- When no Task number is supplied for repository-changing work, allocate the next free number with a targeted `ROADMAP.md` lookup. Answer-only work does not need a Task number.
- Keep final reports short: result, checks, PR/merge, real limitation.

## Read before editing

Read in this order:

1. the direct prompt;
2. this file and `AGENTS.override.md` when present;
3. only directly relevant source, tests and configuration.

Do not read `PROJECT.md`, `GAME.md`, `ROADMAP.md`, `LEAD.md`, `REVIEW.md` or `LIBRARY.md` by default.

Read them only when the task changes their owned facts, needs a Task number, or the relevant code location genuinely cannot be found. Read `ASSETS.md` and `BINARY_IMPORT.md` only for external/user binary work.

A routine task prompt should state the desired result, important constraints and acceptance. Repository-wide rules, implementation design, exhaustive test matrices and PR boilerplate belong here or in code, not in every prompt.

## Before changing files

1. Run `git fetch --prune`.
2. Start the one task branch from supplied Base SHA or current `origin/main`.
3. Never commit ordinary work on `main`.
4. Inspect the relevant implementation and search consumers of any changed contract.
5. Preserve unrelated user changes and avoid unrelated cleanup.

## Scope and risk

Fast lane is the default for gameplay, UI, content, configuration, local refactors and bounded fixes.

Strict handling is reserved for persistence/schema migrations, central state ownership, broad movement/input/collision contracts, dependencies, workflows/deployment/security, external assets/licensing, or dependent PRs.

Use the smallest clean solution for the current observable result. Do not add dependencies, frameworks, assets, documentation or infrastructure without a concrete need.

For renamed public identifiers, save fields, localization keys, selectors, E2E hooks or configuration values, search the repository once and update every real consumer. Preserve legacy behavior only through an explicit tested compatibility path.

## Fast validation ladder

Do not run the same proof through several equivalent commands.

### Routine code

1. Run the targeted checks for changed behavior once.
2. Run `npm run build` once when production code changed and the targeted command does not already include it.
3. For interactive behavior, run the focused local E2E spec or one focused runtime inspection.
4. Let PR CI run the complete repository suite and full Browser E2E.

### Strict-risk code

1. Run `npm run check` once when the local environment supports it; it already includes the production build.
2. Run only task-specific checks that are absent from `npm run check`.
3. Run focused local Browser E2E for changed interactive behavior. Full Browser E2E belongs to PR CI.

### Docs/process only

Run `npm run check:docs` and `git diff --check`. Workflow changes also require direct workflow inspection and PR CI.

### Environment rules

- Run `npm ci` only when dependencies are missing/unusable or dependency/lock state changed.
- Install Python requirements only when the required version is unavailable or changed.
- Use at most one temporary validation worktree for an actual dirty/locked environment problem.
- If a deterministic command fails, run that exact command once on current `main` to classify base versus PR failure. Do not repeat the full base suite.
- Do not rerun an unchanged deterministic failure.
- Capture verbose successful output compactly. Show the relevant full output only on failure.

## Evidence

Use one strong proof for each material risk.

- Automated assertions are preferred for exact values and state transitions.
- Runtime inspection is for visual feel, interaction or behavior automation cannot establish.
- Screenshots are for visual judgement and regressions; normally keep at most two focused states.
- Do not require unit checks, full check, full E2E, manual smoke and many screenshots for the same risk.
- Inspect the complete scope with `git status`, `git diff --check` and diff/stat. Re-open only changed sections not already inspected during implementation; do not replay a large known diff into context merely as ceremony.

## GitHub delivery

- Prefer the installed GitHub connector for PR metadata, creation, status and merge.
- Use `gh` only for an operation or Actions log unavailable through the connector. A stale `gh` token does not block connector-covered work.
- Open one non-draft PR after applicable local validation. Draft is reserved for a user-requested work-in-progress.
- Repository CI runs for both Ready and Draft PRs, so Draft is never a CI gate.
- Wait for final-head CI. Repair deterministic PR failures in the same branch and PR.
- After green required CI, merge the routine PR and fast-forward local `main`, unless the user explicitly prohibited merge.
- Do not request Codex review, enable auto-merge, create issues, replacement PRs or extra branches unless the user explicitly asks.

## Special routes

- Existing-PR repair commands are routed by `AGENTS.override.md` and keep the same Task and PR.
- External/user binaries require the preflight and provenance rules in `BINARY_IMPORT.md` and `ASSETS.md`.
- Durable `tasks/*.md` contracts are only for large, dependent, resumable or repeatedly reused work explicitly named by the prompt.
- Pixel-grid or third-party spritesheet work must preserve nearest-neighbor geometry and use source metadata/contact sheets instead of guessed frame numbers.

## Completion

Before reporting completion:

- confirm only intended files changed;
- report checks actually run;
- identify final head/merge SHA and Task-first PR link;
- state real residual limitations;
- confirm local `main` is current after merge.
