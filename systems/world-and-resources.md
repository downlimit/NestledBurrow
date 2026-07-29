# World and resources

## Purpose

This system owns world geometry, collision queries, resource definitions, gatherable world objects, farm lifecycle and inventory item ownership.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- axe, pickaxe, hoe and water bucket expose separate strict actions;
- a mismatched tool cannot mutate a resource or farm cell;
- resource rewards enter the inventory and removing a node removes its collision and presentation consistently;
- inventory and wallet drag share one player-to-cursor throw direction; inventory throws a whole stack, while wallet drag throws one coin; dropped items remain non-blocking, use a `2×2` occupancy footprint, settle at a free point and can be picked up again;
- the fixed canonical well refills the eight-use water bucket;
- potato and lemon crops share persisted soil/moisture rules and retain crop-specific growth and yield.

## Owners

- world geometry/collision: `worldLayout.js`, `worldConfig.js`;
- profiles/actions/rewards: `resourceDomain.js`, `resourceConfig.js`;
- inventory state and item operations: `inventoryDomain.js`;
- inventory/world-item runtime: `inventoryRuntime.js`;
- farm rules/runtime and crop profiles: `farmingDomain.js`, `farmingRuntime.js`, `farmingConfig.js`;
- world instances: `debrisRuntime.js`;
- interaction targeting: `interaction.js`, `interactionRuntime.js`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load and profile data is immutable;
- inventory has exactly ten slots; tools and loot share the movable-slot contract;
- a fresh game owns exactly one axe, pickaxe, hoe and water bucket; migration adds missing tools without duplicates;
- loot stacks by canonical item ID and the final resource hit is atomic when inventory is full;
- potato crops require eight effective daylight hours, lemon crops require four, and each crop applies its own daily cap and yield;
- the canonical well is fixed infrastructure and is excluded from build placement, move and demolition;
- planted trees are gatherable resource nodes, yield exactly five wood and use the axe.

## Current baseline

Logs, stones, ruby nodes and six starting planted trees support strict tool interactions, progress, inventory rewards, collision and persistence. The player can reorder ten hotbar slots, throw whole stacks toward the cursor and pick them up. Potato and lemon crops share persisted soil/moisture rules; the fixed well refills the water bucket.

## Not yet

Inventory containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, resource/farming Browser E2E.
