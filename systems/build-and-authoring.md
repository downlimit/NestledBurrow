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

Every object-like catalog entry declares `objectLike: true`, one `placeableOwner`, and `place → move → remove → restore`.

One owner descriptor drives move/demolition hover and commit. Bounds combine current visible geometry and effective collider. Grouped undo uses the same restore operation. `FACILITY_BUILD_ORDER` covers all `FACILITY_ASSETS`; `RESOURCE_PROFILES` supplies trees, `berry-bush`, logs, stones and ruby nodes. Wells, tavern signs and training dummies use the same contract.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual offset, crop, interaction offset and approach directions. Mouse and `1 px` keyboard edits are supported; active point editing suppresses player movement.

Pivot, visual offset and interaction offset are profile-space vectors and never rewrite world placement. The interaction marker is the current effective collider centre plus interaction offset. Visual reset preserves the current pivot and restores the canonical visual-to-pivot relation.

Editing pivot or collider immediately changes the build cursor anchor; no cached anchor may override the live midpoint. Authoring selection covers every live placeable profile and fixed world-transition profiles. A fixed transition may expose the same authoring panel in a location with gameplay build mode disabled, but it does not become constructible, movable or demolishable.

`Сохранить и выгрузить канон объектов` commits the current collider draft and downloads `nestledburrow-authoring-canon.json` with live layout, collider overrides and complete asset profiles. Collider rounding uses the live draft; crop keeps one visible pixel. Browser storage may hold drafts/backups. `NEW GAME` restores the authored baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- lifecycle: `src/build/placeableBuildProtocol.js`, `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`;
- placement: `src/build/placeablePlacementPose.js`, `src/build/buildWorldGeometry.js`;
- profiles/input: `src/build/assetProfiles.js`, `src/build/assetProfileRelations.js`, `src/build/assetAuthoringInput.js`;
- authoring/export: `src/build/universalPlaceableAuthoring.js`, `src/build/authoringCanonExport.js`, `src/build/authoringBackup.js`, `src/build/assetRuntimeConsistencyBootstrap.js`;
- transition bridge: `src/build/worldTransitionAuthoringBridge.js`.

`WorldBuildCoordinator` owns build actions. Runtime owners own entities. `WorldScene` remains composition only.

## Invariants

- preview and commit use one exact placement pose;
- cursor anchor equals the midpoint between live pivot and effective collider centre;
- targeting reads current collider, interaction offset and approach directions;
- pivot, visual offset and interaction offset never become world coordinates;
- authoring selection covers live placeables and fixed transitions;
- fixed transitions stay outside the build-library lifecycle;
- every object-like catalog entry has one full lifecycle owner;
- move and demolition resolve the same target;
- resource movement preserves state and demolition undo restores it;
- canon export includes live layout, colliders and all profiles;
- authoring remains separate from gameplay persistence;
- build orchestration remains outside `src/main.js`.

## Current baseline

Furniture, facilities, resources, special objects and the Burrow/Nest stairs share collider/pivot/visual/interaction authoring profiles. Construction placement/movement/demolition remains limited to build-library objects.

## Not yet

Rotation, gameplay construction persistence, history, general map editing and multiplayer editing.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `check:task-074`, `authoring-persistence.spec.js`.
