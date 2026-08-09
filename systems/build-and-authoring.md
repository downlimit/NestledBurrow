# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and asset/layout editing.

## Player-facing build contract

- walls/surfaces support placement, demolition and grouped undo; objects also move through one owner;
- the library shows object names/previews and contains all editable catalog objects;
- placement uses the `16 px` grid and one canonical placement position;
- the cursor anchor is the midpoint between the current pivot and current effective collider centre;
- preview and commit use the same position, pivot, visual offset and effective collider;
- construction is not gameplay-persisted.

## Universal placeable lifecycle

Every catalog object declares one `placeableOwner` and `place → move → remove → restore`; one descriptor drives hover, commit and grouped undo.
Resource profiles such as `berry-bush` use that lifecycle; authoring selection keeps the cursor anchor at the midpoint between the current pivot and current effective collider centre; preview and commit share the same pose.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual/crop/interaction offsets, approach directions, render policy and optional timeline target plus enter/exit duration. Mouse and `1 px` arrow edits suppress movement.

`assetAuthoringRegistry` validates one typed instance contract and feeds the same eight modes everywhere: collider, pivot, visual offset, crop, approach, interaction point, render and timeline. Visible sprite bounds select the instance even when its collider is elsewhere. Point markers support drag/arrows; approach keeps a `3×3` grid.

Render policy is `below-character`, `pivot-depth` or `above-character`. Enabled timeline data overrides canonical presentation target/durations.

Fixed-world stairs and gliders use ordinary move authoring while their runtime owner synchronizes interaction and presentation. They stay outside the construction catalog and cannot be created or demolished.

Fixed-world placement and `collisionEnabled` are per-instance authoring data. Collision OFF preserves selection/profile editing and interaction while removing physical blocking. Move synchronizes sprite, collider, interaction and depth without changing destination safe-spawn. Grid and fixed-world move are capability/instance-driven without full home construction.

Canon export commits the collider draft and downloads `nestledburrow-authoring-canon.json` with layout, colliders, profiles and fixed-world state. Crop keeps one visible pixel; browser storage may hold drafts/backups; `NEW GAME` restores baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- lifecycle/placement: `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeablePlacementPose.js`;
- profiles/input: `src/build/assetProfiles.js`, `src/build/assetAuthoringInput.js`;
- registry/authoring/export: `src/build/assetAuthoringRegistry.js`, `src/build/universalPlaceableAuthoring.js`, `src/build/fixedWorldAuthoringState.js`, `src/build/authoringBackup.js`;
- transition bridge: `src/build/worldTransitionAuthoringBridge.js`.

`WorldBuildCoordinator` owns build actions. Runtime owners own entities. `WorldScene` remains composition only.

## Invariants

- preview and commit use one exact placement pose;
- cursor anchor uses live pivot/effective collider midpoint;
- targeting uses live collider, interaction offset and approach directions;
- one typed registry and one mode list cover live placeables and fixed transitions;
- sprite selection activates collider editing without collider pixel hunting;
- pivot, interaction and timeline points support `1 px` arrow nudges;
- render policy and timeline data survive profile export/load;
- fixed transitions stay outside the build-library lifecycle;
- fixed-world placement and collision toggles are per instance and survive canonical export/load;
- collision OFF preserves selection, interaction and edited collider shape while removing physical blocking;
- fixed-world/grid availability never depends on a literal location ID;
- every catalog object has one lifecycle owner; move/demolition resolve the same target;
- canon export includes live layout, colliders and all profiles;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Furniture, facilities, resources and special objects use the full village construction lifecycle. Burrow/Nest stairs, the Nest Atoll entrance and Atoll exits share fixed-world move/collider/collision-toggle authoring across locations; only the village exposes the construction catalog.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `check:task-074`, `check:task-085`, `authoring-persistence.spec.js`.
