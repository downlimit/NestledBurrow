# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, guest behavior and payment feedback.

## Player-visible contract

```text
raw ingredient
→ preparation
→ cooking
→ dish on serving table
→ tavern open
→ guest path/find seat/eat
→ coin reward
```

## Owners

- kitchen state/rules: `cookingDomain.js`;
- minigame/presentation: `cookingRuntime.js`;
- facilities: `facilityConfig.js`, `facilityRuntime.js`;
- sign: `tavernSignRuntime.js`, `guestConfig.js`;
- guest flow/pathing: `guestRuntime.js`, `guestController.js`, `gridPathfinder.js`;
- payment: `coinRuntime.js`;
- wiring currently remains partly in `WorldScene`.

## Invariants

- kitchen quantities are non-negative JSON-safe values;
- facility positions are read live, so moved furniture changes service targets;
- guest path replans when furniture changes;
- sign, dish reservation and service lifecycle cannot contradict each other;
- a larger queue/menu/economy feature must introduce a service coordinator instead of expanding `src/main.js`.

## Current baseline

Potato preparation and frying minigames, serving table, persistent kitchen state, open/closed sign, one guest, eating and a coin reward work end-to-end.

## Not yet

Recipe book, ingredient variety, storage, guest preferences, prices, queueing, staff, persistent economy and venue style/audience.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`; `cooking-flow.spec.js` and `guest-service.spec.js`.
