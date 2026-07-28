# World and resources

## Purpose

This system owns world geometry, collision queries, resource definitions, gatherable world objects and inventory item ownership.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- resources have readable action, progress, cooldown and reward;
- removing a node removes its collision and presentation consistently;
- resource rewards enter the inventory instead of separate HUD counters;
- dropped inventory items remain non-blocking for the player, use a `2×2` occupancy footprint, settle in a free point and can be picked up again;
- future garden/water mechanics extend resource and inventory lifecycle instead of becoming unrelated UI counters.

## Owners

- world geometry/collision: `worldLayout.js`, `worldConfig.js`;
- profiles/actions/rewards: `resourceDomain.js`, `resourceConfig.js`;
- inventory state and item operations: `inventoryDomain.js`;
- inventory/world-item runtime: `inventoryRuntime.js`;
- world instances: `debrisRuntime.js`;
- interaction targeting: `interaction.js`, `interactionRuntime.js`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load;
- profile data is immutable;
- inventory has exactly ten slots;
- tools and loot share the same movable slot contract;
- loot stacks by canonical item ID;
- a final resource hit is atomic when no inventory slot or compatible stack can accept the reward;
- dropped items do not enter player collision, cannot share the same `2×2` occupancy point and use deterministic fallback placement;
- collision footprint and visible object remain coordinated;
- placed tree is currently a gatherable resource node, not a crop lifecycle.

## Current baseline

Small/large logs and stones, ruby nodes and planted trees support interactions, progress, inventory rewards, collision and persistence. The player can reorder ten hotbar slots, drop whole stacks into the world and pick them up again. Planted trees can be placed through build mode and chopped.

## Not yet

Soil, seeds, crop stages, watering gameplay, water source, inventory containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, resource-related Browser E2E.
