# Build mode and developer authoring

## Purpose

This system owns player-facing construction interactions and developer-facing canonical layout/asset editing.

## Player-facing build contract

- every opening starts with no selected catalog asset, so the opening pointer cannot leak through and select a wall;
- library selects walls, surfaces, furniture, facilities and plants; movable training dummies and the tavern sign participate in canonical furniture persistence;
- placement, move and demolition use the same world geometry;
- existing objects can be dragged without jumping their grabbed point under the cursor;
- validation uses effective profile colliders;
- grouped undo reverses the last build action;
- runtime construction is not yet a gameplay save.

## Developer-authoring contract

- asset profiles store collider offsets and drag/pivot anchor data per asset family;
- collider and layout drafts can live in browser storage;
- a versioned backup moves drafts between browsers;
- local dev endpoints may write checked-in defaults;
- the generated starting-layout module owns only the canonical default value; fallback fixtures stay in `startingLayout.js` so repeated saves cannot remove required exports;
- temporary facility staging coordinates fail closed during capture, are removed from legacy browser drafts, and are never promoted into the canonical layout;
- static GitHub Pages cannot commit the repository;
- `NEW GAME` restores the authored starting baseline, not arbitrary runtime edits.

## Owners

- world mutation and transient build-session state: `worldBuildCoordinator.js`;
- UI/input lifecycle: `buildModeRuntime.js`;
- catalog: `buildAssetCatalog.js`;
- geometry/colliders: `buildWorldGeometry.js`, `colliderResize.js`;
- profiles: `assetProfiles.js`, `colliderDefaults.js`;
- authoring: `editorAuthoringRuntime.js`, `editorAuthoringBootstrap.js`, `authoringBackup.js`;
- starting baseline: `startingLayout.js`, `startingLayoutDefault.js`;
- scene registry: `worldSceneRegistry.js`.

`WorldBuildCoordinator` owns placed runtime objects, surfaces, walls, automatic junctions, previews, demolition highlighting, the active grouped action and undo history. It creates `BuildModeRuntime`, receives runtime owners and world callbacks as explicit dependencies, and routes facility, bed/resource, well/farming, tavern-sign and training-dummy mutations back to those owners. The Phaser scene is only its rendering host.

`WorldScene` constructs the coordinator, passes layout/profile/runtime adapters, exposes its `BuildModeRuntime` for the surrounding input-suppression contract, and delegates location cleanup. Starting-layout and developer-authoring owners use the coordinator public API; they do not receive its internal maps, undo stack or preview state.

## Invariants

- horizontal and vertical wall profile colliders are independent;
- explicit columns do not duplicate automatic wall junctions;
- placement uses effective collider after profile offsets;
- drag anchor affects grabbing/snap, not arbitrary visual drift;
- developer authoring and gameplay persistence remain separate;
- build orchestration remains in `WorldBuildCoordinator`; `src/main.js` may not grow beyond its architecture budget.

## Current baseline

Walls, surfaces, furniture, facilities, plants, wells, the tavern sign and the training dummy preserve placement, move, demolition and grouped undo through `WorldBuildCoordinator`. Asset profiles, collider editor, drag anchor, browser backup and canonical starting layout remain in their authoring owners. Authoring persistence has an end-to-end reload/`NEW GAME` regression.

## Not yet

Rotation, gameplay persistence of construction, history/versioning, general map editor and multiplayer edits.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `authoring-persistence.spec.js`.
