# Wild Atoll expedition system

## Purpose

Owns repeatable expeditions connecting home preparation, compact arenas, route discovery and persistent access to deeper segments.

## Terms

A **segment** is a literary named zone containing roughly `6-8` connected arenas. An **arena** is one compact playable location inside that segment. Segment names establish place and mood; arena names and exit tips stay short and practical.

## Product loop

```text
home preparation -> Atoll run -> materials/discoveries -> tavern and island development -> deeper run
```

Food, tools, consumables, information and relationships prepared at home must alter expedition options. Coins prove the tavern works as a business; Atoll materials enable physical development.

## Long-term topology

```text
Island Nest
└─ starter segment
   ├─ Forest T1 -> Forest T2 -> Forest T3 / automation branch
   └─ Mines T1 -> Mines T2 -> Mines T3 / automation branch
```

T1, T2 and later resource segments use the same approximate arena count. The starter is shorter only because it is a warm-up. NPC segments remain separate terminal routes; only their island owners may attach an island to the Enclave.

## Arena contract

- movement and work spend energy through existing movement/needs owners;
- wood, stone, berries and later rewards exist as world objects that may be harvested or ignored;
- logs and stones use the same `DebrisRuntime`, HP, targeting outline, hit feedback, cooldown, energy and reward flow as every other location;
- route transitions never subtract an estimated cost or reveal resource counts in text;
- exits identify only the next arena or segment with a short interaction tip;
- travel within a segment is forward-only: a chosen path cannot be reversed;
- each completed segment ends in a terminal arena that may omit resources and offers onward routes plus a white return teleport to Island Nest.

## First production slice

The starter segment contains eight arenas in a one-way `1 -> 2 -> 2 -> 2 -> 1` graph. Cross-links allow different forward routes to reconverge without permitting backtracking.

```text
Fringe
├─ Meadow ─┬─ Pond ───┬─ Roots ─┐
└─ Stones ─┴─ Thicket ┴─ Scree ─┴─ Pass
                                      ├─ Forest T1 entrance
                                      ├─ Mines T1 entrance
                                      └─ white teleport -> Island Nest
```

The first seven arenas contain small deterministic mixtures of ordinary logs, stones and berry bushes. The Pass is the terminal decision arena and contains no required resources. Forest T1 and Mines T1 entrances are visible and named, while their internal arena graphs remain outside this slice.

`src/world/atollWorldLayout.js` owns the isolated transport-free collision space. `src/world/wildAtollDomain.js` owns segment topology and deterministic common resource definitions. `src/world/wildAtollRuntime.js` owns transient arena choice, short exit presentation, registration of resources with `DebrisRuntime`, the terminal teleport and collapse return.

## Collapse return

Collapsing on the Atoll starts sleep immediately so movement stops, but visible time remains at normal speed during a five-second fade to black. Behind black, the game simulates the remaining knockout time through the ordinary clock and needs owners, wakes the character in Island Nest, holds black briefly, then fades in over three seconds.

## Inventory and preparation

- `10` peaceful slots plus `6` numbered combat slots; no weight system;
- four combat action slots accept weapons;
- axe, pickaxe, hoe, bucket, food, materials and findings compete for ordinary capacity;
- stable combat mode allows supported numbered items to be used on the character;
- current self-use profiles: cooked potato dish restores `25 S`; one bucket-water unit restores `20 L`.

## Invariants

- starter topology is `1/2/2/2/1` and contains eight unique arenas;
- all internal paths advance exactly one level; no arena has a back exit;
- only the terminal starter arena has its Nest teleport;
- terminal arena exposes exactly Forest T1, Mines T1 and home return;
- represented resources use the common resource owner and never overlap spawn corridors;
- arena transitions do not mutate needs directly;
- transient run state is not serialized;
- expedition capacity remains slot-based.

## Current baseline

The production slice contains the one-way starter segment, its physical common resources, its terminal Forest/Mines entrances, white home teleport, collapse return, numbered combat self-use and expedition build grouping. Forest T1/Mines T1 internals, T2 routes, persistent thresholds, NPC routes and terminal branches remain future work.

## Evidence

`check:task-068`, `check:inventory`, `check:interaction`, `check:hud`, `check:i18n`, Browser E2E and managed game preview.

## Not fixed

Persistent run schema, threshold repair, T1/T2 arena content, encounters, final reward economy, final arena art/layout, whistle behavior and native assets for additional expedition props.
