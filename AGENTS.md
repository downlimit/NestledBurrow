<!-- audience: codex -->
# Codex operating rules

## Audience and entry contract

This file is the mandatory repository contract for Codex implementation tasks.

For a routine task, read in this order:

1. the direct task prompt;
2. `AGENTS.md`;
3. only source files, tests and configuration directly relevant to the task.

Do **not** read `PROJECT.md`, `REVIEW.md` or `LIBRARY.md` by default.

- Read `PROJECT.md` only when the direct prompt explicitly says that product history or a strategic decision is required.
- Read `LIBRARY.md` only when the location of the relevant system is genuinely unclear.
- Read `REVIEW.md` only when the direct prompt explicitly asks for reviewer-process work; normal implementation delivery is fully specified here and in the PR template.
- Read a file from `tasks/` only when the direct prompt explicitly names it.
- Read `ASSETS.md` when the task adds, replaces, selects or audits external assets.

The direct prompt is the task contract. Do not expand its scope by mining unrelated project history.

## Before editing

1. Run `git fetch --prune`.
2. Verify that the supplied task branch starts from current `origin/main`.
3. Work only in the single supplied task branch.
4. Never push ordinary task work directly to `main`.
5. Never create or push an additional remote branch.
6. Inspect the relevant existing implementation before choosing an architecture.

## Task entry modes

### Routine direct prompt

This is the default for normal iterations.

- Do not create a task file, issue, planning document or preparatory PR.
- Use current `main`, one ephemeral branch and one final PR.
- Treat the prompt as complete unless a real product ambiguity prevents correct implementation.

### Explicit durable task file

Use only when the prompt names a `tasks/*.md` file.

A durable task file is reserved for large, high-risk, multi-stage, resumable or repeatedly reused work where repository persistence materially reduces risk.

## Scope discipline

- Deliver the observable result requested by the prompt.
- Prefer the smallest architecture that cleanly supports the current use cases.
- Do not invent future mechanics, frameworks or generalized systems not exercised by the task.
- Do not add unrelated refactors, dependencies, assets, workflows, compatibility layers or infrastructure.
- Do not weaken existing tests or validation to make a local environment pass.
- Stop for clarification only when a product, visual or priority choice materially changes the user-facing result.
- Technical implementation details are Codex responsibilities unless the prompt explicitly constrains them.

## Mandatory validation

A task is not complete because the code compiles.

For `code` or `visual/runtime` changes, run:

```bash
npm ci
python -m pip install -r requirements-dev.txt
npm run check
```

For a documentation-only change:

- inspect the complete diff;
- confirm that no executable, asset, dependency or workflow file changed;
- run `npm run check:docs` when available;
- let the normal PR workflow perform repository validation;
- do not install runtime or visual dependencies solely to pad the report.

Never report an unavailable or unperformed check as passed. Record the exact limitation.

### Runtime and visual inspection

For visual, animation, input, layout, camera, fullscreen, resize or other interactive changes, also launch the game:

```bash
npm run dev -- --host 0.0.0.0
```

Inspect every changed state, not only initial page load. Check the native logical game size and a mobile/coarse-pointer viewport whenever touch behavior is involved.

### Movement, joystick and animation

When applicable, explicitly verify:

- idle after release;
- walk up, down, left and right;
- facing matches movement;
- diagonal input does not increase speed;
- keyboard and mobile joystick both work;
- the active joystick pointer continues outside the canvas;
- loss of pointer capture does not terminate ownership when the global fallback should continue it;
- matching release outside the canvas resets movement;
- cancellation, blur, hidden document and fullscreen transitions do not leave stuck movement;
- world and room collision boundaries remain correct.

### Fullscreen, resize and screen-space UI

When applicable, explicitly verify:

- enter and exit through supported paths;
- state and icon synchronization after system exit or `Esc`;
- integer zoom and crisp pixels after resize/fullscreen transitions;
- desktop and mobile/coarse-pointer layouts;
- HUD input does not activate gameplay controls.

### Room, world and tile changes

When applicable, explicitly verify:

- floor and outdoor ground fill intended areas;
- wall directions, corners and bands use correct tiles;
- doors and openings are genuinely traversable;
- no unrelated sprites appear;
- pixels remain crisp;
- generated preview artifacts represent the intended result.

## Dependency and environment integrity

A local network, proxy, package-index, browser-install or dependency failure does not authorize repository changes outside the task.

- Do not vendor a fake or partial dependency replacement.
- Do not add fallback packages, generated binaries or compatibility modules.
- Do not alter canonical validation scripts to bypass the failure.
- Run every remaining possible check and report the limitation.
- Let the unchanged GitHub Actions environment perform clean validation.
- A genuine dependency or CI repair must be explicit task scope.

## Review-efficient delivery

- Develop without an open PR.
- Finish implementation, self-review, browser inspection and known repairs first.
- Batch related corrections instead of pushing one commit per small defect.
- Create exactly one final PR after applicable validation.
- Do not use draft PRs, close/reopen cycles or replacement PRs as a development mechanism.
- Keep one coherent implementation concern per PR when `main` can remain usable between stages.
- Do not knowingly open a PR with obvious defects merely because automated checks pass.
- Ensure all evidence and artifacts refer to the final head SHA.

Use `.github/pull_request_template.md`. Keep only sections applicable to the actual risk.

## Documentation boundaries

Codex should not carry the virtual lead's full context merely to keep documentation current.

- Do not edit `PROJECT.md` or `REVIEW.md` unless the direct prompt explicitly changes lead context, product strategy or reviewer process.
- Update `LIBRARY.md` only when important files, entry points or canonical addresses are added, removed, renamed or materially reassigned.
- Update `ASSETS.md` only when external asset sources, licensing, hashes or asset policy change.
- Update `AGENTS.md` only when the task explicitly changes Codex operating rules.
- Do not write future or unverified behavior as already shipped.
- The main ChatGPT reviewer owns the final documentation-drift check and may repair canonical docs in the same branch before merge.

## Branch lifecycle

- Ordinary tasks use exactly one ephemeral remote branch.
- GitHub automatic head-branch deletion handles it after merge.
- Do not delete the active task branch from inside the implementation task.
- Do not modify repository rulesets, branch protection, settings or tokens.
- Do not request broader administrative access merely to finish a normal task.
- Never delete or rewrite `main`, `release/*`, `archive/*` or `keep/*`.
- Persistent branches are exceptional and require an explicit durable task contract, approved prefix and repository-side protection.
- Do not perform branch cleanup as a side effect of implementation work.

## Pixel-grid protocol

All world art on the same source pixel grid must use one visual pixel size.

- Do not independently scale player, environment or props that share the 16×16 grid.
- Prefer native-size world assets and one logical render grid.
- The displayed canvas must use integer zoom; letterboxing is acceptable.
- Use nearest-neighbor rendering: `pixelArt: true`, `antialias: false`, `roundPixels: true`, `image-rendering: pixelated`.
- Camera follow and scroll must not introduce subpixel sampling.
- Check visual changes at two or more viewport sizes.
- UI may use separate screen-space dimensions but must not alter world-art scale.

## Third-party spritesheet protocol

Never select production frames by guessing raw numeric indexes.

1. Read source metadata, tile dimensions, margins and spacing.
2. Prefer standalone named PNG files when available.
3. Generate a labeled contact sheet when a sheet must be inspected.
4. Render author examples when available.
5. Obtain user approval for semantically ambiguous frames.
6. Centralize approved selections behind semantic names.
7. Record source, geometry, selected rectangles/indexes and hashes in `ASSETS.md` or a canonical manifest when applicable.
8. Ensure visual previews from the final head are available before merge.

## Completion report

Use the shortest report that contains applicable evidence.

Always identify:

- review class and concise scope;
- work branch, lifecycle and final head SHA;
- whether additional remote branches were created;
- validation performed;
- real limitations.

Include runtime states, viewports, devices, artifacts, asset choices, dependency changes or infrastructure changes only when they apply.

Do not claim a visual/runtime task is complete when its changed runtime behavior was not inspected. Open the final PR for strict review and state the limitation honestly.