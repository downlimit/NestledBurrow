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
- beds store only canonical placement geometry; sleep pose derives from the current visual and targeting derives from the current effective collider;
- runtime construction is not gameplay-persisted.

## Developer-authoring contract

One versioned profile stores collider offsets, pivot, visual offset, crop and eight approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` arrows/`WASD`. Collider and crop use `Ctrl+Arrow` to expand and `Alt+Arrow` to shrink. Modified `WASD` remains available to browser shortcuts.

Any active edit mode owns directional input, blocks player translation, clears velocity and resets the mobile joystick.

Collider rounding uses the live draft. After removing the fixed `2 px` padding, each edge snaps to the nearest full-cell boundary and receives the padding again. The immutable pre-edit base is never substituted. One-cell and multi-cell outlines retain the span described by the draft.

Collider debug renders at `40%` of its former opacity. Crop remains inside the sprite source with one visible pixel minimum; procedural visuals reject crop. At least one approach direction remains enabled.

Browser storage may hold drafts and backups. The versioned profile is the current owner of collider, pivot and related values. Legacy standalone collider data and derived bed wake/presentation positions are discarded. Local dev writes checked-in layout/profile defaults; successful canonical save clears browser profile and legacy collider drafts. Static hosting retains a recoverable profile draft.

Temporary staging coordinates cannot become canonical. `NEW GAME` restores the authored baseline.

## Owners

- coordinator: `src/build/worldBuildCoordinator.js`;
- UI/input: `src/build/buildModeRuntime.js`, `src/build/assetAuthoringInput.js`;
- geometry: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`, `src/build/assetGridPlacement.js`;
- profiles/crop: `src/build/assetProfiles.js`, `src/build/assetProfilesDefault.js`, `src/build/assetVisualCrop.js`;
- authoring/runtime consistency: `src/build/editorAuthoringBootstrap.js`, `src/build/assetGridAuthoringBootstrap.js`, `src/build/assetRuntimeConsistencyBootstrap.js`;
- baseline: `src/build/startingLayout.js`, `src/build/startingLayoutDefault.js`.

`WorldBuildCoordinator` owns placed objects, previews, grouped actions and undo. Runtime owners handle facilities, beds/resources, wells, sign and training dummy. `WorldScene` remains composition only.

## Invariants

- horizontal and vertical wall colliders remain independent;
- explicit columns do not duplicate automatic junctions;
- footprint origins remain exact grid coordinates;
- cursor attachment reads only current profile geometry;
- drag anchors affect grab behavior, not footprint alignment;
- rounding preserves the cell span described by the live draft;
- crop and approach masks are profile-wide;
- approach targets are cell-centred;
- bed timelines do not consume stored wake, aim or presentation positions;
- authoring directional input suppresses character movement;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Construction supports placement, move, demolition and grouped undo through `WorldBuildCoordinator`. Placeable origins are grid-normalized. The editor supports collider, pivot, visual offset, crop, approach directions, backup and canonical profile/layout writes.

## Not yet

Rotation, gameplay construction persistence, history, general map editing, multiplayer editing and further native expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `authoring-persistence.spec.js`.
