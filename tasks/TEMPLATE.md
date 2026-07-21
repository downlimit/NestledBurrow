# Task: <short title>

<!-- Keep the task proportional to its risk. Include only constraints that change implementation or review behavior. Do not restate repository-wide rules already defined in AGENTS.md and REVIEW.md. Remove optional sections that add no useful information. -->

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `1`
- Work branch: use the single branch supplied by Codex; do not create or push additional branches
- Lifecycle: `ephemeral`
- Create PR: `yes` — exactly once, after implementation and applicable validation
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
- <only directly relevant files>

## Requirements

<Only behavior, architecture or technical constraints specific to this task.>

## Validation

Use the review class and proportional validation rules from `AGENTS.md` and `REVIEW.md`.

List only task-specific risks not already covered by canonical checks:

- <behavior or boundary case>
- <runtime state, viewport or artifact only when relevant>

A local dependency, proxy, browser-install or package-index failure must be reported as a limitation. It must not be worked around by adding an unrelated fallback package, vendored compatibility module, test bypass or workflow change.

## Scope boundary

<Include this section only when likely scope creep needs to be explicitly blocked. Do not copy generic exclusions from AGENTS.md.>

## Delivery

Finish implementation, self-review and applicable validation before opening exactly one final PR from the single task branch. Use the adaptive `.github/pull_request_template.md`; keep only sections relevant to the task. Do not create a draft PR, replacement PR, additional remote branch or close/reopen cycle as a development mechanism. Do not delete the active task branch; GitHub handles ephemeral branch deletion after merge and the main chat verifies it.
