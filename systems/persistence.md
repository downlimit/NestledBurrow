# Persistence

## Purpose

This system separates player session progress from developer-authored project defaults.

## Session save

`src/session/gameSessionState.js` owns JSON-safe normalized state. `src/session/sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, the persistent population with evaluation timestamps and stable demand profiles, peaceful inventory, combat loadout, dropped items, resources, farm/water state, kitchen serving stock and repair, the active `venueOffer`, tavern sign, opportunity timer, completed/failed accepted-order history, person-backed guest snapshots with exact order/station/timer state and coins. Selected slot, last decision diagnostics, open menu modal and other in-flight presentation state are transient.

The BUILD/TEST panel view and person-inspection hover/pin/expansion are transient prototype UI state and add no schema fields. TEST item/coin grants mutate existing canonical gameplay fields; inspector edits mutate existing population needs and rebase the stored evaluation timestamp, so ordinary save/reload preserves their results.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. They may use browser storage and local dev write endpoints, but are not automatically part of gameplay construction save.

## `NEW GAME`

`NEW GAME` clears gameplay progress and restores four tools, four potato seeds, a dry eight-use water bucket, six lemons in the fixed kitchen sack, a broken stove, an empty service table and a `venueOffer` with fried potato and lemonade active. Browser authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration path;
- Phaser objects/functions never enter JSON state and corrupted/old data fails safely;
- schema v6 resource counters migrate once into canonical inventory stacks in schema v7;
- schema v9 migrates once to v10: watering can becomes the water bucket, missing tools are inserted without duplicates, legacy prepared/cooked outputs become inventory or deterministic kitchen-adjacent world items, and the serving boolean becomes typed stock;
- schema v10 preserves active guest IDs and matching reservations; orphan reservations are discarded;
- schema v10 migrates once to v11 by adding an empty ten-slot combat loadout; later drag swaps persist the single physical item owner across peaceful and combat slots;
- schema v11 migrates once to v12 by moving one legacy serving portion under the canonical table ID and returning overflow portions to inventory or the world; guest snapshots persist serving and dining table assignments;
- schema v12 migrates once to v13 by creating the valid 16-person Stage-1 population at the saved world time;
- schema v13 migrates once to v14 by adding the default two-item `venueOffer` while preserving population, needs, kitchen, tavern service and coins;
- schema v14 migrates once to v15 by adding deterministic spending/preferences, the opportunity timer, per-person visitor history and unique `personId`/acceptable items to active guest snapshots while preserving their technical IDs and service state;
- schema v15 migrates once to v16 by deriving one deterministic exact order for every retained active guest, preserving reservations/stations and adding zeroed failed-accepted-order history fields; accepted order item, status and elapsed fulfillment wait persist thereafter;
- the one-time Task #049 migration warning is persisted as pending state and cleared after presentation;
- dropped items persist only stable ID, item payload and logical position;
- selected slot, in-flight drag state, throw arc, gain feedback and fade timers are not persisted;
- authoring backup version is independent from session schema.

## Current baseline

Schema v16 save/reload and migrations work. The normalized food offer survives alongside stable population IDs, names, needs, budgets/preferences and evaluation timestamps. Opportunity state, objective completed/failed service history and active guest→person→exact-order mappings persist with assigned stations, remaining wait semantics, inventory, farm, kitchen stock/repair and coins. Authoring backups survive page reload and `NEW GAME`.

## Not yet

Gameplay save of arbitrary player construction, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, domain-specific checks, `check:authoring`, persistence Browser E2E.
