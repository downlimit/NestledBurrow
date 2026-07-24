<!-- audience: codex -->
# Existing PR repair route

Read this file with root `AGENTS.md`.

These case-insensitive commands always repair the named existing PR:

```text
Task #<task-number> — Почини «<name>» в существующем PR #<pr-number> по последнему repair-комментарию.
почини PR <number>
```

Before editing:

1. Run `git fetch --prune`.
2. Fetch the named PR metadata, current head branch/SHA, and top-level comments.
3. Find the latest top-level `integrator-codex-repair:v1` comment and use its canonical command.
4. Verify Task identity and repair-contract compatibility.
5. Check out the exact PR head branch and confirm it is not `main`.

If the PR or repair comment is inaccessible, stop without editing.

Update the same branch and PR; preserve Task number/name; create no branch, PR, issue, or task file. Do not ask the user for GitHub data already available there. Push the fix, wait for final-head CI, and merge after green checks unless explicitly prohibited.

Report as `Task #<task> — <name> (PR #<pr>)`.
