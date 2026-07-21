# Task: <short title>

## Git lifecycle

- Base branch: current `main`
- Remote branches allowed: `1`
- Work branch: use the single branch supplied by Codex; do not push additional branches
- Lifecycle: `ephemeral`
- Delete after merge: `yes` — handled by GitHub automatic head-branch deletion
- Persistent/protected branch: `no`

For an exceptional long-lived branch, change only these fields:

- Lifecycle: `persistent`
- Delete after merge: `no`
- Persistent/protected branch: `yes`
- Required branch prefix: `release/`, `archive/` or `keep/`
- Protection reason: `<explicit reason>`

## Goal

<What result must exist when the task is complete.>

## Read before editing

- `AGENTS.md`
- `PROJECT.md`
- `LIBRARY.md`
- `REVIEW.md`
- <directly relevant files>

## Requirements

<Required behavior and technical constraints.>

## Validation

Run the repository checks required by `AGENTS.md` and manually inspect every affected runtime state.

## Scope boundary

<Explicitly list what must not be added or changed.>

## Delivery

Finish implementation and validation before opening the PR. Open exactly one final PR from the single task branch. Include the completion report required by `AGENTS.md` and `REVIEW.md`.
