# World and resources

## Purpose

Owns world geometry, collision, location switching, resources, farming and inventory items.

## Player-visible contract

- geometry and collision derive from the same semantic layout;
- saved `currentWorldId` selects layout, camera bounds and lifecycle;
- one native stair sprite in the Burrow enters Island Nest and one native stair sprite in Island Nest returns to the Burrow; proximity exposes the normal interaction prompt and the location changes only after the player activates the canonical interact action (`Space` on keyboard);
- explicit safe-spawn transitions connect the Nest entrance and transport-free Atoll arenas;
- axe, pickaxe, hoe and bucket have strict actions; mismatched tools cannot mutate targets;
- logs and stones keep the same HP, outline, cooldown, hit feedback, energy and reward flow in every location;
- tool-free berries still use the common resource definition, targeting, inventory and teardown pipeline;
- resource removal clears presentation and collision, then delivers its reward atomically;
- ten inventory slots hold tools and stackable loot; world drops remain pickable;
- the canonical well refills the eight-use bucket;
- potato and lemon crops persist soil, moisture, growth and dry-rot state.

## Owners

- location registry/lifecycle/presentation: `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`;
- layouts: `src/world/worldLayout.js`, `src/world/nestWorldLayout.js`, `src/world/atollWorldLayout.js`, `src/world/worldConfig.js`;
- resource rules/definitions/instances/visuals: `src/resources/resourceDomain.js`, `src/resources/resourceConfig.js`, `src/resources/debrisRuntime.js`, `src/resources/resourceVisuals.js`;
- inventory: `src/inventory/inventoryDomain.js`, `src/inventory/inventoryRuntime.js`;
- farming: `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js`, `src/resources/farmingConfig.js`;
- interaction dispatch: `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`;
- Atoll topology and transient resource registration: `systems/wild-atoll.md`;
- build and persistence: `systems/build-and-authoring.md`, `systems/persistence.md`.

## Invariants

- registered world IDs are `village`, `nest` and `atoll`; unknown saved IDs resolve to `village`;
- paired Burrow/Nest stairs are active interaction objects: frame/proximity updates never transition automatically, successful interact activation runs the canonical location lifecycle, and destination locks prevent immediate bounce-back; explicit `transitionTo` runs the same lifecycle without a hidden transport or lock;
- each paired stair renders from one committed project PNG at its native dimensions; it is not split into a constructor, tileset or build-mode profile;
- paired stair PNGs use the standalone image render path without an atlas frame and are ground-affixed below depth-sorted actors, so they cannot globally cover the player;
- every canonical resource has one `worldId`; only active-location resources mount;
- transient Atoll definitions may register with `DebrisRuntime` but may not duplicate resource work logic;
- location teardown unbinds interactions before destroying owners and presentation; mount reverses that order;
- inventory has exactly ten slots; a fresh game owns one axe, pickaxe, hoe and bucket;
- migration restores missing tools without duplication;
- loot stacks by canonical item ID; a final resource hit is atomic when capacity is insufficient;
- the fixed well cannot be placed, moved or demolished;
- planted trees use the shared resource owner, require an axe and yield five wood;
- dry exposure advances only at zero moisture and resets after water or rain.

## Current baseline

The Burrow is `64x48`. Its Nest entrance uses `public/assets/project/world/NestledBurrow_NestStairway.png` (`64x128`) as the upward active stair object. Island Nest is a `22x16` oval island; its Burrow entrance uses `public/assets/project/world/NestledBurrow_HighgroundEntranceStairs.png` (`64x48`) as the downward active stair object, alongside the northern Atoll entrance, four trees and three stones. The Atoll is a separate `22x18` bounded layout with no static transports. Its arena topology is transient, while its logs, stones and berries are ordinary `DebrisRuntime` resources registered for the active arena and removed on forward travel. Canonical world-resource progress persists through travel and reload; a new Atoll run resets transient arena state. The inventory supports reorder, stacking, throwing and pickup; potato and lemon crops persist their farming state.

## Not yet

Containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, `check:task-068`, `check:task-074`, focused location E2E.
