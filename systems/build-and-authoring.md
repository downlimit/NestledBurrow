# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and asset/layout editing.

## Player-facing build contract

- walls and surfaces support placement, demolition and grouped undo;
- object-like entries additionally support movement through one owner;
- the library shows object names and previews, never interaction verbs;
- all editable facilities, resources, wells, tavern signs and training dummies appear in the library;
- placement uses the `16 px` grid and one canonical placement position;
- the cursor anchor is the midpoint between the current pivot and current effective collider centre;
- preview and commit use the same position, pivot, visual offset and effective collider;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like catalog entry declares one `placeableOwner` and `place → move → remove → restore`. The same descriptor drives hover, commit and grouped undo from visible geometry plus effective collider.

Catalog owners cover facilities, `berry-bush`, other resources, wells, signs and training dummies.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual/crop and interaction offsets plus approach directions. Mouse and `1 px` keyboard edits are supported; active editing suppresses movement. These profile-space values never rewrite placement; the interaction marker uses effective collider centre plus offset.

Editing pivot or collider immediately changes the build cursor anchor; no cached anchor may override the live midpoint. Authoring selection covers every live placeable profile and fixed-world transition instance. Fixed-world stairs and gliders use the ordinary move workflow in every location while their runtime owner keeps lifecycle, interaction and presentation synchronized. They never enter the construction catalog and cannot be created or demolished.

Fixed-world placement and `collisionEnabled` are per-instance authoring data. Collision OFF preserves selection/profile editing and interaction while removing physical blocking. Move synchronizes sprite, collider, interaction and depth without changing destination safe-spawn. Grid and fixed-world move are capability/instance-driven without full home construction.

`Сохранить и выгрузить канон объектов` commits the current collider draft and downloads `nestledburrow-authoring-canon.json` with live layout, collider overrides, complete asset profiles and fixed-world instance state. Collider rounding uses the live draft; crop keeps one visible pixel. Browser storage may hold drafts/backups. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- lifecycle/placement: `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeablePlacementPose.js`;
- profiles/input: `src/build/assetProfiles.js`, `src/build/assetAuthoringInput.js`;
- authoring/export: `src/build/universalPlaceableAuthoring.js`, `src/build/fixedWorldAuthoringState.js`, `src/build/authoringBackup.js`;
- transition bridge: `src/build/worldTransitionAuthoringBridge.js`.

`WorldBuildCoordinator` owns build actions. Runtime owners own entities. `WorldScene` remains composition only.

## Invariants

- preview and commit use one exact placement pose;
- cursor anchor equals the midpoint between live pivot and effective collider centre;
- targeting reads current collider, interaction offset and approach directions;
- pivot, visual offset and interaction offset never become world coordinates;
- authoring selection covers live placeables and fixed transitions;
- fixed transitions stay outside the build-library lifecycle;
- fixed-world placement and collision toggles are per instance and survive canonical export/load;
- collision OFF preserves selection, interaction and edited collider shape while removing physical blocking;
- fixed-world/grid availability never depends on a literal location ID;
- every object-like catalog entry has one full lifecycle owner;
- move and demolition resolve the same target;
- resource movement preserves state and demolition undo restores it;
- canon export includes live layout, colliders and all profiles;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Furniture, facilities, resources and special objects use the full village construction lifecycle. Burrow/Nest stairs, the Nest Atoll entrance and Atoll exits share fixed-world move/collider/collision-toggle authoring across locations; only the village exposes the construction catalog.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `check:task-074`, `check:task-085`, `authoring-persistence.spec.js`.
