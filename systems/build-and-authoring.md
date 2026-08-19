# Build mode and developer authoring

## Purpose

Owns construction, placeable lifecycle and asset/layout editing.

## Player-facing build contract

- walls/surfaces support placement, demolition and grouped undo; objects move through one owner;
- `BUILD / TEST` separates construction from prototype simulation; TEST never starts placement, move or demolition;
- TEST grants canonical inventory/coins and then ordinary HUD/persistence refresh;
- valid TEST actions give a short effects-channel click. Changed numeric rows emit signed `+N/-N` feedback that moves right, holds briefly and fades;
- population proof uses a transient clone: `+1/+10/+100` days, drop to `240`, reset, alive/dead/stage counts and `10` recent events. Births, natural deaths and accidents are mixed so one category cannot crowd out the others. It never changes real clock, gameplay or save;
- library items expose names/previews; placement uses the `16 px` grid;
- cursor anchor is the midpoint between the current pivot and current effective collider centre;
- preview and commit share position, pivot, visual offset and effective collider; construction is not gameplay-persisted.

## Universal placeable lifecycle

Every catalog object declares one `placeableOwner` and `place → move → remove → restore`; one descriptor drives hover, commit and grouped undo. Resource profiles such as `berry-bush` use the same lifecycle and pose; authoring selection shares it.

## Developer-authoring contract

One versioned profile owns collider, pivot, visual/crop/interaction offsets, approach, render policy and optional timeline data. Mouse and `1 px` arrow edits suppress movement.

`assetAuthoringRegistry` feeds collider, pivot, visual offset, crop, approach, interaction point, render and timeline modes. Visible sprite bounds select instances; point markers drag/nudge; approach uses a `3×3` grid.

Render policy is `below-character`, `pivot-depth` or `above-character`; timeline data may override presentation target/durations. Fixed-world stairs/gliders use ordinary move authoring but stay outside construction catalog.

Fixed-world placement and `collisionEnabled` are per instance. Collision OFF removes blocking without losing selection/editing/interaction. Move keeps sprite, collider, interaction and depth synchronized without changing safe-spawn.

Canon export downloads `nestledburrow-authoring-canon.json` with layout, colliders, profiles and fixed-world state. Browser storage may hold drafts/backups; `NEW GAME` restores baseline.

## Owners

`WorldBuildCoordinator` owns build actions; runtime owners own entities; `WorldScene` remains composition only. TEST proof lives in `simulationTestPalette`; placement in `placeableBuildContract`/`placeablePlacementPose`; profiles/authoring in `assetProfiles`, `assetAuthoringRegistry`, `universalPlaceableAuthoring`; fixed transitions use `fixedWorldAuthoringState` and `worldTransitionAuthoringBridge`.

## Invariants

- preview/commit use one placement pose and live pivot/effective collider;
- targeting uses live collider, interaction offset and approach directions;
- one typed registry/mode list covers live placeables and fixed transitions;
- selection/editing support collider, pivot, interaction and timeline points with `1 px` nudges;
- render/timeline data survive profile export/load;
- fixed transitions stay outside build-library creation/demolition;
- fixed-world placement/collision survive canonical export; collision OFF preserves shape/interaction;
- fixed-world/grid availability never depends on a literal location ID;
- every catalog object has one lifecycle owner; move/demolition resolve the same target;
- TEST sandboxes/feedback are presentation/proof only, never gameplay state;
- authoring stays separate from gameplay persistence; orchestration stays outside `src/main.js`.

## Current baseline

Village objects use full construction lifecycle. BUILD holds catalog; TEST grants canonical items/coins and runs transient demographic proof with audible presses, floating deltas and mixed ten-event history. Burrow/Nest stairs and Atoll transitions share fixed-world move/collider/collision authoring; only village exposes construction.

## Evidence

`check:build-mode`, `check:facilities`, `check:authoring`, `check:task-090`, `check:task-100`, `check:task-101`, `authoring-persistence.spec.js`.
