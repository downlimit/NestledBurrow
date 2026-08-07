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
- the committed object appears on the exact preview pixels;
- runtime construction is not gameplay-persisted.

## Universal placeable lifecycle

Every object-like catalog entry declares `objectLike: true`, one `placeableOwner`, and `place → move → remove → restore`.

One owner descriptor drives move/demolition hover and commit. Bounds combine current visible geometry and effective collider. Grouped undo uses the same restore operation. Partial catalog support is invalid.

`FACILITY_BUILD_ORDER` covers all `FACILITY_ASSETS`. `RESOURCE_PROFILES` automatically supplies trees, `berry-bush`, logs, stones and ruby nodes. Resource movement preserves state; demolition removes it and undo restores it. Wells, tavern signs and training dummies follow the same contract.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual offset, crop, interaction point offset and approach directions. Mouse and `1 px` keyboard edits are supported; active editing suppresses player movement.

Pivot, visual offset and interaction offset are asset/profile-space vectors. Moving any of them never rewrites world placement. The interaction marker is resolved from the current effective collider centre plus the authored interaction offset, so collider edits and point edits stay independent and immediately affect live targeting. Visual reset preserves the current pivot and restores the canonical visual-to-pivot relation; it never reads layout, footprint-origin or legacy world coordinates.

Editing either the pivot or collider immediately changes the build cursor anchor because that anchor is always recomputed from their current values. No cached or default anchor may override the live midpoint.

Authoring selection covers every live placeable profile plus fixed world-transition visuals. Fixed transitions are not added to the construction library and do not gain `place → move → remove`; they reuse the same profile editor for collider, pivot, visual offset, crop, interaction point and approach directions. A location that contains such a transition may mount the developer authoring panel even when gameplay build mode is disabled.

`Сохранить и выгрузить канон объектов` commits the current collider draft and downloads `nestledburrow-authoring-canon.json`. It contains the live starting layout, collider overrides and every complete asset profile for updating checked-in defaults.

Collider rounding uses the live draft: remove `2 px` padding, snap to cells, restore padding. Crop keeps one visible pixel. Browser storage may hold drafts/backups. Layout normalization discards derived interaction/pose coordinates. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- lifecycle: `src/build/placeableBuildProtocol.js`, `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeableBuildGeometry.js`;
- placement: `src/build/placeablePlacementPose.js`, `src/build/buildWorldGeometry.js`;
- profiles/input: `src/build/assetProfiles.js`, `src/build/assetProfileRelations.js`, `src/build/assetAuthoringInput.js`;
- authoring/export: `src/build/universalPlaceableAuthoring.js`, `src/build/authoringCanonExport.js`, `src/build/authoringBackup.js`, `src/build/assetRuntimeConsistencyBootstrap.js`;
- fixed transition authoring bridge: `src/build/worldTransitionAuthoringBridge.js`.

`WorldBuildCoordinator` owns previews, grouped actions and undo. Runtime owners own entities. `WorldScene` remains composition only.

## Invariants

- preview and commit use one exact placement pose;
- cursor anchor equals the midpoint between live pivot and live effective collider centre;
- changing pivot or collider changes the cursor anchor without cached legacy values;
- targeting reads current profile geometry and current interaction-point offset;
- pivot, visual offset and interaction offset never become world coordinates;
- authoring selection covers every live placeable profile and fixed transition profile;
- fixed transitions may be authored without becoming build-library placeables;
- every object-like catalog entry has one full lifecycle owner;
- move and demolition resolve the same target;
- resource movement preserves state and demolition undo restores it;
- canon export includes live layout, colliders and all profiles;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Furniture, kitchen facilities, special objects, resources and the paired Burrow/Nest transition stairs support the shared collider/pivot/visual/interaction authoring profile. Construction placement/movement/demolition remains limited to build-library placeables.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `check:task-074`, `authoring-persistence.spec.js`.
