# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and layout/asset editing.

## Player-facing build contract

- walls and surfaces support placement, demolition and grouped undo;
- object-like entries also support movement through one runtime owner;
- the library shows object names and visual previews, never interaction verbs;
- every editable facility, resource profile, well, tavern sign and training dummy appears in the library;
- placement uses the `16 px` grid and stores a grid-aligned top-left footprint;
- visual offset and pivot do not alter occupied cells; validation uses effective colliders;
- movement preserves the grabbed point; interactions derive from current profile geometry;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like catalog entry declares `objectLike: true`, a stable `placeableOwner`, and the full lifecycle `place → move → remove → restore`.

One owner descriptor drives move hover, pickup, demolition hover and commit. Its bounds combine current visible geometry and effective collider. Grouped undo uses the same restore operation. Partial catalog support is invalid.

`FACILITY_BUILD_ORDER` covers every `FACILITY_ASSETS` entry. Cutting table, stove, serving table, juicer and lemon sack behave like furniture. An empty lemon sack stays visible but cannot give lemons.

`RESOURCE_PROFILES` drives resource entries automatically. Current profiles include `tree-planted`, `berry-bush`, logs, stones and ruby nodes. Movement preserves node state; demolition removes it and undo restores it.

Starter well, tavern sign and training dummy use the same lifecycle. A fixed world anchor must be absent from the catalog and explicitly system-only.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual offset, crop and approach directions. Mouse and `1 px` keyboard edits are supported; active editing suppresses player movement.

Collider rounding uses the live draft: remove `2 px` padding, snap to cells, restore padding. Crop keeps one visible pixel. Browser storage may hold drafts/backups; canonical profiles own geometry. Layout normalization discards stored derived interaction/pose coordinates. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- lifecycle: `src/build/placeableBuildProtocol.js`, `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeableBuildGeometry.js`;
- UI/input: `src/build/buildModeRuntime.js`, `src/build/assetAuthoringInput.js`;
- geometry: `src/build/buildWorldGeometry.js`, `src/build/assetGridPlacement.js`, `src/build/liveAssetGeometry.js`, `src/build/assetProfiles.js`;
- authoring: `src/build/editorAuthoringBootstrap.js`, `src/build/assetRuntimeConsistencyBootstrap.js`, `src/build/startingLayout.js`.

`WorldBuildCoordinator` owns previews, grouped actions and undo. Runtime owners own the entities. `WorldScene` remains composition only.

## Invariants

- footprint origins are exact grid coordinates;
- targeting reads current profile geometry;
- drag anchors do not alter footprint alignment;
- every object-like catalog entry has one full lifecycle owner;
- catalog entries name and preview objects, not gameplay actions;
- move and demolition resolve the same target;
- resource movement preserves state and demolition undo restores it;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Furniture, kitchen facilities, special world objects and resource profiles support placement, movement, demolition and grouped undo. Berry bushes, trees, logs, stones and ruby nodes are real resource-runtime placeables.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `authoring-persistence.spec.js`.
