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

## First production slice

The Phaser runtime currently treats Island Nest as the entry clearing of one transient prototype run:

- a forecast point exposes the concrete costs and resource bias of both available roads;
- cave prompts select Misty Grove or Stony Passage without leaving the current world lifecycle;
- route entry applies visible need consequences: Misty Grove restores up to `20 L` and costs `5 E`; Stony Passage costs `10 E`;
- route grass is generated from a run seed, blocks movement and is removed only by an affordable sword action;
- every grass cell has a deterministic `60%` drop attempt; Misty Grove resolves successful drops as `75% wood / 25% stone`, while Stony Passage reverses that ratio;
- the route return cave restores the entry clearing, while leaving Island Nest ends the transient run and creates a fresh seed on the next visit.

`src/world/wildAtollDomain.js` owns deterministic route/drop rules. `src/world/wildAtollRuntime.js` owns transient entry/route state, cave prompts, grass presentation/colliders and inventory delivery. This slice deliberately reuses Island Nest instead of introducing the final multi-location arena graph.

## Inventory and preparation

- `10` peaceful slots + `6` numbered combat slots; no weight system.
- Four combat action slots accept weapons only.
- A weapon may be stored elsewhere but cannot attack until equipped in an action slot.
- Axe, pickaxe, hoe, bucket, food, bait, mixtures, repair materials and findings compete for ordinary capacity.
- Stack limits and item roles create preparation decisions.
- In stable combat mode, number slots `1–6` can apply supported items directly to the character. The current prototype profiles are cooked potato dish → `+25 S`, and one bucket-water unit → `+20 L`.

## Prototype

`WildAtollPrototype/index.html` remains a dependency-free standalone logic prototype. It is a design aid, not Phaser runtime architecture and not authoritative balance. Topology, slot model and event philosophy follow this document; prices/probabilities may change freely.

## Invariants

- first-run access cannot skip persistent depth progression once the full graph exists;
- terminal branches always return to the Nest;
- only dedicated NPC segments attach islands;
- events have visible causes and durable/local consequences;
- needs change decision value without becoming six bars to keep green;
- expedition capacity is slot-based, never weight-based;
- transient prototype grass and route state are not serialized;
- sword energy affordability is checked by the existing needs owner before grass removal.

## Current baseline

The production game contains the first in-world route-choice and grass-harvest slice described above. It proves forecast-driven road choice, need consequences, deterministic resource bias, sword exploration and quick-use preparation. It does not yet implement the persistent threshold graph, regenerated multi-arena segments, NPC routes or terminal branches.

## Evidence

`check:task-068`, `check:inventory`, `check:hud`, `check:build-mode`, `check:i18n`; standalone `WildAtollPrototype/app.js` syntax check; managed game preview.

## Not fixed

Exact platform costs/work time, T2/T3 mine profiles, encounter weights, final stack limits/reward economy, persistent run schema, final arena layout, whistle behavior, and native assets for additional expedition objects.
