# Desktop Codex handoff

Use this file when the task is executed by Codex Desktop against a local clone.

## Zero-terminal rule for the user

The user must not be asked to type Git, npm, Python or GitHub CLI commands manually.

Codex Desktop must execute the required commands itself through its local command tools, requesting in-app approval only when the current approval mode requires it.

The user may need to perform one-time graphical setup outside the task:

- clone the repository through GitHub Desktop or another graphical Git client;
- sign in to GitHub;
- select the local repository folder in Codex Desktop.

After that setup, routine fetch, pull, branch creation, testing, commit and push are Codex's responsibility.

## Repository synchronization before editing

Before touching project files:

1. Inspect the repository state with `git status --porcelain`.
2. If unrelated uncommitted user changes exist, do not stash, overwrite, reset or delete them. Stop and report the affected paths.
3. Run `git fetch origin --prune`.
4. Confirm that `origin/main` exists.
5. Start the task from the latest `origin/main` using Codex Desktop's isolated worktree support when available.
6. Otherwise update local `main` with a fast-forward-only pull and create a new feature branch from it.
7. Never implement directly on `main`.

Preferred feature branch:

```text
feature/continuous-world-camera
```

Do not assume that the local repository updates itself in the background. This synchronization sequence is mandatory at the beginning of every new local task.

## Primary task

Read and execute:

- `AGENTS.md`
- `PROJECT.md`
- `LIBRARY.md`
- `tasks/continuous-world-camera/TASK.md`

All requirements in `TASK.md` apply except where this desktop handoff explicitly overrides them.

## Desktop override for binary files

Section 3 of `TASK.md` describes a base64 workaround required by the web/cloud Codex PR transport. It does not apply to the local desktop workflow.

For Codex Desktop:

- create the real PNG atlas directly at its final repository path;
- add the binary PNG to git normally;
- commit the PNG, JSON atlas and source changes together;
- do not generate `.base64.txt` files;
- do not create `tasks/continuous-world-camera/export/`;
- do not leave a transfer manifest intended only for the main chat to decode;
- retain the normal asset provenance, dimensions, semantic frame data and SHA-256 information in the canonical project manifest required by `TASK.md`.

Git and GitHub support the resulting binary PNG normally once it is committed from the local clone.

## Validation and review

Run all commands required by `AGENTS.md` and `TASK.md` yourself. Do not instruct the user to open a terminal.

Use the desktop app's local browser or built-in browser to inspect the running game. Do not treat successful compilation as visual validation.

Before completion, inspect:

- all generated preview artifacts;
- the game indoors and outdoors;
- upper wall joins;
- doorway traversal;
- camera follow and world-edge behavior;
- keyboard and mobile joystick behavior;
- pixel consistency at two viewport sizes.

## Git completion

After validation, Codex must:

1. Review the final diff and confirm that only intended changes are present.
2. Commit all intended changes on the feature branch.
3. Push with upstream tracking using the equivalent of `git push -u origin HEAD`.
4. Never merge into `main` locally.
5. Create a pull request targeting `main` through the Codex app's GitHub action when available.
6. If the app does not expose PR creation but an authenticated GitHub CLI is available, Codex may run `gh pr create` itself despite the cloud-only restriction in the final lines of `TASK.md`.
7. If neither PR method is available, stop after a successful push and report the exact branch name. The main ChatGPT workflow will create the PR through the GitHub connector; the user still does not need a terminal.
8. Include exact test commands and manual visual observations in the PR description.

The task is not complete until the feature branch is pushed. A PR should also exist unless the environment lacks both supported PR creation routes.

## After merge

Do not reuse the old feature branch for the next task.

The next Codex task must repeat the synchronization sequence from `origin/main` and start a fresh branch or worktree. Pulling the merged result is therefore handled automatically by the next task's preflight rather than by the user.
