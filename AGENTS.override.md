<!-- audience: codex -->
# Root Codex command-routing override

This file has precedence only for selecting the task mode. After reading it, immediately read the root `AGENTS.md` and follow all of its rules together with this override.

## Canonical existing-PR repair command

A direct prompt matching this readable form, case-insensitively, is always an existing-PR repair request:

```text
Task #<task-number> — Почини «<human-readable result name>» в существующем PR #<pr-number> по последнему repair-комментарию.
```

The Task number and human-readable result name provide stable task-list visibility. The PR number is the authoritative GitHub address. The repair keeps the original Task number; it never creates a replacement task identity.

For backward compatibility, these legacy forms remain accepted, case-insensitively:

```text
Почини «<human-readable result name>» в существующем PR #<number>.
почини PR <number>
```

For example, `Task #001 — Почини «Первую расчистку участка» в существующем PR #81 по последнему repair-комментарию.` means: repair `PR #81 · Task #001 — Первая расчистка участка`.

Legacy aliases never mean to edit repair instructions, documentation, process files or the current checkout merely because the prompt is short. The same restriction applies to the canonical numbered form.

Before changing any file or creating any commit, Codex must:

1. run `git fetch --prune`;
2. fetch the named PR metadata, current head branch/head SHA and top-level comments;
3. find the latest top-level comment containing `integrator-codex-repair:v1`;
4. verify that the Task number/title in the prompt, PR title/body and repair comment are compatible; preserve the existing Task identity;
5. stop without editing anything if the PR or matching comment cannot be accessed;
6. check out the exact existing PR head branch and verify that the current branch is that branch and is not `main`;
7. treat the matching repair comment together with `AGENTS.md` as the complete task contract.

For this command Codex must not:

- reinterpret the repair command as a request to improve `REVIEW.md`, `AGENTS.md`, this override or other workflow documentation;
- edit or commit anything while checked out on `main`;
- create another branch, pull request, issue, task file or Task number;
- invoke `make_pr` or any equivalent PR-creation action;
- ask the user to copy the blocker list, branch, SHA or checks already present in the repair comment.

Successful completion requires pushing the repair commits to the same existing PR head branch and reporting `PR #<pr-number> · Task #<task-number> — <name>`, final head SHA, checks actually run and real limitations. If that cannot be done, stop and report the exact access or push blocker without making unrelated repository changes.
