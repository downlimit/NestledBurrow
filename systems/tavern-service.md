# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, guest scheduling/behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → serving table → dine-in guest → 4 coins
lemon + bucket water → juicer → serving table → takeout guest → 2 coins
```

## Owners

- kitchen state/rules: `cookingDomain.js`;
- minigame/presentation: `cookingRuntime.js`;
- fixed kitchen interaction delegation: `kitchenInteractionRuntime.js`;
- facilities: `facilityConfig.js`, `facilityRuntime.js`;
- sign: `tavernSignRuntime.js`, `guestConfig.js`;
- guest flow/pathing: `guestRuntime.js`, `guestController.js`, `gridPathfinder.js`;
- scheduling and orchestration: `tavernServiceDomain.js`, `tavernServiceRuntime.js`;
- guest reaction/carried-item presentation: `guestFeedback.js`;
- payment: `coinRuntime.js`;
- `WorldScene` composes owners and delegates updates and callbacks.

## Invariants

- kitchen stock is JSON-safe and owned by stable serving-table ID: each table holds zero or one portion and its stable guest reservation;
- recipes consume inputs and publish outputs atomically through inventory operations;
- facility positions are read live by reserved table ID, so moved furniture changes only its assigned guest path;
- sign, stock reservation and service lifecycle cannot contradict each other;
- guests use persisted stable IDs, arrive in waves of one or two every three to eight seconds, never exceed six active visits, and spawn only against unreserved stock;
- dine-in guests reserve distinct dining-table IDs before consuming a dish; a table currently used by the player is excluded from new seat assignments, and the player cannot start using a guest-reserved table;
- lemonade is takeout worth two coins; a fried potato dish is dine-in worth four.

## Current baseline

Potato preparation/frying and lemon juicing feed real inventory items into independently stocked single-portion serving tables. A finite six-lemon starter sack, persistent stove repair, table-routed multi-guest service, lemonade takeout, conflict-free potato dine-in and value-bearing coin rewards work end-to-end.

## Not yet

Recipe book, broader ingredient variety, storage, guest preferences, configurable prices, staff and venue style/audience.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`; focused Task #058 Browser E2E.
