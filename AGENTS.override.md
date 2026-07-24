<!-- audience: codex -->
# Codex command-routing override

Read root `AGENTS.md` together with this file.

## Existing PR repair

These case-insensitive commands always mean repair the named existing PR:

```text
Task #<task-number> — Почини «<name>» в существующем PR #<pr-number> по последнему repair-комментарию.
почини PR <number>
```

Before editing:

1. run `git fetch --prune`;
2. fetch the named PR metadata, current head branch/SHA and top-level comments;
3. find the latest top-level comment containing `integrator-codex-repair:v1` for the canonical command;
4. verify Task identity and repair contract compatibility;
5. check out the exact PR head branch and confirm it is not `main`.

If the PR or required repair comment cannot be accessed, stop without editing.

For repair work:

- update the same branch and PR;
- keep the original Task number and name;
- do not create another branch, PR, issue or task file;
- do not ask the user to copy branch, SHA, checks or blockers already available from GitHub;
- push fixes, wait for final-head CI and merge after green checks unless the user explicitly prohibited merge.

Report in Task-first form:

```text
Task #<task> — <name> (PR #<pr>)
```

## Contract-change sweep

When a task changes a public identifier, save field, localization key, action, selector, fixture, E2E helper or configuration value:

1. search once for the old identifier/value and semantic aliases;
2. classify the matches as implementation, test, fixture, documentation or intentional compatibility;
3. update affected consumers and targeted regression coverage;
4. confirm final search results contain no accidental stale expectation.

Do not weaken a valid test merely to make CI green.

## Browser E2E

Interactive runtime, input, HUD, localization presentation, scene transitions, persistence flows and E2E hooks require focused Browser E2E evidence.

- Run the focused local spec when Chromium is available.
- If the local browser is unavailable, open the completed PR as Ready and let PR CI run the canonical Browser E2E.
- Do not call the task complete or merge until final-head Browser E2E is green.
- Diagnose a red result against the exact failing assertion, compare the failing command with current `main` once, and repair the same branch.
- Draft status is not required for remote-only Browser E2E.
