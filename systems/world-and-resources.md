# World and resources

## Purpose

Owns world geometry, collisions, resources, farming and inventory items.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- saved `currentWorldId` selects the active layout, camera bounds and lifecycle;
- paired `2x2` transports automatically connect the Burrow and Island Nest;
- explicit safe-spawn transitions connect the Nest entrance and transport-free Atoll arenas;
- axe, pickaxe, hoe and water bucket expose separate strict actions;
- a mismatched tool cannot mutate a resource or farm cell;
- resource rewards enter the inventory and removing a node removes its collision and presentation consistently;
- inventory/wallet drag throws player-to-cursor: a stack or one coin. Non-blocking `2×2` drops settle at a free point and stay pickable;
- a fresh Burrow places pickable starter sword and battle axe beside the training dummy;
- the fixed canonical well refills the eight-use water bucket;
- potato and lemon crops share persisted soil/moisture rules and retain crop-specific growth and yield;
- rot advances only at fully dry soil; watering/rain resets it. Never-hydrated seeds rot after 24 dry hours, previously watered crops after 48.

## Owners

- location config/transitions/lifecycle/presentation: `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`;
- world geometry/collision: `src/world/worldLayout.js`, `src/world/nestWorldLayout.js`, `src/world/atollWorldLayout.js`, `src/world/worldConfig.js`;
- profiles/actions/rewards: `src/resources/resourceDomain.js`, `src/resources/resourceConfig.js`;
- inventory state and item operations: `src/inventory/inventoryDomain.js`;
- inventory/world-item runtime: `src/inventory/inventoryRuntime.js`;
- farm rules/runtime/profiles: `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js`, `src/resources/farmingConfig.js`;
- resource instances/colliders/targeting/hit feedback: `src/resources/debrisRuntime.js`; visuals: `src/resources/resourceVisuals.js`;
- interaction targeting/dialogue: `src/interaction/interaction.js`, `src/interaction/interactionRuntime.js`;
- non-dialogue dispatch/resource-action state: `src/interaction/worldInteractionCoordinator.js`;
- Atoll-local arena resources: `systems/wild-atoll.md`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load and profile data is immutable;
- registered world IDs are `village`, `nest` and `atoll`; unknown saved IDs resolve to `village`;
- paired transports retain destination locks; explicit `transitionTo` changes world lifecycle without requiring a hidden transport or lock;
- every canonical resource owns one `worldId`; only active-location resources create visuals, colliders, targets and hit resolution;
- switches reset candidate/unbind, destroy owners, then presentation; mount reverses this and exposes a read-only named `getOwners()` snapshot;
- `tavernService`/`cooking` require `facilities`; farming mounts independently;
- location-specific interaction owners are explicitly rebound after mount and detached before teardown;
- dispatch order is merchant, farming, tavern sign, facility, bed, busy gate, exhausted wake, resource; first handled result wins;
- inventory has exactly ten slots; tools and loot share the movable-slot contract;
- a fresh game owns exactly one axe, pickaxe, hoe and water bucket; migration adds missing tools without duplicates;
- loot stacks by canonical item ID and the final resource hit is atomic when inventory is full;
- potato crops require eight effective daylight hours, lemon crops require four, and each crop applies its own daily cap and yield;
- persisted dry exposure advances day and night at 0% moisture and resets from watering or precipitation;
- the canonical well is fixed infrastructure and is excluded from build placement, move and demolition;
- planted trees are gatherable resource nodes, yield exactly five wood and use the axe;
- Burrow and Nest trees share `DebrisRuntime` and `src/resources/resourceVisuals.js`; locations own placements only;
- a fresh Burrow yard contains two planted trees, two small logs, one large log, three small stones and three large stones; their combined yield is exactly 15 wood and 12 stone, or 1.5 stove material costs.

## Current baseline

The Burrow is `64x48`; the `22x16` Island Nest has oval grass/cliff geometry, a closed northern entrance area, four trees and three stones. The `22x18` Atoll world is a bounded transport-free arena field whose transient resources and internal topology belong to the Atoll runtime. Resource progress in canonical worlds persists across travel/reload; current Atoll run state resets on a new run. `WorldLocationRuntime` mounts capabilities/frame phases, and `WorldInteractionCoordinator` uses its active owner snapshot. The ten-slot hotbar supports reorder, stack throw and pickup. Potato/lemon crops persist soil/moisture; the fixed well refills the bucket.

## Not yet

Inventory containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, `check:task-068`, focused location E2E.
