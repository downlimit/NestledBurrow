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
   ├─ Безмятежные Шхеры
   │  ├─ Лесистая Перейма -> NPC route -> Nest
   │  └─ Дремучие Шхеры
   │     ├─ Моту -> Nest
   │     └─ Грозные Шхеры -> Nest
   └─ Безмятежный Грот
      ├─ Теневая Перейма -> NPC route -> Nest
      └─ Глубокий Грот
         ├─ Голубая дыра -> Nest
         └─ Реликтовый Грот -> Nest
```

All canonical named segments are traversable. `Лесистая Перейма` and `Теневая Перейма` are the current NPC-route segments; actual random NPC selection, dialogue and island attachment are future encounter work.

## Segment format

Every implemented segment contains eight arenas in a forward-only `1 -> 2 -> 2 -> 2 -> 1` graph. Cross-links allow routes to reconverge without creating a back exit.

- the first seven arenas contain a lightweight mixture of ordinary resource nodes;
- the final arena may contain no resources;
- the final arena always contains a white teleport to Island Nest;
- starter, T1 and T2 terminal arenas expose their canonical onward segment entrances;
- NPC, automation and T3 segments are terminal and return to the Nest;
- entering another segment resets the player to that segment's entry arena while preserving the same transient run.

## Arena naming and mood

- starter names are plain orientation labels;
- T1 arena names are harmless and welcoming;
- T2 names suggest denser forest or deeper stone without presenting the branch as terminal danger;
- T3 names are mysterious and dangerous;
- NPC-route names hint at tracks, lights, smoke, piers and an inhabited island ahead;
- automation-route names hint at soul stones, crystals, magnets, unusual metals and other future special materials.

Arena exits display only `SPACE - <next arena>` or the canonical next segment name. All compact labels use the supported ASCII hyphen and remain within the HUD length budget.

## Resource filling

- wooded segments currently bias logs and berries;
- grotto segments currently bias stones;
- NPC and automation branches temporarily reuse the same ordinary log, stone and berry resource profiles;
- all nodes remain optional physical objects and use the shared resource owner;
- dedicated soul stones, magnets, unusual metals and NPC-route rewards require later item profiles and native assets.

## Arena contract

- movement and work spend energy through existing movement/needs owners;
- wood, stone and berries exist as world objects that may be harvested or ignored;
- logs and stones use the same `DebrisRuntime`, HP, targeting outline, hit feedback, cooldown, energy and reward flow as every other location;
- berries use the same resource pipeline without requiring a tool;
- route transitions never subtract an estimated cost or reveal resource counts in text;
- travel is forward-only: a chosen arena path or segment cannot be reversed;
- every terminal arena exposes the white return teleport.

`src/world/atollWorldLayout.js` owns the isolated transport-free collision space. `src/world/wildAtollDomain.js` generates the complete segment graph, route connections and deterministic common resource definitions. `src/world/wildAtollRuntime.js` owns transient traversal, exit presentation, resource registration, segment changes, terminal teleports and collapse return. Player-facing Atoll copy lives in the dedicated `atoll` localization namespace.

## Collapse return

Collapsing on the Atoll starts sleep immediately so movement stops, but visible time remains at normal speed during a five-second fade to black. Behind black, the game simulates the remaining knockout time through the ordinary clock and needs owners, wakes the character in Island Nest, holds black briefly, then fades in over three seconds.

## Inventory and preparation

- `10` peaceful slots plus `6` numbered combat slots; no weight system;
- four combat action slots accept weapons;
- axe, pickaxe, hoe, bucket, food, materials and findings compete for ordinary capacity;
- stable combat mode allows supported numbered items to be used on the character;
- current self-use profiles: cooked potato dish restores `25 S`; one bucket-water unit restores `20 L`.

## Invariants

- eleven segments and eighty-eight unique arenas are generated;
- every segment topology is `1/2/2/2/1`;
- all internal paths advance exactly one arena level;
- no non-terminal arena has a home teleport;
- First Trails routes to Безмятежные Шхеры and Безмятежный Грот;
- Безмятежные Шхеры routes to Лесистая Перейма and Дремучие Шхеры;
- Дремучие Шхеры routes to Моту and Грозные Шхеры;
- Безмятежный Грот routes to Теневая Перейма and Глубокий Грот;
- Глубокий Грот routes to Голубая дыра and Реликтовый Грот;
- represented resources use the common resource owner and never overlap spawn corridors;
- arena and segment transitions do not mutate needs directly;
- transient run state is not serialized;
- expedition capacity remains slot-based.

## Current baseline

The production slice contains the complete canonical route tree, ordinary common-resource harvesting, literary arena titles, short arena tips, white terminal teleports, collapse return, numbered combat self-use and expedition build grouping. Filling is intentionally provisional.

## Evidence

`check:task-068`, `check:inventory`, `check:interaction`, `check:hud`, `check:i18n`, Browser E2E and managed game preview.

## Not fixed

Persistent threshold repair, actual NPC encounters and island attachment, dedicated automation resources, T3 dangers, route-specific events, final reward economy, final arena art/layout, whistle behavior and native assets for additional expedition props.
