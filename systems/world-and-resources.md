# World and resources

## Purpose

Owns world geometry, collision, location switching, resources, farming and inventory items.

## Player-visible contract

- geometry and collision derive from the same semantic layout;
- saved `currentWorldId` selects layout, camera bounds and lifecycle;
- paired `2x2` transports connect the Burrow and Island Nest;
- explicit safe-spawn transitions connect the Nest entrance and transport-free Atoll arenas;
- axe, pickaxe, hoe and bucket have strict actions; mismatched tools cannot mutate targets;
- resource removal clears presentation and collision, then delivers its reward atomically;
- ten inventory slots hold tools and stackable loot; world drops remain pickable;
- the canonical well refills the eight-use bucket;
- potato and lemon crops persist soil, moisture, growth and dry-rot state.

## Owners

- location registry/lifecycle/presentation: `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`;
- layouts: `src/world/worldLayout.js`, `src/world/nestWorldLayout.js`, `src/world/atollWorldLayout.js`, `src/world/worldConfig.js`;
- resource rules/instances/visuals: `src/resources/resourceDomain.js`, `src/resources/resourceConfig.js`, `src/resources/debrisRuntime.js`, `src/resources/resourceVisuals.js`;
- inventory: `src/inventory/inventoryDomain.js`, `src/inventory/inventoryRuntime.js`;
- farming: `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js`, `src/resources/farmingConfig.js`;
- interaction dispatch: `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`;
- Atoll-local arena resources: `systems/wild-atoll.md`;
- build and persistence: `systems/build-and-authoring.md`, `systems/persistence.md`.

## Invariants

- registered world IDs are `village`, `nest` and `atoll`; unknown saved IDs resolve to `village`;
- paired transports retain destination locks; explicit `transitionTo` runs the canonical lifecycle without a hidden transport or lock;
- every canonical resource has one `worldId`; only active-location resources mount;
- location teardown unbinds interactions before destroying owners and presentation; mount reverses that order;
- inventory has exactly ten slots; a fresh game owns one axe, pickaxe, hoe and bucket;
- migration restores missing tools without duplication;
- loot stacks by canonical item ID; a final resource hit is atomic when capacity is insufficient;
- the fixed well cannot be placed, moved or demolished;
- planted trees use the shared resource owner, require an axe and yield five wood;
- dry exposure advances only at zero moisture and resets after water or rain.

## Current baseline

The Burrow is `64x48`. Island Nest is a `22x16` oval island with its village transport, northern Atoll entrance, four trees and three stones. The Atoll is a separate `22x18` bounded layout with no static transports; its transient arena topology and resources belong to the Atoll runtime. Canonical world-resource progress persists through travel and reload, while a new Atoll run resets transient arena state. The inventory supports reorder, stacking, throwing and pickup; potato and lemon crops persist their farming state.

## Not yet

Containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, `check:task-068`, focused location E2E.
