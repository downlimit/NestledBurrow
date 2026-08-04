# Build mode and developer authoring

## Purpose

Owns player-facing construction and developer-facing canonical layout/asset editing.

## Player-facing build contract

- each opening starts without a selected catalog asset, preventing pointer leak-through;
- walls, surfaces, furniture, facilities, expedition objects and plants share placement, move, demolition and grouped undo;
- movable training dummies and the tavern sign use canonical furniture persistence;
- the expedition group uses existing functional bed, table, toilet and a wall-backed privacy screen;
- placement and validation use effective profile colliders;
- dragged objects retain their grabbed point;
- runtime construction is not yet gameplay-persisted.

## Developer-authoring contract

One versioned asset profile stores per family:

- collider offsets;
- drag/pivot anchor;
- visual offset;
- sprite crop insets;
- enabled interaction-approach directions.

Collider, pivot and visual offset support mouse editing and `1 px` arrow movement. Collider and crop rectangles share this keyboard contract: arrows translate, `Ctrl+Arrow` expands toward the arrow, `Alt+Arrow` shrinks from the opposite edge toward the arrow.

Collider rounding selects the nearest whole-cell span from reference size and centre, then applies fixed perimeter padding. The same padding applies to one-cell and multi-cell spans.

Crop stays inside the sprite source with at least one visible pixel. Procedural graphics without a sprite source reject crop editing. Direction masks use the eight surrounding classes and keep at least one enabled; disabling interaction entirely is a separate gameplay decision.

Browser storage may hold drafts and versioned backups. Local dev endpoints write checked-in starting-layout and asset-profile defaults. Successful canonical profile save clears current profile drafts and legacy collider overrides, preventing stale offsets from being reapplied. Static hosting keeps a recoverable browser draft because it cannot write the repository.

The generated starting-layout module owns only the canonical default. Fallback fixtures stay in `src/build/startingLayout.js`. Temporary facility staging coordinates fail closed during capture, are removed from legacy drafts and never become canonical. `NEW GAME` restores the authored starting baseline.

## Owners

- mutation/session state: `src/build/worldBuildCoordinator.js`;
- UI/input: `src/build/buildModeRuntime.js`;
- catalog: `src/build/buildAssetCatalog.js`;
- geometry: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`;
- profiles: `src/build/assetProfiles.js`, `src/build/assetProfilesDefault.js`, `src/build/colliderDefaults.js`;
- crop adapter: `src/build/assetVisualCrop.js`;
- authoring: `src/build/editorAuthoringRuntime.js`, `src/build/editorAuthoringBootstrap.js`, `src/build/authoringBackup.js`;
- starting baseline: `src/build/startingLayout.js`, `src/build/startingLayoutDefault.js`;
- scene registry: `src/build/worldSceneRegistry.js`.

`WorldBuildCoordinator` owns placed objects, surfaces, walls, junctions, previews, highlights, grouped actions and undo. It creates `BuildModeRuntime`, receives runtime owners and routes facility, bed/resource, well/farming, tavern-sign and training-dummy mutations to those owners. Phaser remains the rendering host.

`WorldScene` constructs the coordinator, passes layouts, profiles and adapters, exposes build mode for input suppression and delegates location cleanup. Authoring and starting-layout code use public coordinator methods only.

## Invariants

- horizontal and vertical wall colliders remain independent;
- explicit columns do not duplicate automatic junctions;
- placement uses the effective collider;
- drag anchor controls grab/snap, not arbitrary visual drift;
- crop and approach masks are profile-wide across live instances;
- authoring arrow input suppresses character movement;
- developer authoring stays separate from gameplay persistence;
- build orchestration remains outside `src/main.js`;
- expedition grouping creates no duplicate IDs or binary substitutes.

## Current baseline

Walls, surfaces, furniture, facilities, plants, wells, the tavern sign and training dummy support placement, move, demolition and grouped undo through `WorldBuildCoordinator`. The editor supports collider, pivot, visual offset, crop and approach-direction profiles, browser backup, canonical profile writes and canonical starting layout.

## Not yet

Rotation, gameplay persistence of construction, history/versioning, a general map editor, multiplayer edits, whistle behavior and native art for further expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `authoring-persistence.spec.js`.
