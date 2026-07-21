# Review class

- [ ] `docs`
- [ ] `code`
- [ ] `visual/runtime`

## Scope

<!-- State the single coherent result delivered by this PR. -->

## Git lifecycle

- Base branch: `main`
- Task branch: `<branch>`
- Lifecycle: `ephemeral` / `persistent`
- PR opened once after implementation and local validation: `yes` / `no`
- Additional remote branches created: `none` / `<explain>`

## Validation

| Command | Result |
|---|---|
| `npm ci` | PASS / FAIL / NOT RUN |
| `python -m pip install -r requirements-dev.txt` | PASS / FAIL / NOT RUN |
| `npm run check` | PASS / FAIL / NOT RUN |

## Runtime inspection

- States inspected: `<list>`
- Viewports/devices inspected: `<list>`
- Preview or screenshot artifacts inspected: `<list>`
- User-approved asset/frame choices: `<list or not applicable>`

## Limitations

<!-- A missing browser, mobile/coarse-pointer device, dependency installation, or other unavailable check must be stated here. Do not describe an unavailable check as passed. -->

## Scope confirmation

- [ ] No unrelated dependency, fallback package, architecture, asset, workflow or infrastructure change was added.
- [ ] The report and artifacts refer to the final head commit.
- [ ] The branch is ready for strict review and merge; this PR is not being used as a development workspace.
