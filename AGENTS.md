<!-- audience: codex -->
# Codex rules

## Route and identity

- Normal flow: user → Lead's compact architecture-aware brief → Codex delivery.
- Player-visible work uses preview acceptance below. Other direct changes proceed through proportional validation, one Ready PR, final-head CI, same-branch repair, merge, and local `main`.
- Stop before merge only for explicit `не сливать`, review/report-only work, or a real blocker. Never ask the user to operate GitHub.
- Integrator is optional; use only when explicitly requested for independent acceptance or genuinely dependent PRs.
- Report as `Task #<number> — <name>`; after PR creation add `(PR #<number>)`.
- Preserve supplied Task number, branch, title, and Base SHA. If changing the repo without a Task number, find the next free one with one targeted `ROADMAP.md` lookup. Answer-only work needs none.

## Context and setup

Read the prompt, this file, `AGENTS.override.md`, and relevant source/tests/config. Open other project docs only to change their facts, allocate a Task number, or find an unresolved owner. Read asset contracts only for external/user binaries.

Before editing:

1. Run `git fetch --prune`.
2. Branch from supplied Base SHA or current `origin/main`; never do normal work on `main`.
3. Inspect the owner and consumers of changed contracts.
4. Preserve unrelated user work; avoid unrelated cleanup.

For a dirty/shared checkout or another active task, use one isolated worktree; never switch the shared checkout. Create and use the worktree with one normal user/permission level. Do not mix elevated and non-elevated Git, npm, Vite or cleanup operations in the same worktree.

When resuming accepted existing local work after `main` may have advanced, re-read the current `origin/main` version of this contract, fetch, and make the accepted commit a descendant of current `origin/main` before the first push or PR, using rebase or cherry-pick as appropriate. Resolve conflicts and rerun only proofs whose inputs changed. Never open a knowingly stale-base PR or spend CI on a disposable head merely to discover that branch protection requires an update; the normal route has one final-head CI cycle.

## Scope

- **Micro:** complete low-risk docs, text metadata, or local `.bat`/`.cmd` launchers that cannot affect runtime, dependencies, or deployment.
- **Fast (default):** gameplay, UI, content, config, local refactors, bounded fixes.
- **Strict:** persistence/schema, central state ownership, broad movement/input/collision contracts, dependencies, workflow/deployment/security, external assets/licensing, or dependent PRs.

Use the smallest clean solution; add no dependency, framework, asset, docs, or infrastructure without need.

User feedback and the time needed to evaluate feel are product work, not process waste. Do not limit feedback rounds or split a coherent result merely to make metrics look smaller. If feedback invalidates an explicit scope exclusion or adds another independent runtime contract, restate the current observable result and boundary in at most five lines, then continue in the same Task unless the user requests a split or a real strict-risk dependency requires one.

For a changed public identifier, behavior/rate, save field, localization key, action, selector, fixture, E2E helper, or config value: search once for the old value, field name, exact expectations, and aliases; classify matches; update real consumers and targeted coverage; confirm no accidental stale expectation. Never weaken a valid test for CI.

## Validation

Use one strong proof per material risk. A successful proof remains valid until its relevant inputs change. User acceptance does not invalidate successful checks, and a publication phase must not rerun unchanged evidence.

**Feedback gate:** batch current remarks into one pass. A healthy managed preview is the default proof. Add one smallest named check only for hidden behavior it cannot prove. Defer status/diff review, `git diff --check`, build, docs/scope checks, full suites, screenshots, and E2E until acceptance.

**Micro-feedback:** during preview, `без дополнительных проверок` or equivalent for an existing presentation value: make the edit, reuse proof, health-check preview; skip build, checks, screenshots, E2E. Excludes persistence/schema, public IDs, input/collision, dependencies, workflow/security, and new behavior/architecture; otherwise run the one risk check and state why.

**Fast publication after `принято`:** immediately acknowledge that the playable result is accepted and no user action is needed. Stop preview, inspect changed files/full diff once, and run only still-unproven targeted checks for code changed since the last valid proof. A final healthy preview already proves browser startup and the visible result, so skip local `npm run check`, full/focused E2E and a standalone production build unless the task specifically changes bundling, dependencies or another risk unavailable to PR CI. Reach the Ready PR with minimal active work; the normal target is a few minutes, while CI wait is separate.

**Strict publication:** run `npm run check` once plus only missing task-specific proof. Focused local E2E is exceptional: use it only when a changed hidden interaction/state path cannot be proven by preview or a cheaper contract check. The existence of a related E2E spec alone is not a reason to run it. Full E2E belongs to PR CI.

**Micro/docs/process publication:** run the relevant documentation/launcher check and `git diff --check`; workflow changes also require direct workflow inspection. Do not promote a docs-only change to runtime validation.

Environment/evidence:

- Install dependencies only when missing or changed; prefer the existing npm cache.
- Python checks are invoked through `scripts/run-python-check.mjs`; do not manually hunt for or hard-code a bundled Python path.
- Managed preview and focused-E2E operational state belongs in the OS temp directory, not writable repository paths.
- On `EPERM` or access denied, inspect the exact owned path once. Do not blindly repeat an entire command or suite elevated. Recreate an unusable worktree in a user-writable temp location under the same permission level, then rerun only the failed canonical command.
- Diagnose deterministic failure with its canonical command; compare current `main` once only when base matters.
- The focused E2E launcher owns Vite, readiness and shutdown.
- Prefer stable assertions over moving NPCs, live clocks or whole-session equality. Use runtime for feel; maximum two screenshots. For new or changed visible text, verify RU/EN glyphs, wrapping, clipping and overlap at native `320×180` and coarse-pointer mobile.
- Keep successful logs compact; load full output only on failure.

## Preview acceptance

Required for player-visible gameplay, HUD/UI, input, scenes, localization, animation, audio, and visual assets. Other work keeps the automatic route.

1. Codex implements one feedback batch, starts `npm run preview:task`, then status-confirms its exact URL, HTTP, page errors, and live 320×180 canvas.
2. Handoff: clickable URL plus compact summary. Codex owns server startup; the user receives no shell startup command. Reuse this URL through feedback.
3. Before explicit `принято`: edit batch → live refresh → status → handoff. Extra checks follow the feedback gate. No full diff, stage, commit, push, PR, auto-merge, or merge.
4. Test servers use separate free ports and leave preview running. On status failure, inspect recorded PID/log once, repair, and reverify the canonical URL. A stop permission failure follows the environment rule above; state remains until success.
5. After `принято`: follow the applicable Fast or Strict publication route once, commit, push, create one Ready PR, enable native auto-merge, and let final-head CI gate the merge. A player-visible repair returns to feedback acceptance only when it changes the accepted experience.

If no local/cloud preview URL is available, report the blocker and stop before publication. Automation never replaces the user's runtime/visual verdict.

## GitHub

- Prefer the GitHub connector; use `gh` only for missing operations/Actions logs. A stale `gh` token cannot block connector-covered work.
- Create one non-draft PR after local validation and, when gated, `принято`. Draft is only user-requested WIP and never a CI gate.
- Micro PR classification may skip gameplay/Browser E2E while preserving required check names.
- Wait for final-head CI; repair deterministic failures in the same branch/PR. Interactive runtime/input/HUD/localization/scene/persistence/E2E-hook changes require green final-head Browser E2E.
- Before pushing a CI repair, wait until every job for the current head SHA is terminal and collect all deterministic failures into one repair pass.
- Load only failing steps and assertions from remote logs. Poll CI at least 45 seconds apart. Prefer native auto-merge plus one bounded status wait over repeated polling.
- After required CI passes, merge and fast-forward local `main` unless prohibited.
- Never request Codex review or create issues, replacement PRs, or extra branches unless asked.

## Special and done

- `AGENTS.override.md` owns existing-PR repair commands.
- External/user binaries follow `BINARY_IMPORT.md` and `ASSETS.md` preflight/provenance.
- Create `tasks/*.md` only for explicitly named large, dependent, resumable, or reused contracts.
- Pixel-grid/third-party spritesheets retain nearest-neighbor geometry and use metadata/contact sheets, not guessed frames.

Before completion confirm scope, actual checks, final head/merge SHA, Task-first PR link, residual limitations, and current local `main`.
