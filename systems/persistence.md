# Persistence

## Purpose

This system separates player session progress from developer-authored project defaults.

## Session save

`gameSessionState.js` owns JSON-safe normalized state. `sessionPersistence.js` owns versioned envelopes, migrations, load/save/clear and safe fallback.

Session data includes player/world progress, needs, the ten-slot inventory, dropped world items, resource nodes, kitchen/sign/coin state and other gameplay fields explicitly added to the schema. The currently selected inventory slot and in-flight presentation state are transient.

## Authoring data

Starting layout, collider/profile drafts and authoring backups are developer tools. They may use browser storage and local dev write endpoints, but are not automatically part of gameplay construction save.

## `NEW GAME`

`NEW GAME` clears gameplay progress, restores the three starting tools and creates a fresh session while applying the current authored baseline. Browser authoring drafts may intentionally survive so the developer does not lose layout work.

## Invariants

- every persisted field has a normalized owner and migration path;
- Phaser objects/functions never enter JSON state;
- corrupted/old data fails safely;
- schema v6 resource counters migrate once into canonical inventory stacks in schema v7;
- dropped items persist only their stable ID, item payload and resting/logical position;
- selected slot, drag state, throw arc and fade timers are not persisted;
- authoring backup version is independent from session schema;
- a task crossing gameplay save and authoring storage is Strict and reads both this document and `systems/build-and-authoring.md`.

## Current baseline

Versioned session save/reload and migrations work. Inventory and dropped items survive reload. Authoring layout/profile backups restore across page reload and `NEW GAME`.

## Not yet

Gameplay save of arbitrary player construction, save slots, cloud sync and multiplayer ownership.

## Evidence

`check:inventory`, `check:progress`, domain-specific state checks, `check:authoring`, persistence Browser E2E.
