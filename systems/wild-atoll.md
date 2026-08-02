# Wild Atoll expedition system

## Purpose

Owns repeatable expeditions connecting home preparation, compact arenas, route discovery and access to deeper segments.

## Terms

A **segment** is a literary named zone containing connected arenas. An **arena** is one compact playable location inside that segment. Segment names establish place and mood; arena names and exit tips stay short and practical.

## Product loop

```text
home preparation -> Atoll run -> materials/discoveries -> tavern and island development -> deeper run
```

Food, tools, consumables, information and relationships prepared at home must alter expedition options. Coins prove the tavern works as a business; Atoll materials enable physical development.

## Implemented topology

```text
Island Nest
└─ First Trails
   ├─ Beneath the Canopy T1
   │  ├─ Deep Woods T2
   │  └─ Wet Lowlands T2
   └─ Under a Stone Sky T1
      ├─ Crystal Galleries T2
      └─ Lower Workings T2
```

The starter, both T1 branches and all four currently planned T2 branches are traversable. T3, automation and NPC routes are not generated yet.

## Segment format

Every implemented segment contains eight arenas in a forward-only `1 -> 2 -> 2 -> 2 -> 1` graph. Cross-links allow routes to reconverge without creating a back exit.

- the first seven arenas contain a lightweight mixture of ordinary resource nodes;
- the final arena may contain no resources;
- the final arena always contains a white teleport to Island Nest;
- starter and T1 terminal arenas also contain two onward segment entrances;
- T2 terminal arenas currently end the implemented route and offer the home teleport;
- entering another segment resets the player to that segment's entry arena while preserving the same transient run.

## Arena contract

- movement and work spend energy through existing movement/needs owners;
- wood, stone and berries exist as world objects that may be harvested or ignored;
- logs and stones use the same `DebrisRuntime`, HP, targeting outline, hit feedback, cooldown, energy and reward flow as every other location;
- berries use the same resource pipeline without requiring a tool;
- route transitions never subtract an estimated cost or reveal resource counts in text;
- exits identify only the next arena or segment with a short interaction tip;
- travel is forward-only: a chosen arena path or segment cannot be reversed;
- every terminal arena exposes the white return teleport.

`src/world/atollWorldLayout.js` owns the isolated transport-free collision space. `src/world/wildAtollDomain.js` generates all seven segment graphs, route connections and deterministic common resource definitions. `src/world/wildAtollRuntime.js` owns transient traversal, exit presentation, resource registration, segment changes, terminal teleports and collapse return. Player-facing Atoll copy lives in the dedicated `atoll` localization namespace.

## Collapse return

Collapsing on the Atoll starts sleep immediately so movement stops, but visible time remains at normal speed during a five-second fade to black. Behind black, the game simulates the remaining knockout time through the ordinary clock and needs owners, wakes the character in Island Nest, holds black briefly, then fades in over three seconds.

## Inventory and preparation

- `10` peaceful slots plus `6` numbered combat slots; no weight system;
- four combat action slots accept weapons;
- axe, pickaxe, hoe, bucket, food, materials and findings compete for ordinary capacity;
- stable combat mode allows supported numbered items to be used on the character;
- current self-use profiles: cooked potato dish restores `25 S`; one bucket-water unit restores `20 L`.

## Invariants

- seven segments and fifty-six unique arenas are generated;
- every segment topology is `1/2/2/2/1`;
- all internal paths advance exactly one arena level;
- no non-terminal arena has a home teleport;
- starter routes to Forest T1 and Mines T1;
- Forest T1 routes to Deep Woods T2 and Wet Lowlands T2;
- Mines T1 routes to Crystal Galleries T2 and Lower Workings T2;
- represented resources use the common resource owner and never overlap spawn corridors;
- arena and segment transitions do not mutate needs directly;
- transient run state is not serialized;
- expedition capacity remains slot-based.

## Current baseline

The production slice contains the complete route tree through T2, common resource harvesting, literary segment titles, short arena tips, white terminal teleports, collapse return, numbered combat self-use and expedition build grouping. Filling is intentionally provisional and reuses simple wood/stone/berry profiles.

## Evidence

`check:task-068`, `check:inventory`, `check:interaction`, `check:hud`, `check:i18n`, Browser E2E and managed game preview.

## Not fixed

Persistent run schema, threshold repair, T3 and automation routes, NPC routes, encounters, final reward economy, final arena art/layout, whistle behavior and native assets for additional expedition props.
