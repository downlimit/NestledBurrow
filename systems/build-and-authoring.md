# Build mode and developer authoring

## Purpose

This system owns player-facing construction interactions and developer-facing canonical layout/asset editing.

## Player-facing build contract

- every opening starts with no selected catalog asset, so the opening pointer cannot leak through and select a wall;
- library selects walls, surfaces, furniture, facilities, expedition objects and plants; movable training dummies and the tavern sign participate in canonical furniture persistence;
- the `Expedition` / `Походные` catalog group contains the current field-capable bed, table, toilet and a single-segment privacy screen backed by the existing wall tileset;
- the privacy screen uses ordinary wall topology, placement validation, demolition and undo; it does not introduce a separate persisted object type;
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
- the generated starting-layout module owns only the canonical default value; fallback fixtures stay in `src/build/startingLayout.js` so repeated saves cannot remove required exports;
- temporary facility staging coordinates fail closed during capture, are removed from legacy browser drafts, and are never promoted into the canonical layout;
- static GitHub Pages cannot commit the repository;
- `NEW GAME` restores the authored starting baseline, not arbitrary runtime edits.

## Owners

- world mutation and transient build-session state: `src/build/worldBuildCoordinator.js`;
- UI/input lifecycle: `src/build/buildModeRuntime.js`;
- catalog: `src/build/buildAssetCatalog.js`;
- geometry/colliders: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`;
- profiles: `src/build/assetProfiles.js`, `src/build/colliderDefaults.js`;
- authoring: `src/build/editorAuthoringRuntime.js`, `src/build/editorAuthoringBootstrap.js`, `src/build/authoringBackup.js`;
- starting baseline: `src/build/startingLayout.js`, `src/build/startingLayoutDefault.js`;
- scene registry: `src/build/worldSceneRegistry.js`.

`WorldBuildCoordinator` owns placed runtime objects, surfaces, walls, automatic junctions, previews, demolition highlighting, the active grouped action and undo history. It creates `BuildModeRuntime`, receives runtime owners and world callbacks as explicit dependencies, and routes facility, bed/resource, well/farming, tavern-sign and training-dummy mutations back to those owners. The Phaser scene is only its rendering host.

`WorldScene` constructs the coordinator, passes layout/profile/runtime adapters, exposes its `BuildModeRuntime` for the surrounding input-suppression contract, and delegates location cleanup. Starting-layout and developer-authoring owners use the coordinator public API; they do not receive its internal maps, undo stack or preview state.

## Invariants

- horizontal and vertical wall profile colliders are independent;
- explicit columns do not duplicate automatic wall junctions;
- placement uses effective collider after profile offsets;
- drag anchor affects grabbing/snap, not arbitrary visual drift;
- developer authoring and gameplay persistence remain separate;
- build orchestration remains in `WorldBuildCoordinator`; `src/main.js` may not grow beyond its architecture budget;
- expedition catalog grouping does not duplicate canonical asset IDs or create binary substitutes for missing field props.

## Current baseline

Walls, surfaces, furniture, facilities, plants, wells, the tavern sign and the training dummy preserve placement, move, demolition and grouped undo through `WorldBuildCoordinator`. The catalog exposes a dedicated expedition group using existing functional objects and one wall-backed privacy screen. Asset profiles, collider editor, drag anchor, browser backup and canonical starting layout remain in their authoring owners. Authoring persistence has an end-to-end reload/`NEW GAME` regression.

## Not yet

Rotation, gameplay persistence of construction, history/versioning, general map editor, multiplayer edits, whistle behavior and native art for additional expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `authoring-persistence.spec.js`.
