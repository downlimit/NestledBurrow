# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and asset/layout editing.

## Player-facing build contract

- walls/surfaces support placement, demolition and grouped undo; objects move through one owner;
- `BUILD / TEST` separates construction from prototype simulation; TEST never starts placement, move or demolition;
- TEST grants canonical inventory/coins and then ordinary HUD/persistence refresh;
- valid TEST actions give a short effects-channel click. Changed numeric rows emit signed `+N/-N` feedback that moves right, holds briefly and fades;
- population proof uses a transient clone: `+1/+10/+100` days, drop to `240`, reset, alive/dead/stage counts and recent births/deaths. It never changes real clock, gameplay or save;
- library items expose names/previews; placement uses the `16 px` grid;
- preview and commit share position, pivot, visual offset and effective collider; construction is not gameplay-persisted.

## Universal placeable lifecycle

Every catalog object declares one `placeableOwner` and `place → move → remove → restore`; one descriptor drives hover, commit and grouped undo. Resource profiles such as `berry-bush` use the same lifecycle and pose; authoring selection shares it.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual/crop/interaction offsets, approach, render policy and optional timeline data. Mouse and `1 px` arrow edits suppress movement.

`assetAuthoringRegistry` feeds the same modes everywhere: collider, pivot, visual offset, crop, approach, interaction point, render and timeline. Visible sprite bounds select instances; point markers drag/nudge; approach uses a `3×3` grid.

Render policy is `below-character`, `pivot-depth` or `above-character`; enabled timeline data overrides presentation target/durations. Fixed-world stairs/gliders use ordinary move authoring but stay outside the construction catalog.

Fixed-world placement and `collisionEnabled` are per instance. Collision OFF removes blocking without losing selection/editing/interaction. Move keeps sprite, collider, interaction and depth synchronized without changing safe-spawn.

Canon export downloads `nestledburrow-authoring-canon.json` with layout, colliders, profiles and fixed-world state. Browser storage may hold drafts/backups; `NEW GAME` restores baseline.

## Owners

- orchestration: `src/build/worldBuildCoordinator.js`;
- TEST palette/proof: `src/build/simulationTestPalette.js`;
- TEST click/delta presentation: `src/build/simulationTestFeedback.js`;
- lifecycle/placement: `src/build/placeableBuildContract.js`, `src/build/placeableBuildOwners.js`, `src/build/placeablePlacementPose.js`;
- profiles/input: `src/build/assetProfiles.js`, `src/build/assetAuthoringInput.js`;
- registry/authoring/export: `src/build/assetAuthoringRegistry.js`, `src/build/universalPlaceableAuthoring.js`, `src/build/fixedWorldAuthoringState.js`, `src/build/authoringBackup.js`;
- transition bridge: `src/build/worldTransitionAuthoringBridge.js`.

`WorldBuildCoordinator` owns build actions; runtime owners own entities; `WorldScene` remains composition only.

## Invariants

- preview and commit use one placement pose and live pivot/effective collider;
- targeting uses live collider, interaction offset and approach directions;
- one typed registry/mode list covers live placeables and fixed transitions;
- sprite selection can activate collider editing; pivot/interaction/timeline points support `1 px` nudges;
- render/timeline data survive profile export/load;
- fixed transitions stay outside build-library creation/demolition;
- fixed-world placement/collision settings survive canonical export; collision OFF preserves edited shape and interaction;
- fixed-world/grid availability never depends on a literal location ID;
- every catalog object has one lifecycle owner; move/demolition resolve the same target;
- TEST sandboxes and feedback are presentation/proof only and never become gameplay state;
- authoring stays separate from gameplay persistence and orchestration stays outside `src/main.js`.

## Current baseline

Village objects use the full construction lifecycle. BUILD holds the catalog; TEST grants canonical food, produce, seeds, resources and coins and runs a transient demographic proof with audible presses and floating deltas. Burrow/Nest stairs and Atoll transitions share fixed-world move/collider/collision authoring; only the village exposes construction.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-071`, `check:task-072`, `check:task-074`, `check:task-085`, `check:task-090`, `check:task-100`, `authoring-persistence.spec.js`.
