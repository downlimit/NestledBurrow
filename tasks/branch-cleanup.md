# Task: safe cleanup of stale remote branches

## Git lifecycle

- Base branch: current `main`
- Remote branches allowed: `0`
- Work branch: do not create or push a new branch for this maintenance task
- Lifecycle: maintenance only
- Create PR: `no`
- Modify repository files: `no`

## Goal

Remove stale remote branches from `origin` without deleting active, protected, persistent or ambiguous work.

## Required procedure

1. Read `AGENTS.md`, especially `Branch lifecycle`.
2. Run `git fetch --prune`.
3. List all remote branches and all open/closed/merged pull requests associated with them.
4. Always preserve:
   - `main`;
   - branches with an open PR;
   - `release/*`;
   - `archive/*`;
   - `keep/*`;
   - any branch whose purpose or merge status is ambiguous.
5. A stale branch may be deleted only when one of these is verified:
   - its PR was merged;
   - its PR was explicitly marked superseded and the replacement is merged;
   - its PR was closed without merge and the useful changes were verified as merged elsewhere;
   - it has no unique commits relative to current `main` and no open PR.
6. Before deleting anything, print two exact lists:
   - `PRESERVE`;
   - `DELETE` with a short verified reason per branch.
7. Delete only branches in the verified `DELETE` list using:

```bash
git push origin --delete <branch>
```

8. Run `git fetch --prune` again and print the final remaining remote branches.

## Safety rules

- Never delete `main`, `release/*`, `archive/*` or `keep/*`.
- Never delete a branch with an open PR.
- Never force-update any branch.
- Never delete a branch merely because its PR is closed.
- Preserve ambiguity instead of guessing.
- Do not edit files, commit, push a new branch or create a PR.

## Completion report

Report:

- every deleted branch and why deletion was safe;
- every preserved branch and why it was preserved;
- the final remote branch list;
- any branch that could not be classified confidently.
