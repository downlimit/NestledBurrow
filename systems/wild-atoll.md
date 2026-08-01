# Wild Atoll expedition system

## Purpose

This system owns the repeatable expedition layer that connects tavern progression, preparation, procedural arenas, route discovery and persistent access to deeper segments.

## Product loop

The tavern and the Atoll must feed each other in both directions:

```text
starter T1 wood/stone
→ launch the first tavern service
→ earn coins

coins + Atoll materials
→ repair, build and improve tavern/production
→ earn money more efficiently and unlock better preparation

food, tools, consumables, information and relationships from home
→ survive deeper Atoll routes
→ return with better materials, discoveries, creatures and NPC opportunities
```

Coins prove that the tavern works as a business. Atoll materials prove that the player can physically develop it. Major upgrades normally require both, sometimes also a blueprint, NPC agreement or a rare material.

A deeper expedition must not be reachable on the first visit. Persistent transport-platform repair, preparation quality and route knowledge create multi-run progression. Exact repair costs and the final depth curve remain balance data, but the graph must require more than one expedition before its terminal T3/automation destinations become available.

## Topology

- **Island Nest** is the permanent entry segment. Its internal `4–6` arenas regenerate each run; its final threshold is persistent.
- Each ordinary segment has `4–6` regenerated arenas followed by one persistent threshold arena.
- A threshold contains a return totem and a transport platform. Platform repair survives between runs and unlocks only the graph exits assigned to that segment.
- Terminal T3, automation and NPC branches return to the Nest.

```text
Island Nest
├─ Forest T1
│  ├─ forest NPC segment → NPC island → Nest
│  └─ Forest T2
│     ├─ Forest T3 → Nest
│     └─ forest automation resources → Nest
└─ Mines T1
   ├─ grotto NPC segment → NPC island → Nest
   └─ Mines T2
      ├─ Mines T3 → Nest
      └─ grotto automation resources → Nest
```

An NPC segment is a separate terminal route, not an NPC clearing inside T1/T2. Only the owner of that dedicated NPC island can offer island attachment to the Enclave. Lost travellers may still appear inside resource segments for conversation, trade, escort, a tavern invitation or a future event, but never for island attachment.

## Arena contract

The Atoll is Sims-like life simulation expressed through compact arenas. The player enters with a plan; a visible world event changes the value or availability of actions; the player revises the plan. Challenge comes from concrete causes and consequences, not from abstract arena labels such as “quiet actions cost more”.

Good events change at least one real object, route, obligation or opportunity:

- rain fills a bucket and restores lustre but washes off blue-clay camouflage;
- a timid creature occupies useful trees, so chopping may scare it away;
- a cracked support can be reinforced or risked for ore, with a possible blocked exit;
- a lost traveller restores dialogue but creates an escort obligation and occupies cargo space;
- a stream reveals one cache while flooding another route;
- a camp restores energy but consumes wood, time and lustre;
- an isolated hollow resolves toilet pressure but lowers lustre and leaves a scent that animals can react to.

Needs determine the current value of these opportunities. They do not replace the event with generic percentage penalties. Low values may create compensating opportunities, but deliberate pre-run starvation is not rewarded: valuable low-need interactions should normally depend on crossing or creating the situation during the current run, then exploiting and resolving it.

## Inventory and preparation

- The player carries `10` peaceful slots and `6` numbered combat slots.
- Four combat action slots accept weapons only.
- Weapons may occupy ordinary/numbered slots, but cannot attack until equipped in an action slot.
- Axe, pickaxe, hoe, bucket, food, bait, mixtures, repair materials and expedition findings compete for ordinary capacity.
- Stack limits and item shape create preparation choices; the game has no weight system.

The tavern/home side prepares expeditions through cooked food, portable need conversions, bait, gifts, route rumours, blueprints, tools and NPC relationships. Atoll rewards include construction resources, new ingredients, animals, NPC access, recipes, automation materials and information—not only larger quantities of T1 wood or stone.

## Prototype

`WildAtollPrototype/index.html` is a dependency-free standalone logic prototype. It is an exploration aid, not runtime architecture and not authoritative balance. Its route topology, slot model and event philosophy should reflect this document; individual prices, probabilities and resource counts may be changed freely during design work.

## Not yet fixed

- exact platform repair stages, costs and work time;
- exact T2/T3 mine resource profiles;
- final event pools and encounter weights;
- final item stack limits and expedition reward economy;
- production implementation owners and persistence schema.
