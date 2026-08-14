# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, visitor demand, guest behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → serving table → dine-in guest → 4 coins
lemon + bucket water → juicer → serving table → takeout guest → 2 coins
```

The current stock-triggered guest flow is a technical baseline. The intended model reverses that causality: a persistent person first decides to visit, then creates demand that the tavern may or may not satisfy.

## Demand terminology

These terms are canonical. They describe different stages of the same person and must not be used interchangeably.

- **Visitor population (`visitorPopulation`)** — the finite persistent set of people who can visit the player's tavern. These are recurring people, not disposable customer instances. The initial target scale is roughly one hundred people, but the exact count remains a balance parameter.
- **Visitor (`visitor`)** — one persistent person from that population, whether currently visible or not. A visitor keeps stable identity, preferences, spending capacity, social influence, visit history and the last stored state of their needs.
- **Candidate (`candidate`)** — a visitor currently being considered for a possible visit. Becoming a candidate does not guarantee arrival.
- **Guest (`guest`)** — a visitor who has actually committed to a visit and entered the live tavern flow. A guest keeps the same persistent identity as the visitor they came from.
- **Needs (`needs`)** — changing personal pressures such as hunger, toilet, social contact, energy and novelty. Hunger is the primary reason to consider a food visit; other needs can alter the decision or create additional behavior after arrival.
- **Visit opportunity (`visitOpportunity`)** — one chance for somebody in the population to consider the tavern. This is the unit produced by popularity over time. It is not a spawned customer.
- **Popularity (`popularity`)** — how widely known and considered the tavern is. It controls the frequency of visit opportunities. It does not directly make a specific person like the tavern, increase their budget or guarantee a visit.
- **Menu fit (`menuFit`)** — how well the currently offered dishes fit one person's food preferences and spending capacity. A large inventory outside the active menu does not improve menu fit.
- **Visit memory (`visitMemory`)** — that person's remembered experience of prior visits: whether service was completed, how satisfied they were and how recently they visited. It affects later decisions by the same person.
- **Recent-visit suppression (`recentVisitSuppression`)** — a soft temporary reduction in the chance that the same person returns immediately. It fades with world time rather than acting as a hard cooldown.
- **Audience profile (`audienceProfile`)** — the accumulated tendency of the tavern to attract particular kinds of people. Repeatedly satisfying visitors with similar tastes can increase future representation of similar tastes among candidates. This changes the composition of demand, whereas popularity changes its volume.
- **Spending capacity (`spendingCapacity`)** — the amount or price range a person is willing and able to spend. It belongs to the visitor, not to tavern popularity.
- **Influence (`influence`)** — how strongly one person's completed experience can affect popularity and the audience profile. It does not change the value of the meal they personally bought.
- **Potential demand (`potentialDemand`)** — people who currently want and are willing to visit before physical tavern constraints are applied.
- **Service capacity (`serviceCapacity`)** — how many of those willing visitors the tavern can actually accept and process, given seats, kitchen throughput, staff and other physical limits. Popularity may exceed service capacity without creating impossible simultaneous crowds.

## How demand is formed

The causal order is fixed even though the eventual balance formulas are not yet fixed.

```text
tavern is open
→ popularity produces a visit opportunity
→ one persistent visitor becomes a candidate
→ offscreen needs are reconstructed for that person
→ current hunger and other needs are evaluated
→ active menu is compared with that person's tastes and budget
→ their own visit memory and recent-visit suppression are applied
→ the person decides whether to visit
→ service capacity determines whether the visit can currently be accepted
→ the same persistent person enters the world as a guest
→ live needs and service behavior run during the visit
→ the completed experience updates that person's memory
→ satisfaction may change popularity and audience profile, weighted by influence
```

The system therefore separates **volume** from **composition**:

- popularity answers **how often the tavern gets a chance to attract somebody**;
- the visitor's current state answers **whether this concrete person wants to go out now**;
- menu, prices, preferences and memory answer **whether this concrete tavern is suitable for them**;
- audience profile answers **which kinds of people become more represented among future candidates**;
- service capacity answers **how much of existing demand can actually be converted into served guests and money**.

Higher popularity must not silently create wealthier people. Expensive demand grows when the tavern becomes attractive to existing visitors with higher spending capacity and suitable preferences.

## Persistent people without full offscreen simulation

Visitors remain real persistent people even while offscreen, but their complete life is not simulated frame by frame.

For each visitor the save keeps the last relevant state and time of evaluation. When that person next becomes a candidate, their current needs are reconstructed from:

1. the stored need values;
2. elapsed world time;
3. that person's own need rates or traits when such traits exist;
4. bounded variation so different visits do not become mechanically identical.

While the person is physically present, their needs and behavior are live. A guest may therefore arrive hungry while also needing the toilet, social contact or rest, creating situations that are not authored as one-off scripts.

This reconstruction is an optimization boundary, not a fiction boundary: the game treats the visitor as the same person before, during and after every visit.

## Responsibility and negative feedback

- A closed tavern creates no penalty because it has accepted no obligation.
- An unavailable dish before an order is accepted creates no service failure.
- Once the tavern accepts an order or equivalent commitment, failure to fulfill it may reduce satisfaction and affect future memory, popularity or audience profile.
- Missed revenue is already a consequence of demand that the tavern cannot serve; extra reputation punishment is added only for an actual failed commitment.

## First implementation slice

The first playable replacement for anonymous stock-triggered spawning should prove identity and demand causality before implementing the whole simulation.

It should use a small persistent test population and only these visitor properties:

- stable identity;
- hunger;
- food preferences;
- spending capacity;
- last visit time / recent-visit suppression;
- simple visit memory.

Popularity may initially use one simple tunable opportunity rate. Secondary needs, influence, audience-profile learning and richer popularity curves are deliberately deferred until persistent visitors can already decide to visit from hunger + menu fit + budget + memory and then complete the existing service flow.

The first success criterion is therefore:

> Opening the tavern no longer creates a compatible anonymous customer because food exists. It gives known persistent people opportunities to consider the tavern; a concrete person chooses to visit for understandable reasons and returns later as the same person.

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
- the current technical baseline uses persisted guest IDs, waves of one or two every three to eight seconds, at most six active visits and stock-triggered spawning; this rule is intentionally superseded by the target demand model when that model is implemented;
- dine-in guests reserve distinct dining-table IDs before consuming a dish; a table currently used by the player is excluded from new seat assignments, and the player cannot start using a guest-reserved table;
- lemonade is takeout worth two coins; a fried potato dish is dine-in worth four.

## Current baseline

Potato preparation/frying and lemon juicing feed real inventory items into independently stocked single-portion serving tables. A finite six-lemon starter sack, persistent stove repair, table-routed multi-guest service, lemonade takeout, conflict-free potato dine-in and value-bearing coin rewards work end-to-end.

## Not yet

Recipe book, broader ingredient variety, storage, persistent visitor population, need-driven demand, visitor preferences/budgets/influence, popularity and audience profile, configurable prices, staff and venue style/audience.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`; focused Task #058 Browser E2E.
