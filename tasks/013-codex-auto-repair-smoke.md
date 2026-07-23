# Task #013 — Verify Codex auto-repair end to end

## Observable result

A controlled current-head defect is found by Codex Reviewer, repaired by the self-hosted Codex CLI runner, pushed to the same PR branch, reviewed again, and merged automatically without a ChatGPT-chat repair.

## Controlled defect

`scripts/codex-auto-repair-smoke.mjs` currently implements reviewed/current head equality backwards. The final implementation must return `true` for equal heads and `false` for different heads, with matching assertions.

## Validation

- `npm run check:codex-auto-repair-smoke`
- `npm run check`
- current-head Codex review
- automatic same-branch repair push
- automatic clean merge

## Scope

This is a disposable pipeline proof. After the full loop is proven, the smoke script and task file should be removed in a cleanup task.
