# Build mode and developer authoring

## Purpose

Owns player-facing construction and developer-facing canonical layout/asset editing.

## Player-facing build contract

- walls, surfaces, furniture, facilities, expedition objects and plants share placement, move, demolition and grouped undo;
- opening build mode starts without a selected catalog asset;
- placeable assets use a Sims-style cell contract: stored placement is the top-left footprint cell on the `16 px` grid;
- canonical objects, browser drafts, newly placed objects and moved objects use the same placement normalization;
- visual offset and pivot never change occupied cells or repair invalid placement;
- placement validation uses effective profile colliders;
- dragged objects keep their grabbed point while the resulting footprint remains grid-aligned;
- runtime construction is not yet gameplay-persisted.

## Developer-authoring contract

One versioned profile stores collider offsets, pivot, visual offset, crop insets and eight interaction-approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` keyboard movement. Unmodified arrows and `WASD` are equivalent. Collider and crop use `Ctrl+Arrow` to expand and `Alt+Arrow` to shrink from the opposite edge. Modified `WASD` is not captured because browser shortcuts are unsafe and inconsistent.

Any active edit mode owns directional input, suppresses player translation, clears current velocity and resets the mobile joystick.

Collider rounding uses the selected asset's canonical footprint, aligns it to the nearest whole-cell span and applies `2 px` perimeter padding. A one-cell bed becomes one centred padded cell; multi-cell assets preserve the same padding.

The collider debug layer renders at `40%` of its former opacity. Crop stays inside the sprite source with at least one visible pixel. Procedural visuals reject crop editing. Direction masks keep at least one of eight directions enabled.

Browser storage may hold drafts and backups. Local dev endpoints write checked-in starting-layout and profile defaults. Successful canonical profile save clears current profile drafts and legacy collider overrides. Static hosting retains a recoverable browser draft.

The generated starting-layout module owns the canonical default. Temporary staging coordinates fail closed during capture and never become canonical. `NEW GAME` restores the authored baseline.

## Owners

- coordinator/state: `src/build/worldBuildCoordinator.js`;
- build UI/input: `src/build/buildModeRuntime.js`, `src/build/assetAuthoringInput.js`;
- geometry: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`, `src/build/assetGridPlacement.js`;
- profiles/crop: `src/build/assetProfiles.js`, `src/build/assetProfilesDefault.js`, `src/build/assetVisualCrop.js`;
- authoring: `src/build/editorAuthoringRuntime.js`, `src/build/editorAuthoringBootstrap.js`, `src/build/assetGridAuthoringBootstrap.js`;
- baseline: `src/build/startingLayout.js`, `src/build/startingLayoutDefault.js`.

`WorldBuildCoordinator` owns placed objects, previews, highlights, grouped actions and undo. Runtime owners handle facilities, beds/resources, wells, the tavern sign and training dummy. `WorldScene` remains composition only.

## Invariants

- horizontal and vertical wall colliders remain independent;
- explicit columns do not duplicate automatic junctions;
- placeable footprint origins remain exact grid coordinates;
- drag anchors affect grab behavior, not footprint alignment;
- crop and approach masks are profile-wide across live instances;
- authoring directional input suppresses character movement;
- developer authoring stays separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Construction supports placement, move, demolition and grouped undo through `WorldBuildCoordinator`. Placeable origins are normalized to the grid. The editor supports collider, pivot, visual offset, crop, approach directions, browser backup and canonical profile/layout writes.

## Not yet

Rotation, gameplay persistence of construction, history/versioning, a general map editor, multiplayer edits and native art for further expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `authoring-persistence.spec.js`.
