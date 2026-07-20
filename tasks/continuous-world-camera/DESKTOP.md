# Desktop Codex handoff

Use this file when the task is executed by Codex Desktop against a local clone.

## Repository setup

1. Open the local `NestledBurrow` repository as the Codex project.
2. Update the local repository before starting:

```bash
git switch main
git pull --ff-only origin main
git status
```

3. Confirm that `main` contains this file and `tasks/continuous-world-camera/TASK.md`.
4. Work in an isolated worktree or a new branch created from the updated `main`, preferably:

```text
feature/continuous-world-camera
```

Do not implement directly on `main`.

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

Run all commands required by `AGENTS.md` and `TASK.md`.

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

After validation:

1. Commit all intended changes on the feature branch.
2. Do not merge into `main` locally.
3. Push the feature branch and create a pull request targeting `main`.
4. Include the exact test commands and manual visual observations in the PR description.

The task is not complete until the PR exists for external review.
