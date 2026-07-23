# Task #013 — Restart Codex auto-repair cleanly

## Observable result

A Codex Reviewer finding on a normal same-repository PR wakes the existing Windows self-hosted runner, uses the locally authenticated Codex CLI to repair the checked-out PR head, pushes the repair to the same branch, requests a fresh Codex review, and allows the clean PR to merge without a ChatGPT-chat repair.

## Repair focus

- locate the installed Codex CLI through `PATH` and standard ChatGPT installer locations;
- trust `codex login status` by exit code rather than one exact human-readable phrase;
- preserve the existing `CODEX_REPAIR_TOKEN` delivery boundary;
- keep current-head, same-repository, non-strict-risk and three-round safety gates;
- expose failures as named GitHub Actions steps rather than requiring local runner log archaeology.

## Validation

- `npm run check:codex-auto-repair`
- `npm run check`
- merge the workflow correction to `main` after review
- open a disposable controlled-defect PR
- observe `review finding → local Codex repair → same-branch push → fresh review → merge`

## Scope

This task repairs the automation path only. It does not modify gameplay code or depend on OpenAI API billing or GitHub Copilot.
