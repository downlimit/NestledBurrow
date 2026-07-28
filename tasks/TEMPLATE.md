# Task #<number> — <short result title>

<!-- Use only for large, dependent, resumable or repeatedly reused work. Routine work uses a short direct prompt. Do not repeat AGENTS.md or the whole game description. -->

## Goal

<Observable result.>

## Relevant systems

- `systems/<system>.md`

## Critical constraints

- <only constraints whose absence could produce the wrong result>

## Asset preflight (when applicable)

- Every required tracked binary already exists in the supplied Base SHA.
- Record canonical path, native dimensions, frame order, byte length, SHA-256 and provenance.
- Codex integrates immutable binaries only; a missing asset blocks implementation.
- The implementation diff contains no new or modified tracked binary files.

## Acceptance

- <observable or automated proof>

## Coordination (optional)

- Base SHA: `<sha>`
- Depends on: `<Task numbers / none>`
- Owned paths: `<paths / none>`

## Delivery

- Branch: `task/<number>-<slug>`
- PR title: `Task #<number> — <short result title>`
- One Ready PR, final-head CI, repair in the same branch, merge after green CI.
