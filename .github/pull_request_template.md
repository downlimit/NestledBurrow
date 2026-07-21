<!-- Keep only applicable sections. A routine task may come directly from a self-contained Codex prompt; no task file is required. For a docs-only or tiny low-risk change, a concise scope, lifecycle and validation summary is enough. Delete empty or not-applicable sections instead of filling them with bureaucracy. -->

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

<!-- List only checks relevant to the actual risk. State PASS, FAIL or NOT RUN with a short reason. Do not invent extra checks to make the report look complete. -->

- `<command or inspection>` — `PASS / FAIL / NOT RUN`

## Runtime inspection

<!-- Required only for visual/runtime or indirectly presentation-sensitive changes. Delete this section when it does not apply. -->

- States inspected: `<list>`
- Viewports/devices inspected: `<list>`
- Preview or screenshot artifacts inspected: `<list>`
- User-approved asset/frame choices: `<list>`

## Limitations

<!-- Keep only real limitations. Delete this section when there are none. Never describe an unavailable check as passed. -->

## Scope confirmation

- [ ] No unrelated dependency, fallback package, architecture, asset, workflow or infrastructure change was added.
- [ ] Evidence refers to the final head commit.
- [ ] The branch is ready for strict review and merge; this PR is not a development workspace.