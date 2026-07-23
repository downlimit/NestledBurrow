<!-- Fast lane is the default. Keep the report short and delete optional sections that do not apply. Integration metadata is only for strict, dependent or parallel work. Automatic Codex Review is repository-managed. Fast lane may squash-merge automatically after current-head review, required CI and resolved Codex threads. -->

# Task

- Task: `Task #<number> — <human-readable result name>`
- PR title: must exactly match the Task title above

# Scope

<!-- State the single observable result delivered by this PR. -->

# Review class

<!-- Check strict-risk for persistence/schema, shared state, input/collision, dependencies, workflows, deployment, security, external assets or dependent PRs. Strict-risk disables automatic merge and requires Integrator acceptance. -->

- [ ] `docs`
- [ ] `code`
- [ ] `visual/runtime`
- [ ] `strict-risk`

## Git lifecycle

- Work branch: `task/<number>-<slug>`
- Final head SHA: `<sha>`

## Validation

<!-- List only checks and inspections relevant to the actual change. Use PASS, FAIL or NOT RUN with a brief reason. PR CI supplies the canonical full repository suite. -->

- `<targeted command, build or inspection>` — `PASS / FAIL / NOT RUN`

## Runtime inspection

<!-- Optional. Keep only for changed visual or interactive behavior. Describe changed states, not the complete historical behavior matrix. -->

- Changed states inspected: `<list>`
- Relevant viewports/devices: `<list>`
- Evidence or residual risk: `<list>`

## Limitations

<!-- Optional. Keep only real limitations or residual risks. -->

## Integration metadata (optional)

<!-- Keep only for strict, dependent or parallel work. Routine independent PRs delete this section. Task identity above is mandatory and is not optional metadata. -->

- Batch: `<NB-YYYYMMDD-NN>`
- Base SHA: `<sha>`
- Depends on: `<none / Task numbers / PR numbers>`
- Merge phase: `<integer>`
- Owned paths: `<paths>`
- Shared files touched: `<none / explicitly allowed paths>`

## Canonical documentation

<!-- Optional. Keep only when an owned durable fact changed. Do not create a routine documentation follow-up PR. -->

- Updated: `<documents / none>`
- Reason: `<brief reason>`

## Scope confirmation

- [ ] Task number and title match the direct prompt, branch and PR title.
- [ ] Review class is accurate; every strict-risk change is marked before review.
- [ ] No unrelated dependency, architecture, asset, workflow or infrastructure change was added.
- [ ] Applicable evidence refers to the final head commit.
- [ ] Material canonical documentation is current, or no durable fact changed.
- [ ] The branch is ready for review and merge; this PR is not a development workspace.
