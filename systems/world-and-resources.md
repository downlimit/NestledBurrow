# World and resources

## Purpose

Owns world geometry, collisions, resources, farming and inventory items.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- saved `currentWorldId` selects the active layout, camera bounds and lifecycle;
- paired `2x2` transports automatically connect the Burrow and Island Nest;
- axe, pickaxe, hoe and water bucket expose separate strict actions;
- a mismatched tool cannot mutate a resource or farm cell;
- resource rewards enter the inventory and removing a node removes its collision and presentation consistently;
- inventory/wallet drag throws player-to-cursor: a stack or one coin. Non-blocking `2×2` drops settle at a free point and stay pickable;
- a fresh Burrow places pickable starter sword and battle axe beside the training dummy;
- the fixed canonical well refills the eight-use water bucket;
- potato and lemon crops share persisted soil/moisture rules and retain crop-specific growth and yield;
- rot advances only at fully dry soil; watering/rain resets it. Never-hydrated seeds rot after 24 dry hours, previously watered crops after 48.

## Owners

- location registry/transitions, owner lifecycle and presentation: `worldLocationConfig.js`, `worldLocationCoordinator.js`, `worldLocationRuntime.js`, `worldPresentationRuntime.js`;
- world geometry/collision: `worldLayout.js`, `nestWorldLayout.js`, `worldConfig.js`;
- profiles/actions/rewards: `resourceDomain.js`, `resourceConfig.js`;
- inventory state and item operations: `inventoryDomain.js`;
- inventory/world-item runtime: `inventoryRuntime.js`;
- farm rules/runtime and crop profiles: `farmingDomain.js`, `farmingRuntime.js`, `farmingConfig.js`;
- world resource instances, colliders, targeting and hit feedback: `debrisRuntime.js`; resource presentation adapter: `resourceVisuals.js`;
- interaction targeting and dialogue lifecycle: `interaction.js`, `interactionRuntime.js`;
- non-dialogue world dispatch and transient resource-action state: `worldInteractionCoordinator.js`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load and profile data is immutable;
- `village` remains the home world ID, `nest` is the only additional registered world ID, and unknown saved IDs resolve to `village`;
- every resource owns one `worldId`; only active-location resources create visuals, colliders, targets and hit resolution;
- switches reset candidate/unbind, destroy active owners, then presentation; mount reverses that boundary and exposes a named read-only `getOwners()` snapshot;
- `tavernService`/`cooking` require `facilities`; farming mounts independently;
- location-specific interaction owners are explicitly rebound after mount and detached before teardown;
- non-dialogue dispatch order is merchant, farming, tavern sign, facility, bed, busy gate, exhausted wake and resource; the first handled result completes dispatch;
- inventory has exactly ten slots; tools and loot share the movable-slot contract;
- a fresh game owns exactly one axe, pickaxe, hoe and water bucket; migration adds missing tools without duplicates;
- loot stacks by canonical item ID and the final resource hit is atomic when inventory is full;
- potato crops require eight effective daylight hours, lemon crops require four, and each crop applies its own daily cap and yield;
- dry exposure is persisted per crop, advances during day and night only at 0% soil moisture, and resets from either manual watering or precipitation;
- the canonical well is fixed infrastructure and is excluded from build placement, move and demolition;
- planted trees are gatherable resource nodes, yield exactly five wood and use the axe.
- authored Burrow trees and location-defined Nest trees register in the same `DebrisRuntime` and use the same `resourceVisuals.js` adapter; locations own placements only.
- a fresh Burrow yard contains two planted trees, two small logs, one large log, three small stones and three large stones; their combined yield is exactly 15 wood and 12 stone, or 1.5 stove material costs.

## Current baseline

The Burrow is `64x48`; the `22x16` Island Nest has oval grass/cliff geometry, a closed northern dead end, four trees and three stones. Resource progress persists across travel/reload. `WorldLocationRuntime` mounts capabilities and delegates frame phases; `WorldInteractionCoordinator` executes through its active owner snapshot. The ten-slot hotbar supports reorder, stack throw and pickup. Potato/lemon crops persist soil/moisture; the fixed well refills the bucket.

## Not yet

Inventory containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, focused location E2E.
