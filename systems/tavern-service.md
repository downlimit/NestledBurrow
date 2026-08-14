# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, guest scheduling/behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → serving table → dine-in guest → 4 coins
lemon + bucket water → juicer → serving table → takeout guest → 2 coins
```

## Target demand model

The current stock-triggered guest waves are a technical baseline, not the intended demand model.

- A save owns a finite persistent population of potential visitors. The initial scale is expected to be roughly one hundred distinct people, but the exact count is a balance parameter rather than a system invariant.
- Every person keeps a stable identity and profile: preferences, spending capacity, social influence, visit history and last known needs. Repeat visits therefore belong to the same person rather than to a newly generated anonymous customer.
- Visitors have real needs. A food visit requires meaningful hunger, while secondary needs such as toilet, social contact, energy or novelty can be in different states and create additional behavior during the visit.
- Offscreen life is not simulated frame by frame. When a person becomes a candidate for a visit, current needs are reconstructed from the last persistent state, elapsed world time and bounded variation; while present in the world, the person uses actual live state and behavior.
- Opening the tavern creates opportunities for potential visitors to consider it. Popularity controls how many such opportunities occur over time; it does not directly manufacture customers or change their wealth.
- A concrete person chooses whether to visit from their current needs, menu and price fit, personal preferences and remembered experience. Venue identity and accumulated audience affinity change which kinds of people are more likely to choose the tavern.
- Spending capacity belongs to the person. Higher popularity primarily increases reach and visit volume; more valuable demand emerges from matching the venue to people who already have the relevant budget and preferences.
- A completed visit updates personal memory. Satisfaction can change future popularity and audience affinity, weighted by the visitor's influence. A closed tavern creates no penalty; negative service consequences begin only after the tavern has accepted an obligation it fails to fulfill.
- The system must preserve recognizable people and repeat history. Anonymous scripted customers are allowed only as temporary implementation scaffolding.

## Owners

- kitchen state/rules: `src/tavern/cookingDomain.js`;
- minigame/presentation: `src/tavern/cookingRuntime.js`;
- fixed kitchen interaction delegation: `src/tavern/kitchenInteractionRuntime.js`;
- facilities: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`;
- sign: `src/tavern/tavernSignRuntime.js`, `src/tavern/guestConfig.js`;
- guest flow/pathing: `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`;
- scheduling and orchestration: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`;
- guest reaction/carried-item presentation: `src/tavern/guestFeedback.js`;
- payment: `src/tavern/coinRuntime.js`;
- `WorldScene` composes owners and delegates updates and callbacks.

## Invariants

- kitchen stock is JSON-safe and owned by stable serving-table ID: each table holds zero or one portion and its stable guest reservation;
- recipes consume inputs and publish outputs atomically through inventory operations;
- facility positions are read live by reserved table ID, so moved furniture changes only its assigned guest path;
- the build-mode movable tavern sign owns one live position shared by its visual, collider, interaction and guest check point;
- sign, stock reservation and service lifecycle cannot contradict each other;
- guests use persisted stable IDs, arrive in waves of one or two every three to eight seconds, never exceed six active visits, and spawn only against unreserved stock;
- dine-in guests reserve distinct dining-table IDs before consuming a dish; a table currently used by the player is excluded from new seat assignments, and the player cannot start using a guest-reserved table;
- lemonade is takeout worth two coins; a fried potato dish is dine-in worth four.

## Current baseline

Potato preparation/frying and lemon juicing feed real inventory items into independently stocked single-portion serving tables. A finite six-lemon starter sack, persistent stove repair, table-routed multi-guest service, lemonade takeout, conflict-free potato dine-in and value-bearing coin rewards work end-to-end.

## Not yet

Recipe book, broader ingredient variety, storage, persistent visitor population, need-driven demand, visitor preferences/budgets/influence, popularity and audience affinity, configurable prices, staff and venue style/audience.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`; focused Task #058 Browser E2E.
