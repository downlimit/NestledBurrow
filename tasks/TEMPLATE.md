# Optional task-file template: <short title>

<!-- Use this file only when work is large, high-risk, multi-stage, resumable or repeatedly reused and a durable repository contract materially reduces risk. Routine iterations use one self-contained direct Codex prompt and no preparatory task PR. Include only task-specific constraints; do not restate repository-wide rules from AGENTS.md. Remove optional sections that add no value. -->

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `1`
- Work branch: use the single branch supplied by Codex
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

Persistent branches are exceptional. Do not create or configure branch protection as a side effect of implementation work.

## Goal

<Observable result that must exist when the task is complete.>

## Read before editing

Required:

- direct task prompt;
- `AGENTS.md`;
- this task file;
- only directly relevant source files, tests and configuration.

Optional only when genuinely needed:

- `LIBRARY.md` — when the relevant area cannot be located efficiently;
- `ASSETS.md` — when external assets are involved;
- `PROJECT.md` — only when this task explicitly depends on product history or a strategic decision;
- `REVIEW.md` — only when the task itself changes reviewer process.

## Requirements

<Only behavior, architecture or technical constraints specific to this task.>

## Validation

Use the review class and proportional validation rules from `AGENTS.md`.

List only task-specific risks not already covered by canonical checks:

- <behavior or boundary case>
- <runtime state, viewport or artifact only when relevant>

A local dependency, proxy, browser-install or package-index failure must be reported as a limitation. It does not authorize fallback packages, vendored compatibility modules, test bypasses or unrelated workflow changes.

## Scope boundary

<Include only when likely scope creep needs an explicit boundary. Do not copy generic exclusions from AGENTS.md.>

## Delivery

Finish implementation, self-review and applicable validation before opening exactly one final PR from the single task branch. Use `.github/pull_request_template.md` and keep only applicable sections. Do not create a draft, replacement PR, additional remote branch or close/reopen cycle as a development mechanism. GitHub handles ephemeral branch deletion after merge; the main chat verifies it.

Do not update lead-only process documents merely for formality. Update `LIBRARY.md` or `ASSETS.md` only when their owned facts changed; the main ChatGPT reviewer owns the final documentation-drift gate.