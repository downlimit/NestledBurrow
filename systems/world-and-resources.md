# World and resources

## Purpose

Owns world geometry, collision, location switching, resources, farming and inventory items.

## Player-visible contract

- geometry and collision derive from the same semantic layout;
- saved `currentWorldId` selects layout, camera bounds and lifecycle;
- one native stair sprite in the Burrow enters Island Nest and one in Island Nest returns to the Burrow; proximity exposes the normal prompt and only the canonical interact action (`Space`) changes location;
- explicit safe-spawn transitions connect the Nest entrance and transport-free Atoll arenas;
- axe, pickaxe, hoe and bucket have strict actions; mismatched tools cannot mutate targets;
- logs and stones keep the same HP, outline, cooldown, hit feedback, energy and reward flow in every location;
- tool-free berries use the common resource targeting, inventory and teardown pipeline;
- resource removal clears presentation and collision, then delivers its reward atomically;
- ten inventory slots hold tools and stackable loot; world drops remain pickable;
- the canonical well refills the eight-use bucket;
- potato and lemon crops persist soil, moisture, growth and dry-rot state.

## Owners

- location registry/lifecycle/presentation: `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`;
- layouts: `src/world/worldLayout.js`, `src/world/nestWorldLayout.js`, `src/world/atollWorldLayout.js`, `src/world/worldConfig.js`;
- resources: `src/resources/resourceDomain.js`, `src/resources/resourceConfig.js`, `src/resources/debrisRuntime.js`, `src/resources/resourceVisuals.js`;
- inventory: `src/inventory/inventoryDomain.js`, `src/inventory/inventoryRuntime.js`;
- farming: `src/resources/farmingDomain.js`, `src/resources/farmingRuntime.js`, `src/resources/farmingConfig.js`;
- interaction dispatch: `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`;
- Atoll topology: `systems/wild-atoll.md`;
- build and persistence: `systems/build-and-authoring.md`, `systems/persistence.md`.

## Invariants

- registered world IDs are `village`, `nest` and `atoll`; unknown saved IDs resolve to `village`;
- paired Burrow/Nest stairs are active objects: proximity never transitions automatically, successful interact runs the canonical location lifecycle, and destination locks prevent immediate bounce-back;
- each stair renders from one committed project PNG at native dimensions, without constructor, tileset or build-mode profile;
- stair PNGs use the standalone image path without an atlas frame and stay on a ground layer below depth-sorted actors;
- explicit `transitionTo` runs the location lifecycle without a hidden transport or lock;
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

The Burrow is `64x48`; its upward Nest entrance is `public/assets/project/world/NestledBurrow_NestStairway.png` (`64x128`). Island Nest is `22x16`; its downward Burrow entrance is `public/assets/project/world/NestledBurrow_HighgroundEntranceStairs.png` (`64x48`). The Atoll is a separate `22x18` transport-free layout with transient arena topology. Its logs, stones and berries remain ordinary `DebrisRuntime` resources. Canonical resource progress persists through travel/reload; a new Atoll run resets transient arena state. Inventory supports reorder, stacking, throwing and pickup; potato and lemon crops persist.

## Not yet

Containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, `check:task-068`, `check:task-074`, focused location E2E.
