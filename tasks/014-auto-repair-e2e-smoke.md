# Task #014 — Prove Codex auto-repair end to end

## Observable result

A disposable normal PR contains one deliberate semantic defect. Codex Reviewer finds it, the Windows self-hosted runner launches the locally authenticated Codex CLI, Codex fixes the current checkout, the workflow pushes the fix to this same PR branch, requests a fresh review, and the clean PR merges automatically.

## Controlled defect

`scripts/auto-repair-e2e-smoke.mjs` must treat a review as current only when `reviewedHead` and `currentHead` are identical. The initial implementation deliberately returns the opposite result so the review/repair loop has a real finding to process.

## Validation

- initial Pull Request Check remains green;
- Codex Reviewer creates a current-head inline finding;
- `Codex Auto Repair` runs on `NestledBurrow-Codex`;
- Codex changes `reviewedHeadMatchesCurrent` to equality and corrects its assertions;
- workflow pushes to `task/014-auto-repair-e2e-smoke`;
- fresh CI and Codex review are clean;
- Fast lane auto-merge closes the PR.

## Scope

Disposable pipeline proof only. The smoke file is removed in a later cleanup after the complete loop is confirmed.
