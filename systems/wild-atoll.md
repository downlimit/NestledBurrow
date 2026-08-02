# Wild Atoll expedition system

## Purpose

Owns repeatable expeditions connecting home preparation, compact arenas, route discovery and access to deeper segments.

## Terms

A **segment** is a literary named zone containing connected arenas. An **arena** is one compact playable location inside that segment.

A **path** connects two arenas inside one segment. A **threshold** is the final arena of a segment. A **transition** is an onward transport on a threshold that enters another segment. A **teleport** returns the player from a threshold to Island Nest.

Segment names establish place and mood; arena names and path tips stay short and practical. A threshold name describes the place already reached, never a destination still supposedly ahead.

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
   │  ├─ Лесистая Перейма -> NPC threshold -> teleport to Nest
   │  └─ Дремучие Шхеры
   │     ├─ Моту -> teleport to Nest
   │     └─ Грозные Шхеры -> teleport to Nest
   └─ Безмятежный Грот
      ├─ Теневая Перейма -> NPC threshold -> teleport to Nest
      └─ Глубокий Грот
         ├─ Голубая дыра -> teleport to Nest
         └─ Реликтовый Грот -> teleport to Nest
```

All canonical named segments are traversable. `Лесистая Перейма` and `Теневая Перейма` are terminal NPC segments. Their thresholds are the reached NPC islands themselves and expose only the teleport to Island Nest. Actual random NPC selection, dialogue and island attachment are future encounter work.

## Segment format

Every implemented segment contains eight arenas in a forward-only `1 -> 2 -> 2 -> 2 -> 1` graph. Cross-links allow routes to reconverge without creating a back path.

- the first seven arenas contain a lightweight mixture of ordinary resource nodes;
- the eighth arena is the threshold and may contain no resources;
- every threshold contains a white teleport to Island Nest;
- starter, T1 and T2 thresholds also expose their canonical onward transitions;
- NPC, automation and T3 thresholds expose only the teleport;
- entering a transition resets the player to the next segment's entry arena while preserving the same transient run.

## Path composition

A two-path arena never presents two mirrored diagonal exits. It presents one straight northern path plus one diagonal path:

- a left-side arena uses north and north-east;
- a right-side arena uses north-west and north;
- the entry arena and threshold transitions use north plus the diagonal selected by that segment's composition.

This keeps the route readable while preventing every arena from repeating the same north-west/north-east fork.

## Arena naming and mood

- starter names are plain orientation labels;
- T1 arena names are harmless and welcoming;
- T2 names suggest denser forest or deeper stone without presenting the branch as terminal danger;
- T3 names are mysterious and dangerous;
- NPC-segment arenas use floating-island landforms: necks, spurs, ridges, verges, scree and broken isthmuses, alongside tracks, lights and smoke that hint at habitation;
- the forest NPC threshold is the reached Roving Island; the grotto NPC threshold is the reached Wandering Island;
- NPC-segment copy must not introduce sea piers, pilings, bridges or shores as if these were waterbound islands;
- automation-segment names hint at soul stones, crystals, magnets, unusual metals and other future special materials.

Path tips display only `SPACE - <next arena>`. Transition tips display the canonical next segment name. Teleport tips name Island Nest. All compact labels use the supported ASCII hyphen and remain within the HUD length budget.

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
- paths and transitions never subtract an estimated cost or reveal resource counts in text;
- travel is forward-only: a chosen path or transition cannot be reversed;
- every threshold exposes the white return teleport.

`src/world/atollWorldLayout.js` owns the isolated transport-free collision space. `src/world/wildAtollDomain.js` generates the complete segment graph, path composition, transitions and deterministic common resource definitions. `src/world/wildAtollRuntime.js` owns transient traversal, exit presentation, resource registration, transitions, teleports and collapse return. Player-facing Atoll copy lives in the dedicated `atoll` localization namespace.

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
- every two-path arena contains one north exit and exactly one diagonal exit;
- no non-threshold arena has a home teleport;
- First Trails transitions to Безмятежные Шхеры and Безмятежный Грот;
- Безмятежные Шхеры transitions to Лесистая Перейма and Дремучие Шхеры;
- Дремучие Шхеры transitions to Моту and Грозные Шхеры;
- Безмятежный Грот transitions to Теневая Перейма and Глубокий Грот;
- Глубокий Грот transitions to Голубая дыра and Реликтовый Грот;
- NPC, automation and T3 thresholds contain no onward transitions;
- represented resources use the common resource owner and never overlap spawn corridors;
- paths and transitions do not mutate needs directly;
- transient run state is not serialized;
- expedition capacity remains slot-based.

## Current baseline

The production slice contains the complete canonical route tree, ordinary common-resource harvesting, literary arena titles, composed path placement, short path and transition tips, white threshold teleports, collapse return, numbered combat self-use and expedition build grouping. Filling is intentionally provisional.

## Evidence

`check:task-068`, `check:inventory`, `check:interaction`, `check:hud`, `check:i18n`, Browser E2E and managed game preview.

## Not fixed

Persistent threshold repair, actual NPC encounters and island attachment, dedicated automation resources, T3 dangers, route-specific events, final reward economy, final arena art/layout, whistle behavior and native assets for additional expedition props.
