# Task: safe cleanup of stale remote branches

## Git lifecycle

- Base branch: current `main`
- Direct push to `main`: `no`
- Remote branches allowed: `0`
- Work branch: do not create or push a new branch for this maintenance task
- Lifecycle: maintenance only
- Create PR: `no`
- Modify repository files: `no`

## Goal

Remove stale remote branches from `origin` without deleting active, protected, persistent, deployment-related or ambiguous work.

## Required procedure

1. Read `AGENTS.md`, especially `Branch lifecycle`.
2. Run `git fetch --prune`.
3. List all remote branches and all open, closed and merged pull requests associated with them.
4. For every branch, inspect:
   - associated PR state;
   - unique commits relative to current `origin/main`;
   - whether the branch is protected or persistent;
   - whether repository settings, Pages or another deployment process use it.
5. Always preserve:
   - `main`;
   - branches with an open PR;
   - `release/*`;
   - `archive/*`;
   - `keep/*`;
   - any protected branch;
   - any branch used as a deployment or publication source;
   - any branch whose purpose, unique commits or merge status is ambiguous.
6. A stale branch may be deleted only when one of these is verified:
   - its PR was merged;
   - its PR was explicitly marked superseded and the replacement is merged;
   - its PR was closed without merge and all useful changes were verified as merged elsewhere;
   - it has no unique commits relative to current `origin/main`, no open PR and no protection/deployment role.
7. Before deleting anything, print two exact lists:
   - `PRESERVE` with a short reason per branch;
   - `DELETE` with a short verified reason per branch.
8. Delete only branches in the verified `DELETE` list using:

```bash
git push origin --delete <branch>
```

9. Run `git fetch --prune` again and print the final remaining remote branches.

## Safety rules

- Never delete, force-update or rewrite `main`, `release/*`, `archive/*` or `keep/*`.
- Never delete a branch with an open PR, active protection or deployment role.
- Never delete a branch merely because its PR is closed.
- Never weaken branch protection, change repository settings or request a broader administrative token to make cleanup succeed.
- If deletion permission is unavailable, stop deletion attempts and report the exact permission blocker and intended `DELETE` list.
- Preserve ambiguity instead of guessing.
- Do not edit files, commit, push a new branch or create a PR.

## Completion report

Report:

- every deleted branch and why deletion was safe;
- every preserved branch and why it was preserved;
- the final remote branch list;
- any branch that could not be classified confidently;
- any permission or protection rule that prevented deletion.
