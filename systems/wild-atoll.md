# Wild Atoll expedition system

## Purpose

Owns repeatable expeditions connecting tavern preparation, compact arenas, route discovery and persistent access to deeper segments.

## Product loop

```text
home preparation -> Atoll run -> materials/discoveries -> tavern and island development -> deeper run
```

Coins prove the tavern works as a business; Atoll materials enable physical development. Major upgrades normally require both, sometimes also a blueprint, NPC agreement or rare material. Food, tools, consumables, information and relationships prepared at home must alter expedition options.

## Long-term topology

```text
Island Nest
├─ Forest T1 -> Forest T2 -> Forest T3 / automation branch
└─ Mines T1 -> Mines T2 -> Mines T3 / automation branch
```

NPC segments are separate terminal routes. Only their island owners may attach an island to the Enclave. Lost travellers in resource segments may offer conversation, trade, escort or tavern opportunities without attaching an island.

## Arena contract

The Atoll uses compact traversable arenas. Challenge comes from visible world objects, routes and events. Text may identify an interaction, but it may not replace the represented object or predeclare an abstract cost.

- movement spends energy through the ordinary movement/needs runtime;
- chopping and mining spend energy through the existing physical-action owner;
- wood, stone, berries and later rewards exist as world objects that may be harvested or ignored;
- route transitions do not directly subtract guessed energy values;
- no forecast marker summarizes arena contents or announces counts that the player should discover spatially;
- needs alter current option value through concrete events and actions.

## First production slice

The current transient run begins from a cave in Island Nest and contains a three-arena starter path:

```text
edge clearing -> quiet grove -> fork
                              ├-> Forest T1 first clearing
                              └-> Mines T1 first chamber
```

- Edge Clearing and Quiet Grove contain a small visible mixture of logs, stones and berry bushes.
- Logs require the selected peaceful-inventory axe; stones require the pickaxe; berries are gathered directly.
- Cleared resources stay cleared while revisiting arenas during the same run.
- Only Edge Clearing can return to Island Nest.
- The fork contains exactly two cave/lift exits: Forest and Mines.
- Forest is wood/berry-biased; Mines are stone-biased.
- No arena transition applies a scripted need delta.
- Arena titles render below the top HUD and above the lower interaction/hotbar region.

`src/world/atollWorldLayout.js` owns a transport-free rectangular collision space. `src/world/wildAtollDomain.js` owns topology and deterministic resource placement. `src/world/wildAtollRuntime.js` owns the Nest entrance, transient arena state, internal transitions, world visuals/colliders, tool-gated harvesting and reward delivery. Entry and edge return use explicit `WorldLocationCoordinator.transitionTo` calls; no persistent lift is present beneath the arena presentation. The current arena/resource state is not serialized.

## Inventory and preparation

- `10` peaceful slots plus `6` numbered combat slots; no weight system.
- Four combat action slots accept weapons.
- Axe, pickaxe, hoe, bucket, food, materials and findings compete for ordinary capacity.
- Stable combat mode allows supported numbered items to be used on the character.
- Current self-use profiles: cooked potato dish restores `25 S`; one bucket-water unit restores `20 L`.

## Invariants

- the starter path precedes the Forest/Mines choice;
- the fork has exactly two destination lifts;
- only the edge arena returns to the Nest;
- represented resources are physically present and tool-gated;
- resource colliders never overlap arena spawn points;
- arena resource state persists within one run and resets between runs;
- route transitions do not mutate needs directly;
- Atoll arena layout contains no static transport visuals or triggers;
- transient run state is not serialized;
- expedition capacity remains slot-based.

## Current baseline

The production game contains the corrected starter path in an isolated Atoll world, two-way traversal, native wood/stone/berry harvesting, the Forest/Mines fork, numbered combat self-use and the expedition build grouping. Persistent thresholds, regenerated multi-arena segments, NPC routes and terminal branches remain future work.

## Evidence

`check:task-059`, `check:task-068`, `check:inventory`, `check:hud`, `check:build-mode`, `check:i18n`, Browser E2E and managed game preview.

## Not fixed

Persistent run schema, threshold repair, T2/T3 profiles, encounters, final reward economy, final arena art/layout, whistle behavior and native assets for additional expedition props.
