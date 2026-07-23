<!-- audience: codex -->
# Root Codex command-routing override

This file has precedence only for selecting the task mode. After reading it, immediately read the root `AGENTS.md` and follow all of its rules together with this override.

## Canonical existing-PR repair command

A direct prompt matching this readable form, case-insensitively, is always an existing-PR repair request:

```text
Почини «<human-readable result name>» в существующем PR #<number>.
```

The human-readable result name exists for task-list visibility. The PR number is the authoritative GitHub address.

For backward compatibility, the legacy short alias remains accepted, case-insensitively and with an optional `#`:

```text
почини PR <number>
```

For example, both `Почини «Первую расчистку участка» в существующем PR #81.` and `почини PR 81` mean: repair the existing pull request `#81`. The legacy alias never means to edit repair instructions, documentation, process files or the current checkout merely because the prompt is short. The same restriction applies to the canonical readable form.

Before changing any file or creating any commit, Codex must:

1. run `git fetch --prune`;
2. fetch the named PR metadata, current head branch/head SHA and top-level comments;
3. find the latest top-level comment containing `integrator-codex-repair:v1`;
4. stop without editing anything if the PR or matching comment cannot be accessed;
5. check out the exact existing PR head branch and verify that the current branch is that branch and is not `main`;
6. treat the matching repair comment together with `AGENTS.md` as the complete task contract.

For this command Codex must not:

- reinterpret either readable repair form or `почини PR <number>` as a request to improve `REVIEW.md`, `AGENTS.md`, this override or other workflow documentation;
- edit or commit anything while checked out on `main`;
- create another branch, pull request, issue or task file;
- invoke `make_pr` or any equivalent PR-creation action;
- ask the user to copy the blocker list, branch, SHA or checks already present in the repair comment.

Successful completion requires pushing the repair commits to the same existing PR head branch and reporting the final head SHA, checks actually run and real limitations. If that cannot be done, stop and report the exact access or push blocker without making unrelated repository changes.
