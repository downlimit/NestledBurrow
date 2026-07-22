# Integration metadata

- Batch: `NB-20260722-01`
- Task: `A`
- Base SHA: `ba8234f2c88cfbb54bbde339cfbb4721ba9a9c44`
- Depends on: `none`
- Merge phase: `1`
- Owned paths: `src/characterVisualProfiles.js`, `src/visualConfig.js`, `src/actorProfiles.js`, `src/character.js`, `src/characterVisual.js`, `src/main.js`, `src/npcConfig.js`, `scripts/check-visual.mjs`, `scripts/check-character.mjs`, `LIBRARY.md`
- Shared files touched: `.github/pull_request_template.md`

# Review class

- [ ] `docs`
- [x] `code`
- [x] `visual/runtime`

## Scope

Give player, home NPC, and street NPC independent visual profiles while preserving existing movement roles, patrol definitions, dialogue/quest lifecycle, and idle/walk cadence.

## Git lifecycle

- Base branch: `main`
- Work branch: `work/NB-20260722-01/npc-visual-profiles`
- Final head SHA: `9f9226c294f5388a1f6c0be97f511372ec01fbd3`
- Lifecycle: `ephemeral`
- PR opened once after implementation and validation: `yes`
- Additional remote branches created: `none`

## Validation

- `git fetch --prune` — `PASS`
- preflight base/files/SHA/dimensions/manifest mapping — `PASS`
- `npm ci` — `NOT RUN TO COMPLETION: npm registry access hung after engine/proxy warnings; no repository dependency changes made`
- `python -m pip install -r requirements-dev.txt` — `NOT RUN TO COMPLETION: package index tunnel returned 403 for Pillow`
- `npm run check:character` — `PASS`
- `npm run check:visual` — `PASS`
- `npm run check` — `NOT RUN TO COMPLETION: i18next-cli unavailable because npm ci could not complete`
- `npx playwright install --with-deps chromium` — `NOT RUN TO COMPLETION: npm registry returned 403 for playwright package lookup`
- `npm run check:e2e` — `NOT RUN TO COMPLETION: playwright binary unavailable because dependency installation could not complete`
- `npm run build` — `NOT RUN TO COMPLETION: vite binary unavailable because dependency installation could not complete`
- `npm run dev -- --host 0.0.0.0` — `NOT RUN TO COMPLETION: vite binary unavailable because dependency installation could not complete`

## Runtime inspection

- States inspected: `static/runtime wiring self-review only; live game inspection blocked because vite could not run`
- Viewports/devices inspected: `not inspected; dev server unavailable`
- Preview or screenshot artifacts inspected: `none; dev server unavailable`
- User-approved asset/frame choices: `pre-imported committed manifest and PNG contract from prompt; no binary files changed`

## Limitations

- Network/package-index access in this environment blocked full dependency installation; remaining browser/build checks depend on completing dependency installation.

## Canonical documentation

- Updated: `LIBRARY.md`
- Reason: Added `src/characterVisualProfiles.js` as a canonical runtime source file.

## Scope confirmation

- [x] No unrelated dependency, fallback package, architecture, asset, workflow or infrastructure change was added.
- [x] Changes stay within Owned paths and explicitly allowed Shared files.
- [x] Evidence refers to the final head commit.
- [x] Canonical documentation owned by this change is current, or no canonical document was affected.
- [x] The branch is ready for strict Integrator review and merge; this PR is not a development workspace.
