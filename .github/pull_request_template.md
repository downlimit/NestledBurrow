<!-- Keep only applicable sections. Routine work may come directly from a self-contained Codex prompt; no task file is required. Delete empty or not-applicable sections instead of filling them with bureaucracy. -->

# Integration metadata

<!-- Required for implementation PRs. Use `standalone` and `none` when the PR has no parallel dependencies. These fields let the Integrator process every open PR from one `проверь все PR` command. -->

- Batch: `<NB-YYYYMMDD-NN / standalone>`
- Task: `<id / standalone>`
- Base SHA: `<sha>`
- Depends on: `<none / task ids / PR numbers>`
- Merge phase: `<integer>`
- Owned paths: `<paths>`
- Shared files touched: `<none / explicitly allowed paths>`

# Review class

- [ ] `docs`
- [ ] `code`
- [ ] `visual/runtime`

## Scope

<!-- State the single coherent result delivered by this PR. -->

## Git lifecycle

- Base branch: `main`
- Work branch: `<branch>`
- Final head SHA: `<sha>`
- Lifecycle: `ephemeral` / `persistent`
- PR opened once after implementation and validation: `yes` / `no`
- Additional remote branches created: `none` / `<explain>`

## Validation

<!-- List only checks relevant to the actual risk. Use PASS, FAIL or NOT RUN with a short reason. Never describe an unavailable check as passed. -->

- `<command or inspection>` — `PASS / FAIL / NOT RUN`

## Runtime inspection

<!-- Required only for visual/runtime or indirectly presentation-sensitive changes. Delete when not applicable. -->

- States inspected: `<list>`
- Viewports/devices inspected: `<list>`
- Preview or screenshot artifacts inspected: `<list>`
- User-approved asset/frame choices: `<list>`

## Limitations

<!-- Keep only real limitations. Delete when there are none. -->

## Canonical documentation

<!-- State only documents whose owned facts changed. The Integrator performs the final semantic drift check. -->

- Updated: `<PROJECT.md / LEAD.md / LIBRARY.md / AGENTS.md / REVIEW.md / ASSETS.md / none>`
- Reason: `<brief reason or no owned fact changed>`

## Scope confirmation

- [ ] No unrelated dependency, fallback package, architecture, asset, workflow or infrastructure change was added.
- [ ] Changes stay within Owned paths and explicitly allowed Shared files.
- [ ] Evidence refers to the final head commit.
- [ ] Canonical documentation owned by this change is current, or no canonical document was affected.
- [ ] The branch is ready for strict Integrator review and merge; this PR is not a development workspace.