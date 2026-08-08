# World and resources

## Purpose

Owns world geometry, collision, location switching, resources, farming and inventory items.

## Player-visible contract

- geometry and collision derive from the same semantic layout;
- saved `currentWorldId` selects layout, camera bounds and lifecycle;
- Burrow/Nest stairs are active objects: proximity exposes the normal prompt and only `Space` changes location;
- explicit safe-spawn transitions connect the Nest entrance and transport-free Atoll arenas;
- tools have strict actions; mismatched tools cannot mutate targets;
- logs, stones and berries use the same resource targeting/reward pipeline in every location;
- resource removal clears presentation/collision before atomic reward delivery;
- ten inventory slots hold tools and stackable loot; world drops remain pickable;
- the canonical well refills the eight-use bucket;
- potato and lemon crops persist soil, moisture, growth and dry-rot state.

## Owners

- locations/layout/presentation: `src/world/worldLocationConfig.js`, `src/world/worldLocationCoordinator.js`, `src/world/worldLocationRuntime.js`, `src/world/worldPresentationRuntime.js`, `src/world/worldLayout.js`;
- resources/inventory/farming: `src/resources/`, `src/inventory/`;
- interaction dispatch: `src/interaction/interactionRuntime.js`, `src/interaction/worldInteractionCoordinator.js`;
- transition authoring: `src/build/assetProfiles.js`, `src/build/universalPlaceableAuthoring.js`, `src/build/worldTransitionAuthoringBridge.js`;
- Atoll topology: `systems/wild-atoll.md`; build/persistence: `systems/build-and-authoring.md`, `systems/persistence.md`.

## Invariants

- registered world IDs are `village`, `nest` and `atoll`; unknown saved IDs resolve to `village`;
- paired Burrow/Nest stairs never auto-transition; successful interact runs the canonical location lifecycle and destination lock;
- runtime transition/teleport PNGs must be structurally complete, fully IDAT-decodable and match canonical dimensions;
- stairs expose normal collider/pivot/visual/interaction profiles without becoming build-library objects;
- stair collision is registered in the active layout and uses common `world-placeable` targeting;
- Burrow→Nest renders as fixed ground-overlay; Nest→Burrow keeps pivot-based world depth;
- explicit `transitionTo` runs the normal location lifecycle without hidden transports;
- canonical resources have one `worldId`; only active-location resources mount;
- transient Atoll resources reuse `DebrisRuntime`; Atoll platforms/teleport pieces use normal authored profiles and registered colliders;
- Atoll gliders and stone teleport platform use ground-overlay depth; the blue crystal alone uses authored pivot depth;
- location teardown unbinds interactions before owners/presentation are destroyed;
- inventory has exactly ten slots; migration restores the initial axe, pickaxe, hoe and bucket without duplication;
- loot stacks by canonical item ID and a final resource hit is atomic when capacity is insufficient;
- planted trees use the shared resource owner, require an axe and yield five wood;
- dry exposure advances only at zero moisture and resets after water or rain.

## Current baseline

The Burrow is `64x48`; its `NestledBurrow_NestStairway.png` (`64x128`) enters Island Nest as a ground-overlay. Island Nest is `22x16`; `NestledBurrow_HighgroundEntranceStairs.png` (`64x48`) returns to the Burrow. Both use the shared profile editor. The Atoll is a separate `22x18` transport-free layout with transient arena topology; its native path platforms and two-part crystal teleport use the same authoring contract. Canonical resource progress persists through travel/reload while each new Atoll run resets transient arena state.

## Not yet

Containers, stack splitting, tool progression, durability and seasonal rules.

## Evidence

`check:inventory`, `check:world`, `check:interaction`, `check:progress`, `check:task-047`, `check:task-049`, `check:task-056`, `check:task-059`, `check:task-064`, `check:task-065`, `check:task-068`, `check:task-074`, focused location E2E.
