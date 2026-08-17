# Persistence

## Purpose

Separates player session progress from developer-authored project defaults.

## Session save

`src/session/gameSessionState.js` owns JSON-safe normalized state. `src/session/sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, population, inventory/world items, farm, kitchen, offer, tavern history/orders/feedback and coins. Accepted guests persist service format/place ownership; visit-local presentation and diagnostics are transient.

Stage 9 keeps family/status identity derived from `personId`. Existing persisted `ageYears` and `lastEvaluatedWorldTimeSeconds` now carry lifecycle progress; `lifeStage` is rederived from safe age progress. Missing/invalid age falls back to the canonical baseline and forged status/family copies are ignored.

Task #099 adds no structural save field, so schema remains v19. Existing v19 saves continue from their saved age without replaying earlier world time. Death, birth and relationship mutation need later persistence contracts.

BUILD/TEST view and person-inspection hover/pin/expansion are transient. TEST grants use gameplay fields; inspector edits use persistent population needs.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. Browser storage/dev write endpoints do not make them gameplay save data.

## `NEW GAME`

`NEW GAME` restores the canonical starting inventory/world, population, kitchen, tavern and economy state. Browser authoring drafts may intentionally survive.

## Invariants

- every persisted field has a normalized owner and migration path;
- Phaser objects/functions never enter JSON state and corrupted/old data fails safely;
- v6→v7 moves resource counters into inventory; v9→v10 migrates tools, water and kitchen stock; v10→v11 adds combat loadout; v11→v12 moves serving stock under canonical tables; v12→v13 creates the 16-person population; v13→v14 adds venue offer; v14→v15 adds demand/preferences/history; v15→v16 adds exact orders; v16→v17 adds tavern opinions/reputation/flow; v17→v18 derives relationships/visit periods; v18→v19 adds service format/place activity;
- within v19, valid `ageYears` is mutable lifecycle progress; `lifeStage` derives from it, invalid age recovers, and identity-owned status/family cannot be forged;
- active guest IDs, reservations, orders and service ownership survive compatible migrations without duplicate physical ownership;
- the Task #049 warning persists until presentation;
- dropped items persist stable ID, item payload and logical position; selection, drag, throw and feedback presentation do not;
- authoring backup version is independent from session schema.

## Current baseline

Schema v19 persists people and lifecycle age progress alongside offer, feedback/flow, history, active guest mappings, station ownership, inventory, farm, kitchen and coins. Group diagnostics stay transient; authoring backups survive `NEW GAME`.

## Not yet

Arbitrary player-construction gameplay saves, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, `check:task-049`, `check:task-086`, `check:task-088`, `check:task-089`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-098`, `check:task-099`, domain checks, `check:authoring`, persistence Browser E2E.
