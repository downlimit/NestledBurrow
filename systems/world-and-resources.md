# World and resources

## Purpose

This system owns world geometry, collision queries, resource definitions and gatherable world objects.

## Player-visible contract

- world geometry renders and collides from the same semantic source;
- resources have readable action, progress, cooldown and reward;
- removing a node removes its collision and presentation consistently;
- future garden/water mechanics extend resource lifecycle instead of becoming unrelated UI counters.

## Owners

- world geometry/collision: `worldLayout.js`, `worldConfig.js`;
- profiles/actions/rewards: `resourceDomain.js`, `resourceConfig.js`;
- world instances: `debrisRuntime.js`;
- interaction targeting: `interaction.js`, `interactionRuntime.js`;
- build placement of plants: `systems/build-and-authoring.md`;
- persistence: `systems/persistence.md`.

## Invariants

- stable IDs survive save/load;
- profile data is immutable;
- collision footprint and visible object remain coordinated;
- placed tree is currently a gatherable resource node, not a crop lifecycle;
- new crops should define stages, care actions, timing and harvest as one domain contract.

## Current baseline

Small/large logs and stones, ruby nodes and planted trees support interactions, progress, rewards, collision and persistence. Planted trees can be placed through build mode and chopped.

## Not yet

Soil, seeds, crop stages, watering, water source, inventory containers, tools progression and seasonal rules.

## Evidence

`check:world`, `check:interaction`, `check:progress`, resource-related Browser E2E.
