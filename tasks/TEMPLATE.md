# Task: <short title>

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `1`
- Work branch: use the single branch supplied by Codex; do not create or push additional branches
- Lifecycle: `ephemeral`
- Create PR: `yes` — exactly once, after implementation and validation
- Delete task branch after merge: `yes` — handled by GitHub automatic head-branch deletion
- Codex deletes its own active branch: `no`
- Persistent/protected branch: `no`

For an exceptional long-lived branch, change only these fields:

- Lifecycle: `persistent`
- Delete task branch after merge: `no`
- Persistent/protected branch: `yes`
- Required branch prefix: `release/`, `archive/` or `keep/`
- Protection reason: `<explicit reason>`
- Repository-side deletion protection confirmed: `yes`

Persistent branches are exceptional. Do not create or configure branch protection as a side effect of a normal implementation task.

## Goal

<What observable result must exist when the task is complete.>

## Read before editing

- `AGENTS.md`
- `PROJECT.md`
- `LIBRARY.md`
- `REVIEW.md`
- <directly relevant files>

## Requirements

<Required behavior, architecture and technical constraints.>

## Validation

Run the canonical repository checks required by `AGENTS.md` and manually inspect every affected runtime state.

List task-specific checks here:

- <automated behavior or boundary case>
- <browser/runtime state>
- <desktop/mobile viewport when relevant>
- <preview or screenshot artifact when relevant>

A local dependency, proxy, browser-install or package-index failure must be reported as a limitation. It must not be worked around by adding an unrelated fallback package, vendored compatibility module, test bypass or workflow change.

## Scope boundary

Do not add or change:

- <explicitly excluded gameplay or UI behavior>
- unrelated dependencies or compatibility layers;
- unrelated architecture, assets, workflows or infrastructure;
- canonical validation solely to accommodate the local environment.

## Delivery

1. Finish implementation, self-review, browser inspection and all known repairs before opening the PR.
2. Run the mandatory checks from `AGENTS.md`.
3. Open exactly one final PR from the single task branch.
4. Use `.github/pull_request_template.md` and include the completion report required by `AGENTS.md` and `REVIEW.md`.
5. Do not create a draft PR, replacement PR, additional remote branch or close/reopen cycle as a development mechanism.
6. Do not delete the active task branch. GitHub handles ephemeral branch deletion after merge; the main chat verifies it.
