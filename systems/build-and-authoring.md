# Build mode and developer authoring

## Purpose

Owns player construction and canonical layout/asset editing.

## Player-facing build contract

- walls, surfaces, furniture, facilities, expedition objects and plants share placement, move, demolition and grouped undo;
- build mode opens without a selected catalog asset and always shows the `16 px` cell grid;
- placeable assets store the top-left footprint cell on that grid;
- canonical, restored, new and moved objects share this normalization;
- visual offset and pivot do not change occupied cells;
- validation uses effective profile colliders;
- catalog cursor attachment is recalculated from the midpoint of the current pivot and current effective collider centre, then the footprint origin is grid-snapped;
- moving an existing object retains its grabbed point and grid-aligned footprint;
- approach markers occupy surrounding cell centres, derived from the collider's grid footprint rather than its padded edge;
- placeables store only footprint/identity data; interaction aim, approach, bed/facility presentation pose and depth derive from current profile geometry at runtime;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like entity exposed in the build catalog has one registered system owner and the complete lifecycle `place → move → remove → restore`.

The same owner target descriptor drives move hover, move pickup, demolition hover and demolition commit. Target bounds combine the current visible geometry and the current effective collider; stale authored footprints and removed derived coordinates cannot become alternate hit-test sources.

A catalog item declares `objectLike: true` and a stable `placeableOwner`. The owner must implement placement validation, target lookup, placement, movement, removal and restoration. Grouped undo calls the same restoration operation used by demolition recovery.

Resource profiles are catalog-driven placeables. Adding a new profile to `RESOURCE_PROFILES` automatically makes the entity constructible, movable and removable through the resource owner. This includes `tree-planted`, `berry-bush`, logs, stones and ruby nodes. Resource movement preserves progress/state; demolition removes that state and undo restores it.

A system-only world anchor may remain outside this contract only when it is absent from the build catalog and explicitly fixed by its owner. Partial catalog support such as place-only, move-only or remove-only is invalid.

## Developer-authoring contract

One versioned profile stores collider offsets, pivot, visual offset, crop and eight approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` arrows/`WASD`. Collider and crop use `Ctrl+Arrow` to expand and `Alt+Arrow` to shrink. Modified `WASD` remains available to browser shortcuts.

Any active edit mode owns directional input, blocks player translation, clears velocity and resets the mobile joystick.

Collider rounding uses the live draft. After removing the fixed `2 px` padding, each edge snaps to the nearest full-cell boundary and receives the padding again. The immutable pre-edit base is never substituted. One-cell and multi-cell outlines retain the span described by the draft.

Collider debug renders at `40%` of its former opacity. Crop remains inside the sprite source with one visible pixel minimum; procedural visuals reject crop. At least one approach direction remains enabled.

Browser storage may hold drafts and backups. The versioned profile owns collider, pivot and visual values. Layout normalization permanently discards legacy `usePosition`, `aimPosition`, `wakePosition` and `presentationPose`; runtime never treats them as canonical. Local dev writes checked-in defaults; successful canonical save clears browser profile and legacy collider drafts. Static hosting retains a recoverable profile draft.

Temporary staging coordinates cannot become canonical. `NEW GAME` restores the authored baseline.

## Owners

- coordinator: `src/build/worldBuildCoordinator.js`;
- universal object lifecycle: `src/build/placeableBuildProtocol.js`, `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeableBuildGeometry.js`;
- UI/input: `src/build/buildModeRuntime.js`, `src/build/assetAuthoringInput.js`;
- geometry: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`, `src/build/assetGridPlacement.js`, `src/build/liveAssetGeometry.js`;
- profiles/crop: `src/build/assetProfiles.js`, `src/build/assetProfilesDefault.js`, `src/build/assetVisualCrop.js`;
- authoring/runtime consistency: `src/build/editorAuthoringBootstrap.js`, `src/build/assetGridAuthoringBootstrap.js`, `src/build/assetRuntimeConsistencyBootstrap.js`;
- baseline: `src/build/startingLayout.js`, `src/build/startingLayoutDefault.js`.

`WorldBuildCoordinator` owns placed objects, previews, grouped actions and undo. Runtime owners handle facilities, beds/resources, wells, sign and training dummy. `WorldScene` remains composition only.

## Invariants

- horizontal and vertical wall colliders remain independent;
- explicit columns do not duplicate automatic junctions;
- footprint origins remain exact grid coordinates;
- cursor attachment and interaction read only current profile geometry;
- drag anchors affect grab behavior, not footprint alignment;
- rounding preserves the cell span described by the live draft;
- crop and approach masks are profile-wide;
- approach targets are cell-centred;
- no placeable timeline consumes stored derived coordinates;
- every catalog object-like entity has one full lifecycle owner;
- move and demolition resolve the same target descriptor;
- resource movement preserves node state and demolition undo restores it;
- authoring directional input suppresses character movement;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Construction supports placement, move, demolition and grouped undo through `WorldBuildCoordinator`. Placeable origins are grid-normalized. Catalog object-like entities use registered lifecycle owners. Resource profiles, including berry bushes, are real resource-runtime placeables rather than disconnected build-only visuals. The editor supports collider, pivot, visual offset, crop, approach directions, backup and canonical profile/layout writes.

## Not yet

Rotation, gameplay construction persistence, history, general map editing, multiplayer editing and further native expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `check:task-072`, `authoring-persistence.spec.js`.
