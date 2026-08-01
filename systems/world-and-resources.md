# World and resources

## Purpose

This system owns world geometry, collision queries, resource definitions, gatherable world objects, farm lifecycle and inventory item ownership.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- the saved `currentWorldId` selects one active location layout, camera bounds and location-specific lifecycle;
- paired `2x2` transports move the player between the home Burrow and the Island Nest automatically;
- axe, pickaxe, hoe and water bucket expose separate strict actions;
- a mismatched tool cannot mutate a resource or farm cell;
- resource rewards enter the inventory and removing a node removes its collision and presentation consistently;
- inventory and wallet drag share one player-to-cursor throw direction; inventory throws a whole stack, while wallet drag throws one coin; dropped items remain non-blocking, use a `2×2` occupancy footprint, settle at a free point and can be picked up again;
- a fresh Burrow places the starter sword and battle axe as ordinary pickable world items immediately beside the training dummy;
- the fixed canonical well refills the eight-use water bucket;
- potato and lemon crops share persisted soil/moisture rules and retain crop-specific growth and yield;
- crop rot accumulates only while soil is fully dry; watering or rain resets the dry timer. A never-hydrated seed rots after 24 fully dry hours, while a crop that has received water rots after 48 fully dry hours.

## Owners

- location registry/transition lifecycle: `worldLocationConfig.js`, `worldLocationCoordinator.js`, `worldLocationLifecycle.js`;
- world geometry/collision: `worldLayout.js`, `nestWorldLayout.js`, `worldConfig.js`;
- profiles/actions/rewards: `resourceDomain.js`, `resourceConfig.js`;
- inventory state and item operations: `inventoryDomain.js`;
- inventory/world-item runtime: `inventoryRuntime.js`;
- farm rules/runtime and crop profiles: `farmingDomain.js`, `farmingRuntime.js`, `farmingConfig.js`;
- world resource instances, colliders, targeting and hit feedback: `debrisRuntime.js`; resource presentation adapter: `resourceVisuals.js`;
- interaction targeting: `interaction.js`, `interactionRuntime.js`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load and profile data is immutable;
- `village` remains the home world ID, `nest` is the only additional registered world ID, and unknown saved IDs resolve to `village`;
- every resource definition owns one `worldId`; only active-location definitions create visuals, colliders, targets and hit resolution;
- a location switch destroys the previous location lifecycle before mounting the next one, so repeated travel cannot duplicate objects;
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

The home Burrow retains its existing `64x48` layout and systems. The `22x16` Island Nest uses one oval grass/cliff model for rendering and collision, a closed northern stone dead end, four gatherable trees and three stones. Resource progress persists across travel and reload. The player can reorder ten hotbar slots, throw whole stacks toward the cursor and pick them up. Potato and lemon crops share persisted soil/moisture rules; the fixed well refills the water bucket.

## Not yet

Inventory containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, resource/farming/location Browser E2E.
