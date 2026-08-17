# Persistence

## Purpose

This system separates player session progress from developer-authored project defaults.

## Session save

`src/session/gameSessionState.js` owns JSON-safe normalized state. `src/session/sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, population demand/social/time/life profiles, inventory/world items, farm, kitchen, offer, tavern history/orders/feedback and coins. Accepted guests also persist service format/place ownership. Visit-local satisfaction, group diagnostics and presentation are transient.

Stage 9 keeps family/status identity derived from `personId`, while the already-persisted `ageYears` and `lastEvaluatedWorldTimeSeconds` now carry lifecycle progress. `lifeStage` is rederived from safe age progress on normalize/load. Missing or invalid age falls back to the canonical baseline; forged status/family copies remain ignored.

Task #099 adds no structural save field, so schema remains v19. Existing v19 saves already contain age/time fields; they continue from their saved age without replaying historical world time. Death, birth and relationship mutation need later persistence contracts.

BUILD/TEST view and person-inspection hover/pin/expansion are transient. TEST grants use existing gameplay fields; inspector edits use existing population needs and rebase evaluation time, so save/reload preserves results.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. Browser storage/dev write endpoints do not make them gameplay save data.

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
- schema v15 migrates once to v16 by deriving one deterministic exact order for every retained active guest, preserving reservations/stations and adding zeroed failed-accepted-order history fields;
- schema v16 migrates once to v17 by adding neutral tavern-owned opinions and descriptive reputation plus baseline bounded flow pressure while preserving progress;
- schema v17→v18 derives canonical relationships/visit periods while preserving all progress;
- schema v18→v19 adds accepted active-visit service format and service-place activity, deriving legacy commitments as assisted while preserving orders, reservations and outcomes;
- within schema v19, valid `ageYears` is mutable lifecycle progress; `lifeStage` is derived, invalid age recovers, and identity-owned status/family cannot be forged;
- the one-time Task #049 migration warning is persisted as pending state and cleared after presentation;
- dropped items persist only stable ID, item payload and logical position;
- selected slot, in-flight drag state, throw arc, gain feedback and fade timers are not persisted;
- authoring backup version is independent from session schema.

## Current baseline

Schema v19 persists people, lifecycle age progress, offer, feedback/flow, history, active guest→person→order→service-format mappings, station ownership, inventory, farm, kitchen and coins. Group diagnostics stay transient; authoring backups survive `NEW GAME`.

## Not yet

Gameplay save of arbitrary player construction, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-098`, `check:task-099`, domain-specific checks, `check:authoring`, persistence Browser E2E.
