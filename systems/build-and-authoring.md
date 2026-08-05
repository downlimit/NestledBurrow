# Build mode and developer authoring

## Purpose

Owns player construction, placeable lifecycle and canonical layout/asset editing.

## Player-facing build contract

- walls, surfaces and object-like placeables support placement, demolition and grouped undo;
- object-like catalog entities additionally support movement through one runtime owner;
- the library shows object names and current visual previews, never interaction verbs such as chop, mine or gather;
- every editable facility, resource profile, well, tavern sign and training dummy is represented in the library;
- build mode opens with no selection and uses the `16 px` grid;
- placeables store a grid-aligned top-left footprint; new, restored and moved instances use the same normalization;
- visual offset and pivot do not change occupied cells; validation uses effective profile colliders;
- movement preserves the grabbed point; interaction aim and poses derive from current profile geometry;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like catalog entry declares `objectLike: true`, a stable `placeableOwner`, and one complete lifecycle: `place → move → remove → restore`.

The owner supplies placement validation and one target descriptor for move hover, pickup, demolition hover and commit. Its bounds combine current visible geometry with the effective collider. Grouped undo uses the same restore operation; partial catalog support is invalid.

`FACILITY_BUILD_ORDER` covers every `FACILITY_ASSETS` entry. Kitchen objects are ordinary placeables: cutting table, stove, serving table, juicer and lemon sack can be created, moved, removed and restored. An empty lemon sack remains visible furniture while its take-lemons interaction is disabled.

`RESOURCE_PROFILES` drives resource entries automatically. New profiles become constructible, movable and removable through the resource owner. Current profiles include `tree-planted`, `berry-bush`, logs, stones and ruby nodes. Movement preserves node state; demolition removes it and undo restores it.

The starter well, tavern sign and training dummy use the same library and lifecycle. A world anchor may remain fixed only when absent from the catalog and explicitly system-only.

## Developer-authoring contract

One versioned profile stores collider offsets, pivot, visual offset, crop and eight approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` arrows/`WASD`; collider and crop use `Ctrl+Arrow` to expand and `Alt+Arrow` to shrink. Active editing owns directional input and suppresses player movement.

Collider rounding uses the live draft: remove `2 px` padding, snap edges to full cells, then restore padding. Crop keeps one visible source pixel; procedural visuals reject crop. At least one approach direction stays enabled.

Browser storage may hold drafts and backups. Canonical profiles own geometry. Layout normalization discards legacy `usePosition`, `aimPosition`, `wakePosition` and `presentationPose`. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- placeables: `src/build/placeableBuildProtocol.js`, `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeableBuildGeometry.js`;
- UI/input: `src/build/buildModeRuntime.js`, `src/build/assetAuthoringInput.js`;
- geometry/profiles: `src/build/buildWorldGeometry.js`, `src/build/assetGridPlacement.js`, `src/build/liveAssetGeometry.js`, `src/build/assetProfiles.js`;
- authoring/baseline: `src/build/editorAuthoringBootstrap.js`, `src/build/assetRuntimeConsistencyBootstrap.js`, `src/build/startingLayout.js`.

`WorldBuildCoordinator` owns previews, grouped actions and undo. Runtime owners own beds/resources, facilities, wells, tavern sign and training dummy. `WorldScene` remains composition only.

## Invariants

- footprint origins are exact grid coordinates;
- cursor attachment, targeting and interactions read current profile geometry;
- drag anchors affect grabbing, not footprint alignment;
- no placeable timeline consumes stored derived coordinates;
- every object-like catalog entity has one full lifecycle owner;
- every catalog entry names and previews the object rather than its gameplay action;
- move and demolition resolve the same target descriptor;
- resource movement preserves node state and demolition undo restores it;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Construction supports placement, movement, demolition and grouped undo for furniture, kitchen facilities, special world objects and resource profiles. Berry bushes, trees, logs, stones and ruby nodes are real resource-runtime placeables. The editor supports collider, pivot, visual offset, crop, approach directions, backups and canonical writes.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `check:task-072`, `authoring-persistence.spec.js`.
