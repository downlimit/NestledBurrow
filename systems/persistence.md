# Persistence

## Purpose

This system separates player session progress from developer-authored project defaults.

## Session save

`gameSessionState.js` owns JSON-safe normalized state. `sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, peaceful inventory, combat loadout, dropped items, resources, farm/water state, kitchen serving stock and repair, tavern sign, guest service snapshots and coins. Selected slot and in-flight presentation state are transient.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. They may use browser storage and local dev write endpoints, but are not automatically part of gameplay construction save.

## `NEW GAME`

`NEW GAME` clears gameplay progress and restores four tools, four potato seeds, a dry eight-use water bucket, six lemons in the fixed kitchen sack, a broken stove and an empty service table. Browser authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration path;
- Phaser objects/functions never enter JSON state and corrupted/old data fails safely;
- schema v6 resource counters migrate once into canonical inventory stacks in schema v7;
- schema v9 migrates once to v10: watering can becomes the water bucket, missing tools are inserted without duplicates, legacy prepared/cooked outputs become inventory or deterministic kitchen-adjacent world items, and the serving boolean becomes typed stock;
- schema v10 preserves active guest IDs and matching reservations; orphan reservations are discarded;
- schema v10 migrates once to v11 by adding an empty ten-slot combat loadout; later drag swaps persist the single physical item owner across peaceful and combat slots;
- schema v11 migrates once to v12 by moving one legacy serving portion under the canonical table ID and returning overflow portions to inventory or the world; guest snapshots persist serving and dining table assignments;
- the one-time Task #049 migration warning is persisted as pending state and cleared after presentation;
- dropped items persist only stable ID, item payload and logical position;
- selected slot, in-flight drag state, throw arc, gain feedback and fade timers are not persisted;
- authoring backup version is independent from session schema.

## Current baseline

Schema v12 save/reload and migrations work. Peaceful inventory, combat loadout, dropped items, farm water/crops, per-table kitchen stock/repair and active table-routed service snapshots survive reload. Authoring backups survive page reload and `NEW GAME`.

## Not yet

Gameplay save of arbitrary player construction, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, domain-specific checks, `check:authoring`, persistence Browser E2E.
