<!-- audience: codex -->
# Root Codex command-routing override

This file has precedence for selecting the task mode and for the non-negotiable completion gates below. After reading it, immediately read the root `AGENTS.md` and follow all of its rules together with this override.

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

The legacy alias never means to edit repair instructions, documentation, process files or the current checkout merely because the prompt is short. The same restriction applies to the canonical numbered form.

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

## Contract-change dependency sweep

A runtime contract change is incomplete until every repository consumer of the old contract has been found and handled.

This applies when changing an interaction kind, action ID, localization key, public function name, argument shape, return value, save field, schema, E2E helper, selector, fixture, expected UI text, input binding, event name, route, resource ID or configuration key.

Before completion Codex must:

1. search the repository for the old identifier, old value and relevant semantic aliases;
2. classify each match as implementation, test, fixture, documentation or intentional compatibility path;
3. update all affected unit, contract and Browser E2E tests in the same PR;
4. add or strengthen a regression test when the changed behavior was previously untested;
5. run the targeted checks for the new contract and all affected consumers;
6. inspect the final diff and search results to confirm that no accidental stale expectation remains.

Changing production code without updating affected tests is incomplete. Do not weaken, delete or rewrite a test merely to make CI green unless the product contract intentionally changed and the new expectation directly represents that contract.

When an old identifier remains intentionally supported, preserve it through an explicit compatibility path and test both legacy and canonical behavior. Do not leave accidental stale references.

## Browser E2E completion gate

Browser E2E is mandatory for changes to interactive runtime behavior, input, HUD, localization presentation, scene transitions, persistence flows or E2E-facing helpers.

If Browser E2E cannot run locally because browser binaries or another environment dependency are unavailable:

- record the exact limitation;
- open the PR as draft;
- let CI perform the first browser run;
- inspect the CI failure and Playwright artifacts;
- repair every deterministic PR-head failure in the same branch;
- keep the PR draft until Browser E2E is green;
- mark the PR ready only after the final-head Browser E2E run succeeds.

An unavailable local Browser E2E run does not authorize a non-draft PR presented as complete.

After a red Browser E2E run Codex must:

1. identify the exact failed assertion, error or timeout;
2. determine whether it reproduces on current `main` or is introduced by the PR;
3. update implementation and/or affected tests according to the intended product contract;
4. push the repair to the same PR branch;
5. wait for a fresh final-head run before presenting the PR as ready.

Do not leave a deterministic Browser E2E failure for the user or Integrator to diagnose when it can be repaired inside the task branch.

When any applicable mandatory check cannot be run locally, the PR must be opened as draft. It may become ready only after the corresponding final-head CI check succeeds.