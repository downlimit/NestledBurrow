# Build mode and developer authoring

## Purpose

Owns player construction, placeable lifecycle and canonical layout/asset editing.

## Player-facing build contract

- walls, surfaces and object-like placeables support placement, demolition and grouped undo;
- object-like catalog entities additionally support movement through one runtime owner;
- build mode opens with no selected asset and shows the `16 px` grid;
- placeables store a grid-aligned top-left footprint; new, restored and moved instances use the same normalization;
- visual offset and pivot do not change occupied cells; validation uses effective profile colliders;
- placement attachment is derived from the current pivot and effective collider centre;
- movement preserves the grabbed point and grid-aligned footprint;
- approach points, interaction aim and bed/facility poses derive from current profile geometry;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like catalog entity declares `objectLike: true`, a stable `placeableOwner`, and one complete owner lifecycle: `place → move → remove → restore`.

The owner supplies placement validation and one target descriptor used by move hover, pickup, demolition hover and demolition commit. Target bounds combine current visible geometry with the effective collider. Grouped undo restores through the same owner operation; partial place-only, move-only or remove-only catalog support is invalid.

`RESOURCE_PROFILES` drives resource catalog entries automatically. New profiles therefore become constructible, movable and removable through the resource owner. Current profiles include `tree-planted`, `berry-bush`, logs, stones and ruby nodes. Resource movement preserves node state; demolition removes it and undo restores it.

A world anchor may remain outside this contract only when it is absent from the catalog and explicitly fixed by its owner.

## Developer-authoring contract

One versioned profile stores collider offsets, pivot, visual offset, crop and eight approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` arrows/`WASD`; collider and crop use `Ctrl+Arrow` to expand and `Alt+Arrow` to shrink. An active edit mode owns directional input, blocks player movement, clears velocity and resets the mobile joystick.

Collider rounding uses the live draft: remove `2 px` padding, snap edges to full cells, then restore padding. Crop retains at least one visible source pixel; procedural visuals reject crop. At least one approach direction stays enabled.

Browser storage may hold drafts/backups. Canonical profiles own geometry. Layout normalization discards legacy `usePosition`, `aimPosition`, `wakePosition` and `presentationPose`. Successful local save writes checked-in defaults and clears browser/legacy duplicates. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- placeables: `src/build/placeableBuildProtocol.js`, `placeableBuildContract.js`, `placeableBuildOwners.js`, `placeableBuildGeometry.js`;
- UI/input: `src/build/buildModeRuntime.js`, `assetAuthoringInput.js`;
- geometry/profiles: `src/build/buildWorldGeometry.js`, `assetGridPlacement.js`, `liveAssetGeometry.js`, `assetProfiles.js`;
- authoring/baseline: `src/build/editorAuthoringBootstrap.js`, `assetRuntimeConsistencyBootstrap.js`, `startingLayout.js`.

`WorldBuildCoordinator` owns previews, grouped actions and undo. Runtime owners own beds/resources, facilities and wells. `WorldScene` remains composition only.

## Invariants

- wall directions and automatic junctions remain independent;
- footprint origins are exact grid coordinates;
- cursor attachment, targeting and interactions read current profile geometry;
- drag anchors affect grabbing, not footprint alignment;
- no placeable timeline consumes stored derived coordinates;
- every object-like catalog entity has one full lifecycle owner;
- move and demolition resolve the same target descriptor;
- resource movement preserves node state and demolition undo restores it;
- authoring input suppresses character movement;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Construction supports placement, movement, demolition and grouped undo. Resource profiles, including berry bushes, create real resource-runtime placeables. The editor supports collider, pivot, visual offset, crop, approach directions, backups and canonical writes.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `check:task-072`, `authoring-persistence.spec.js`.
