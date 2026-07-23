<!-- audience: codex -->
# Codex operating rules

## Audience and entry contract

This file is the mandatory repository contract for Codex implementation tasks.

For a routine task, read in this order:

1. the direct task prompt;
2. `AGENTS.md`;
3. only source files, tests and configuration directly relevant to the task.

Do **not** read `PROJECT.md`, `LEAD.md`, `REVIEW.md` or `LIBRARY.md` by default.

- Read `PROJECT.md` only when the direct prompt explicitly requires product history or a strategic decision.
- Read `LEAD.md` only when the direct prompt explicitly changes Lead workflow or task orchestration.
- Read `REVIEW.md` only when the direct prompt explicitly changes Integrator workflow.
- Read `LIBRARY.md` only when the location of the relevant system is genuinely unclear.
- Read a file from `tasks/` only when the direct prompt explicitly names it.
- Read `ASSETS.md` when the task adds, replaces, selects or audits external assets.

The direct prompt is the task contract. For an existing-PR repair, the prompt may identify a PR and the latest top-level comment containing `integrator-codex-repair:v1`; that comment becomes the direct task contract. Do not expand scope by mining unrelated project history.

## Creative fast lane

Routine gameplay, UI, content, configuration, local refactors and bounded bug fixes use the creative fast lane by default.

The objective is to deliver one observable result quickly enough for product evaluation while preserving proven architectural boundaries.

For a routine task:

- use one ephemeral branch and one final PR;
- implement the smallest clean solution for the current use case;
- use targeted checks for the changed contract and a production build;
- inspect the changed runtime states when behavior or presentation changes;
- leave the canonical full repository suite to PR CI unless the task risk requires it locally;
- do not create task files, preparatory PRs, integration waves or documentation-only follow-ups.

A small explicitly reported residual runtime risk is acceptable for an easily reversible creative iteration when targeted checks and final PR CI are green. Never conceal that risk or claim an unperformed inspection.

## Before editing

1. Run `git fetch --prune`.
2. Verify that the supplied task branch starts from the prompt's Base SHA when one is supplied, otherwise from current `origin/main`.
3. Work only in the single supplied task branch.
4. Never push ordinary task work directly to `main`.
5. Never create or push an additional remote branch.
6. Inspect the relevant implementation before choosing an architecture.
7. Respect explicit scope boundaries and any supplied owned/shared paths.
8. Complete binary delivery preflight before implementing code that depends on new or replaced binaries.

## Binary asset delivery preflight

A task that adds or replaces PNG, JPG, WebP, font, audio, archive or another binary file must prove its delivery path before dependent implementation begins.

Before editing dependent code:

1. identify every required binary path;
2. verify whether each file is already committed in the supplied base;
3. verify that the execution environment and repository policy permit the actual files to be staged, committed, pushed and included in a PR;
4. verify that PR creation remains available after the binary commit;
5. only then implement code, config, tests and documentation that reference the assets.

If delivery is blocked or uncertain, stop before implementing binary-dependent code and report the exact blocked paths. Do not create a code-only PR that claims the missing visual result.

Forbidden workarounds:

- base64 text files instead of runtime binaries;
- ZIP archives when runtime expects separate files;
- fake text extensions or reconstructed placeholders;
- references or asset records for absent files;
- unrelated existing assets presented as the requested variants.

When binaries were pre-imported, verify their exact paths, dimensions and hashes before use. A binary task is complete only when runtime files, references, applicable source/license records and validation evidence are delivered together.

## Pre-imported binary handoff is declarative

Transport and reconstruction of a user attachment are Lead-owned operations. A routine Codex implementation task receives the final runtime binary already committed in the supplied Base SHA.

When the prompt supplies a Base SHA, repository path and hash or relevant metadata:

1. verify that the real runtime file exists at that path in the supplied base;
2. verify its stated hash and relevant metadata;
3. treat the file as an immutable input and implement the requested runtime integration.

The prompt does not need to explain how the attachment was chunked, transported or reconstructed. A compact statement such as `Use the already imported asset at <path> with SHA-256 <hash>` is a complete binary handoff.

Unless the direct task explicitly changes the binary-import infrastructure, do **not**:

- reconstruct an attachment from base64 chunks or a manifest;
- inspect, create or modify `.binary-import/**` staging;
- run, reproduce or explain the repository reconstruction bridge;
- download another copy, regenerate, transcode, normalize, rename or replace the asset;
- ask the Lead to copy transport mechanics into the task prompt.

Do not read `BINARY_IMPORT.md` for an ordinary runtime integration task. Read it only when the direct prompt explicitly assigns maintenance or repair of the binary-import infrastructure.

If the runtime file is absent from the supplied base or its hash does not match, stop before implementation and report the exact mismatch. Do not attempt to complete the Lead-owned import stage.

## Task modes

### Routine direct prompt

This is the default mode.

- Treat the prompt as complete unless a real product ambiguity prevents correct implementation.
- Do not create an issue, task file, planning document or preparatory PR.
- Deliver exactly one coherent observable result in one final PR.

### Existing PR repair task

When the direct prompt names an existing PR and the latest top-level comment containing `integrator-codex-repair:v1`:

1. fetch the PR metadata, current head branch/head SHA and the latest matching repair comment;
2. treat that repair comment as the complete task contract together with `AGENTS.md`;
3. verify the recorded reviewed head and inspect the repair delta context;
4. check out and update the existing PR branch;
5. address every confirmed blocker in the current repair round while excluding optional cleanup;
6. run the applicable targeted checks, build and runtime inspection stated by the repair contract;
7. push all repair commits to the same PR branch;
8. report the final head SHA, checks actually run and real limitations.

Update the existing PR branch. Do not create another branch or pull request, issue, task file or replacement implementation PR. Do not ask the user to relay the blocker list, branch name, SHA or checks already present in the PR comment.

If the PR head moved after the recorded reviewed head, re-read the current diff and continue only when the new commits are compatible with the same repair contract. Report an exact conflict when the scope or contract changed materially.

Do not read `REVIEW.md` merely to execute the repair. The latest marked PR comment carries the Integrator's diagnosis, required result, invariants, exclusions and validation requirements.

### Strict or coordinated task

Use strict handling only when the task affects at least one of these areas:

- central state ownership or architectural boundaries;
- movement, collision or input contracts with broad regression radius;
- persistence, serialization schema or migrations;
- dependencies, workflows, deployment or security-sensitive configuration;
- external assets and licensing;
- shared registries or entry points changed by parallel work;
- several dependent PRs whose merge order matters;
- a change whose failure is difficult to detect after merge.

A durable `tasks/*.md` contract is reserved for large, high-risk, multi-stage, resumable or repeatedly reused work and must be explicitly named by the prompt.

## Integration metadata is optional

Routine independent work does not require Batch, Task, Merge phase, Owned paths or dependency metadata.

The Lead may supply coordination fields for strict or parallel work:

```text
Integration metadata
- Batch: <NB-YYYYMMDD-NN>
- Task: <id>
- Base SHA: <sha>
- Depends on: <none or task ids / PRs>
- Merge phase: <integer>
- Branch: work/<batch>/<task-slug>
- PR title: [<batch>/<task>] <result-oriented title>
- Owned paths: <paths>
- Shared files allowed: <paths or none>
```

When these fields are present:

- use the exact supplied branch and PR title;
- copy the metadata into the PR body, never into `.github/pull_request_template.md`;
- do not modify files outside owned paths except explicitly allowed shared files;
- do not reimplement named dependencies;
- stop and report an exact base/dependency mismatch when the supplied base lacks a required dependency;
- do not ask the user to manage metadata or merge order.

Missing metadata never authorizes extra scope.

## Scope discipline

- Deliver the observable result requested by the prompt.
- Prefer the smallest architecture that cleanly supports current use cases.
- Do not invent future mechanics, frameworks or generalized systems without a second real use case.
- Do not add unrelated refactors, dependencies, assets, workflows, compatibility layers or infrastructure.
- Do not weaken tests or validation because of a local environment failure.
- Ask for clarification only when a product, visual or priority choice materially changes the user-facing result.
- Technical implementation details remain Codex responsibilities unless explicitly constrained.
- Parallel work must remain useful and testable without secretly integrating sibling tasks through unowned shared files.

## Risk-based validation

A task is not complete because the code compiles. Validation depth follows actual regression risk.

### Fast lane

For routine code, gameplay, UI, content or configuration work:

1. run the targeted checks that exercise the changed contract;
2. run `npm run build`;
3. inspect the complete diff;
4. launch and inspect changed runtime states when behavior or presentation changes;
5. let PR CI run the canonical full repository suite.

Run `npm ci` when dependencies are not already installed or package files changed. Run the full local `npm run check` when it is practical and materially reduces risk, but do not duplicate a reliable full PR CI merely as ceremony.

A deterministic failure in an applicable targeted check or build blocks PR creation or marking an existing repair PR ready.

### Strict lane

For strict-risk changes, run the complete local validation path when the environment permits:

```bash
npm ci
python -m pip install -r requirements-dev.txt
npm run check
```

Also run any targeted migration, dependency, workflow, asset or integration checks required by the changed contract.

### Documentation-only

- inspect the complete diff;
- confirm that no executable, asset, dependency or workflow file changed;
- run `npm run check:docs` when available;
- let PR CI perform repository validation;
- do not install runtime or visual dependencies solely to expand the report.

Never report an unavailable or unperformed check as passed. Record the exact limitation.

## Runtime and visual inspection

For visual, animation, input, layout, camera, fullscreen, resize or other interactive changes, launch the game:

```bash
npm run dev -- --host 0.0.0.0
```

Inspect every changed state rather than the complete historical behavior matrix. Check the native logical size and a mobile/coarse-pointer viewport only when the task affects touch or responsive behavior.

When applicable, verify the exact changed aspects of movement, joystick, animation, fullscreen, resize, screen-space UI, world geometry or tile composition. Existing unaffected states need no repeated manual inspection unless the change has a credible regression path into them.

## Dependency and environment integrity

A local network, proxy, package-index, browser-install or dependency failure does not authorize unrelated repository changes.

- Do not vendor fake or partial dependencies.
- Do not add fallback packages, generated binaries or compatibility modules.
- Do not alter canonical validation to bypass a local failure.
- Run every remaining applicable check and report the limitation.
- Let the unchanged GitHub Actions environment perform clean validation.
- Treat a genuine dependency or CI repair as explicit task scope.

## Review-efficient delivery

- Commit on the task branch as often as useful. Commit count is not a quality gate and does not need an artificial budget.
- Finish implementation, self-review, applicable runtime inspection and all known repairs before asking remote CI to certify the result.
- Before opening a non-draft PR or marking a draft ready, run the same applicable validation path that CI will enforce. Dependency, workflow, persistence, external-asset and other strict-risk changes require the complete local suite when the environment supports it.
- When a task adds a new command to the mandatory `npm run check` chain, run the complete updated chain locally; passing only the new targeted script is insufficient.
- A final non-draft PR may be opened directly after the applicable local suite is green. Use draft state when work or remote-only diagnosis remains; draft is a circuit breaker, not a restriction on committing.
- If CI fails, identify the exact failing command first and determine whether the same command already fails on the base/current `main` or only on the PR head. Do not assume every red run was caused by the PR.
- A pre-existing base failure is repaired as a base-contract defect before judging the implementation diff.
- Any number of corrective commits may be pushed while the PR is draft. Do not rerun an unchanged deterministic failure; rerun only after a relevant fix or for a confirmed transient infrastructure failure.
- Do not knowingly present a PR as ready while an applicable local command is red or was not run without an explicit limitation.
- Keep one coherent user-facing or technical concern per PR when `main` can remain usable between stages.
- Ensure evidence and artifacts refer to the final head SHA.

Use `.github/pull_request_template.md` as a minimal report and delete sections that do not apply. For an existing-PR repair, update the current PR report only when the final scope, evidence or head SHA materially changed; do not replace its original task context.

## Documentation boundaries

Codex should not carry Lead or Integrator context merely to keep documentation current.

- Do not edit `PROJECT.md`, `LEAD.md` or `REVIEW.md` unless the prompt explicitly changes their owned facts.
- Update `LIBRARY.md` only when important files, entry points or canonical addresses are materially added, removed, renamed or reassigned and the prompt allows it.
- Update `ASSETS.md` only when external sources, licensing, hashes or asset policy change.
- Update `AGENTS.md` only when the task explicitly changes Codex operating rules.
- Do not write planned or unverified behavior as shipped.
- Prefer documentation in the same implementation/integration PR; do not create a routine follow-up documentation PR.
- The Integrator owns the final material documentation-drift check.

## Branch lifecycle

- Ordinary tasks use exactly one ephemeral remote branch.
- Existing-PR repairs use the current PR head branch and never create a replacement branch or PR.
- Use an exact supplied branch name when present.
- GitHub automatic head-branch deletion handles cleanup after merge.
- Do not delete the active branch from inside the implementation task.
- Do not modify repository rulesets, branch protection, settings or tokens.
- Never delete or rewrite `main`, `release/*`, `archive/*` or `keep/*`.
- Persistent branches require an explicit durable contract and repository-side protection.

## Pixel-grid protocol

All world art on the same source pixel grid must use one visual pixel size.

- Do not independently scale player, environment or props sharing the 16×16 grid.
- Prefer native-size world assets and one logical render grid.
- Use integer displayed zoom; letterboxing is acceptable.
- Preserve nearest-neighbor rendering and integer camera sampling.
- Check visual changes at two viewport sizes when viewport scaling is affected.
- Screen-space UI may use separate dimensions but must not alter world-art scale.

## Third-party spritesheet protocol

Never select production frames by guessing raw numeric indexes.

1. Read source metadata, tile dimensions, margins and spacing.
2. Prefer standalone named PNG files when available.
3. Generate a labeled contact sheet when a sheet must be inspected.
4. Render author examples when available.
5. Obtain user approval for semantically ambiguous frames.
6. Centralize approved selections behind semantic names.
7. Record source, geometry, selections and hashes when applicable.
8. Ensure final-head visual evidence is available before merge.

The spritesheet protocol does not replace binary delivery preflight.

## Completion report

Use the shortest report that contains applicable evidence.

Always identify:

- concise scope and review class;
- work branch and final head SHA;
- validation actually performed;
- real limitations.

Include Integration metadata only when the prompt supplied it. Include runtime states, devices, artifacts, assets, dependency changes or infrastructure details only when they apply.

Do not claim a visual/runtime result was inspected when it was not. Present the PR as ready only after the applicable local validation is green, and state any residual limitation honestly.
