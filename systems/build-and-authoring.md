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

- one versioned asset profile stores collider offsets, drag/pivot anchor, visual offset, sprite crop insets and the eight-direction interaction-approach mask per asset family;
- collider, pivot and visual offset remain mouse-editable; arrows move the active geometry by `1 px`;
- collider and crop rectangles use the same keyboard contract: arrows translate, `Ctrl+Arrow` expands toward the arrow, `Alt+Arrow` shrinks from the opposite edge toward the arrow;
- collider grid rounding chooses the nearest whole-cell span from the reference size and centre, then applies the same fixed perimeter padding to one-cell and multi-cell spans;
- the crop rectangle is clamped to the sprite source and keeps at least one visible pixel; procedural graphics without a sprite source reject crop editing explicitly;
- at least one interaction approach direction remains enabled; disabling interaction entirely is a separate gameplay decision;
- collider and layout drafts can live in browser storage;
- a versioned backup moves drafts between browsers;
- local dev endpoints write checked-in starting-layout and asset-profile defaults;
- a successful canonical asset-profile write clears both the current browser profile draft and legacy collider overrides, preventing stale or accumulated offsets from being reapplied after reload;
- the generated starting-layout module owns only the canonical default value; fallback fixtures stay in `src/build/startingLayout.js` so repeated saves cannot remove required exports;
- temporary facility staging coordinates fail closed during capture, are removed from legacy browser drafts, and are never promoted into the canonical layout;
- static GitHub Pages cannot commit the repository and keeps a recoverable browser draft instead;
- `NEW GAME` restores the authored starting baseline, not arbitrary runtime edits.

## Owners

- world mutation and transient build-session state: `src/build/worldBuildCoordinator.js`;
- UI/input lifecycle: `src/build/buildModeRuntime.js`;
- catalog: `src/build/buildAssetCatalog.js`;
- geometry/colliders: `src/build/buildWorldGeometry.js`, `src/build/colliderResize.js`;
- profiles: `src/build/assetProfiles.js`, `src/build/assetProfilesDefault.js`, `src/build/colliderDefaults.js`;
- sprite crop adapter: `src/build/assetVisualCrop.js`;
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
- crop and approach-direction edits are profile-wide and apply to every live instance of that profile;
- authoring arrow input suppresses character movement while any asset edit mode is active;
- developer authoring and gameplay persistence remain separate;
- build orchestration remains in `WorldBuildCoordinator`; `src/main.js` may not grow beyond its architecture budget;
- expedition catalog grouping does not duplicate canonical asset IDs or create binary substitutes for missing field props.

## Current baseline

Walls, surfaces, furniture, facilities, plants, wells, the tavern sign and the training dummy preserve placement, move, demolition and grouped undo through `WorldBuildCoordinator`. The catalog exposes a dedicated expedition group using existing functional objects and one wall-backed privacy screen. Asset profiles, collider/pivot/visual/crop editors, approach-direction masks, browser backup and canonical starting layout remain in their authoring owners. Authoring persistence has an end-to-end reload/`NEW GAME` regression.

## Not yet

Rotation, gameplay persistence of construction, history/versioning, general map editor, multiplayer edits, whistle behavior and native art for additional expedition props.

## Evidence

`check:build-mode`, `check:authoring`, `check:task-044`, `check:task-062`, `check:task-068`, `check:task-071`, `authoring-persistence.spec.js`.
