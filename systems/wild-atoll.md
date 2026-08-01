# Wild Atoll expedition system

## Purpose

Owns repeatable expeditions connecting tavern progression, preparation, procedural arenas, route discovery and persistent access to deeper segments.

## Product loop

```text
starter T1 wood/stone → launch tavern → earn coins
coins + Atoll materials → improve tavern/production
home food, tools, consumables, information and relationships → deeper runs
runs → better materials, discoveries, creatures and NPC opportunities
```

Coins prove the tavern works as a business; materials enable physical development. Major upgrades normally require both, sometimes also a blueprint, NPC agreement or rare material.

The tavern must prepare expeditions, not only produce money: cooked food, portable need conversions, bait, gifts, tools, route rumours and relationships. Atoll rewards include construction resources, ingredients, animals, NPC access, recipes, automation materials and information—not merely more T1 wood/stone.

Terminal T3/automation destinations cannot be reached on the first visit. Persistent platform repair, preparation and route knowledge make depth a multi-run progression. Exact costs remain balance data.

## Topology

- Island Nest is the permanent entry segment. Its internal `4–6` arenas regenerate each run; its final threshold persists.
- Every ordinary segment has `4–6` regenerated arenas plus one persistent threshold arena.
- A threshold contains a return totem and transport platform. Repair persists between runs and unlocks only assigned exits.
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

An NPC segment is a separate terminal route, not a clearing inside T1/T2. Only its island owner can offer island attachment to the Enclave. Lost travellers may appear in resource segments for conversation, trade, escort, tavern invitation or future events, but never island attachment.

## Arena contract

The Atoll is Sims-like life simulation expressed through compact arenas:

```text
player makes a plan → visible world event changes options/value → player revises plan
```

Challenge comes from concrete causes and consequences, not abstract labels such as “quiet actions cost more”. Good events change an object, route, obligation or opportunity:

- rain fills a bucket and restores lustre but washes off blue-clay camouflage;
- a timid creature occupies useful trees, so chopping may scare it away;
- a cracked support can be reinforced or risked for ore, possibly blocking an exit;
- a traveller restores dialogue but creates escort/cargo obligations;
- a stream reveals one cache while flooding another route;
- a camp restores energy but consumes wood, time and lustre;
- improvised toilet relief restores T but lowers L and leaves scent animals can use.

Needs determine current opportunity value; they do not replace events with generic percentage penalties. Useful low-need situations should normally be created/crossed during the run, exploited, then resolved, so entering nearly empty is not optimal.

## Inventory and preparation

- `10` peaceful slots + `6` numbered combat slots; no weight system.
- Four combat action slots accept weapons only.
- A weapon may be stored elsewhere but cannot attack until equipped in an action slot.
- Axe, pickaxe, hoe, bucket, food, bait, mixtures, repair materials and findings compete for ordinary capacity.
- Stack limits and item roles create preparation decisions.

## Prototype

`WildAtollPrototype/index.html` is a dependency-free standalone logic prototype. It is a design aid, not Phaser runtime architecture and not authoritative balance. Topology, slot model and event philosophy follow this document; prices/probabilities may change freely.

## Invariants

- first-run access cannot skip persistent depth progression;
- terminal branches always return to the Nest;
- only dedicated NPC segments attach islands;
- events have visible causes and durable/local consequences;
- needs change decision value without becoming six bars to keep green;
- expedition capacity is slot-based, never weight-based.

## Current baseline

The production game has no Wild Atoll runtime yet. The standalone prototype demonstrates route generation, persistent platform repair, slot pressure, N/E/S/T/L/D feedback and plan-changing encounters.

## Evidence

`check:docs`; standalone `WildAtollPrototype/app.js` syntax check; PR browser/static preview. Production checks will be added with the first runtime slice.

## Not fixed

Exact platform costs/work time, T2/T3 mine profiles, encounter weights, final stack limits/reward economy, production owners and persistence schema.
