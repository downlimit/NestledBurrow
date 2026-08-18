# Persistence

## Purpose

Separates player session progress from developer-authored project defaults.

## Session save

`src/session/gameSessionState.js` owns JSON-safe normalized state. `src/session/sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, population, inventory/world items, farm, kitchen, offer, tavern history/orders/feedback and coins. Accepted guests persist service format/place ownership; visit-local presentation and diagnostics are transient.

Stage 9 keeps variable persistent population inside the existing `gameplay.population` array. Person records persist age, alive/dead status, reciprocal family links, needs and demand preferences. The original named identities keep their canonical baseline links; generated residents keep validated reciprocal links.

Task #100 adds no new top-level save field, so schema remains v19. A pre-#100 v19 save containing only the named 16 is deterministically expanded once to the mature ~300-person baseline during normalization; generated IDs then prevent reseeding. Dead residents remain saved for family history, including rare deaths before old age, and births append new stable person IDs. Existing `ageYears` now has enough range to carry the longest ~102-day natural life without a structural migration.

BUILD/TEST view and person-inspection hover/pin/expansion are transient. TEST grants use gameplay fields; inspector edits use persistent population needs.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. Browser storage/dev write endpoints do not make them gameplay save data.

## `NEW GAME`

`NEW GAME` restores the canonical starting inventory/world, mature population, kitchen, tavern and economy state. Browser authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration path;
- Phaser objects/functions never enter JSON state and corrupted/old data fails safely;
- v6→v7 moves resource counters into inventory; v9→v10 migrates tools, water and kitchen stock; v10→v11 adds combat loadout; v11→v12 moves serving stock under canonical tables; v12→v13 creates persistent population; v13→v14 adds venue offer; v14→v15 adds demand/preferences/history; v15→v16 adds exact orders; v16→v17 adds tavern opinions/reputation/flow; v17→v18 derives relationships/visit periods; v18→v19 adds service format/place activity;
- within v19, lifecycle age/status and reciprocal generated-family links are mutable person state; valid `dead` persists at any age while invalid age/link data still recovers or is rejected by the population owner;
- active guest IDs, reservations, orders and service ownership survive compatible normalization without duplicate physical ownership;
- the Task #049 warning persists until presentation;
- dropped items persist stable ID, item payload and logical position; selection, drag, throw and feedback presentation do not;
- authoring backup version is independent from session schema.

## Current baseline

Schema v19 persists a variable multigeneration population alongside offer, feedback/flow, history, active guest mappings, station ownership, inventory, farm, kitchen and coins. Old 16-person v19 saves upgrade in place to the mature population without a schema bump.

## Not yet

Arbitrary player-construction gameplay saves, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-098`, `check:task-099`, `check:task-100`, domain checks, `check:authoring`, persistence Browser E2E.
