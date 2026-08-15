# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, venue offer, visitor demand, guest behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → serving table → dine-in guest → 4 coins
lemon + bucket water → juicer → serving table → takeout guest → 2 coins
```

Stage 4 uses the target causality: a persistent person first has a reason to go out, chooses one exact menu item, offers that order in person and creates a service commitment only after the player accepts it.

## Demand terminology

These terms are canonical. They describe different layers of the same system and must not be used interchangeably.

- **Population (`population`)** — the finite persistent set of people in the save. People are recurring identities rather than disposable customer instances. The initial target scale is roughly one hundred people, while the exact count remains a balance parameter. Population lifecycle belongs to the broader product contract; this system consumes people as potential visitors.
- **Person (`person`)** — one persistent individual from the population whether currently visible or not. A person keeps stable identity, needs, preferences, spending capacity, relationships and personal history.
- **Candidate (`candidate`)** — a person currently considering this venue. Becoming a candidate does not guarantee arrival.
- **Guest (`guest`)** — a person who has committed to a visit and entered the live venue flow. A guest keeps the same persistent identity and state as the person they came from.
- **Needs (`needs`)** — the canonical person needs defined by `systems/character-and-needs.md`. Food uses satiety/hunger as its main motive, but social contact, novelty, energy, toilet and lustre can also affect a visit or create behavior after arrival.
- **Visit motive (`visitMotive`)** — the concrete reason a person is considering the venue now. Hunger can create a food motive; future attractions such as karaoke, sauna, jacuzzi, exhibitions or other profession-specific services can satisfy different motives.
- **Visit opportunity (`visitOpportunity`)** — one chance for someone in the population to consider the venue. Popularity controls how often opportunities occur; an opportunity is not a spawned customer.
- **Popularity (`popularity`)** — how widely known and considered the venue is. It controls reach and therefore the volume of visit opportunities. It does not directly make a person like the venue, alter their wealth or guarantee arrival.
- **Reputation profile (`reputationProfile`)** — what the venue is known for. Reputation is descriptive rather than a single good/bad score: a rowdy place can repel one person while attracting another. Food style, calmness, social intensity, cleanliness, art focus or frequent conflict can all become relevant reputation dimensions later.
- **Personal venue opinion (`venueOpinion`)** — one person's own current attitude toward the venue, derived from remembered visits and direct interactions. Positive and negative opinions both drift gradually toward neutral when no reinforcing experience occurs.
- **Venue offer (`venueOffer`)** — what the venue currently promises or makes available: active menu items, displayed takeout goods, self-service food, entertainment, facilities, exhibitions or other supported services. Inventory that is not actually offered does not attract demand.
- **Food preference (`foodPreference`)** — a layered taste profile. Current target order is cuisine/origin as the strongest level, dish class such as hot food/cold food/drinks/desserts as the next level, and individual ingredients as the finer level. Exact weights are balance parameters.
- **Offer fit (`offerFit`)** — how well the current venue offer fits one person's motive, tastes and spending capacity. Prices are fixed by the game; affordability affects selection but is not itself a service failure.
- **Visit memory (`visitMemory`)** — the person's remembered history with the venue: completed service, satisfaction, conflicts, purchases and recency.
- **Recent-visit suppression (`recentVisitSuppression`)** — a soft temporary reduction in immediate repeat visits. It fades with world time rather than acting as a hard cooldown.
- **Spending capacity (`spendingCapacity`)** — the price range a person is willing and able to pay. It belongs to the person, not to popularity.
- **Influence (`influence`)** — how strongly a person's experience can spread through future social/reputation systems. It does not change the nominal value of their purchase.
- **Potential demand (`potentialDemand`)** — people who currently want and are willing to visit before physical venue constraints are applied.
- **Service capacity (`serviceCapacity`)** — how much willing demand the venue can actually process given seats, counters, kitchen throughput, staff, queues and other physical limits.
- **Group (`group`)** — two or more persistent people who choose to visit together. Group visits are a target behavior; group composition can create additional seating, social and service constraints.
- **Audience composition (`audienceComposition`)** — a derived description of the kinds of real people who currently tend to visit. It is not a separate spendable stat or a magic attraction score. It emerges from popularity, reputation, individual needs/preferences/opinions, time of operation and eventually social communication between people.

## How demand is formed

The causal order is fixed even though the eventual balance formulas are not yet fixed.

```text
venue is open or scheduled open
→ popularity produces a visit opportunity
→ one persistent person becomes a candidate
→ that person's offscreen needs are reconstructed
→ current needs create one or more possible visit motives
→ venue offer is compared with motive, tastes and spending capacity
→ reputation fit, personal venue opinion and recent-visit suppression are applied
→ the person decides whether to visit, alone or eventually with a group
→ service capacity determines whether the visit can currently be accepted
→ the same persistent person enters the world as a guest
→ all of that person's needs become live while present
→ service, facilities and other people produce an actual experience
→ the visit updates personal memory and opinion
→ the experience may affect popularity and reputation and later spread socially
```

The system separates four different questions:

- **Reach:** popularity answers how often the venue gets considered.
- **Motive:** the person's reconstructed needs answer why they want to go somewhere now.
- **Choice:** offer, tastes, budget, reputation and personal opinion answer why they choose this venue or reject it.
- **Conversion:** service capacity and actual service answer how much potential demand becomes completed visits and money.

Higher popularity must not silently create wealthier people. Expensive demand grows when the venue becomes suitable for existing people with higher spending capacity and matching motives.

A failed match also matters without requiring a punitive score. A person who arrives or considers the venue and finds nothing suitable simply creates missed revenue; repeated mismatches can later reduce similar future demand through personal memory, reputation and social propagation. Audience composition is the visible result of those individual mechanisms rather than an independently manipulated number.

## Persistent people without full offscreen simulation

People remain persistent while offscreen, but their complete life is not simulated frame by frame.

For each person the save keeps the last relevant state and evaluation time. When that person becomes relevant again — visit consideration, scene appearance, phone contact, invitation or another explicit interaction — their current state is reconstructed from the stored state, elapsed world time, person-specific traits when available and bounded variation.

Population members may later form relationships and families, age, reproduce and die through coarse offscreen progression. If the living population drops below the target range, new people may be generated to restore the population. Those lifecycle rules are broader than tavern service but the resulting people remain the same persistent identities consumed by demand.

While a person is physically present, all canonical needs are live. A guest may therefore arrive hungry while also urgently needing the toilet, wanting social contact or lacking energy. These combinations should create systemic situations rather than authored customer scripts.

## Venue formats

The target system supports several ways to turn an allod into a functioning venue. These are behavioral patterns produced by offer and infrastructure, not necessarily explicit mode switches.

- **Takeaway / unattended retail:** displayed food, refrigerator, counter or vending-style device; people inspect available goods, buy and leave with little or no table service.
- **Cafe / restaurant / bar:** the player chooses an active menu, prepares stock, opens the venue, accepts orders and serves them; some food can be prepared on demand.
- **Buffet / event:** people pay a fixed admission price, serve themselves from prepared food, socialize and use the venue's activities. A future exhibition can use satisfaction and interest to affect the chance of buying player-made art.
- **Canteen / self-service:** food is produced in larger batches; people choose portions, pay, sit, eat and leave with low per-person service overhead.

The first implemented format remains food service. Additional entertainment such as karaoke, sauna or jacuzzi can later become part of `venueOffer`, allowing people to consider the place for motives other than hunger. The same broader structure should eventually support non-food professions such as a gallery or repair business without forcing those professions to copy restaurant service.

## Food offer and pricing

- Prices are fixed by the game. The player does not manually set dish prices in the target design.
- The player controls what is actually offered, its quality, quantity and the venue's capacity to fulfill demand.
- Food preference has several layers: cuisine/origin first, broad dish class second, ingredients third. Exact scoring remains a balance decision.
- A person may enter or inspect the offer and buy nothing. This is a normal mismatch, not automatically a reputation penalty.
- Better crop quality and better cooking execution may raise food quality later and therefore satisfaction, while leaving the nominal price rule simple unless a future explicit product decision changes it.

## Opening hours and menu activation

Early play uses direct open/closed control; a later automated venue may support a schedule. The sign always opens one compact panel whose pill switch is labeled **`Заведение открыто` / `Заведение закрыто`** (`Venue open / Venue closed`) and directly controls service. Closing the panel, including with `Space` or `Escape`, preserves that state. Dish editing is locked while open. Its bounded two-row list scrolls by wheel or touch swipe when more products are added.

The persisted `venueOffer.foodItemIds` reuses canonical kitchen sellable IDs; `NEW GAME` enables fried potato and lemonade. Offer and physical stock remain independent, and person-backed guests can reserve only accepted items active in the offer. An inactive venue produces no opportunities or penalty.

## Experience and negative feedback

A completed or attempted visit can be affected by:

- waiting too long after an accepted order;
- receiving the wrong order;
- unavailable or inadequate toilet access when the person needs it;
- dirt or poor cleanliness;
- lack of seating or usable space;
- low-quality ingredients or poor cooking quality;
- direct conflict with the player;
- conflict with other guests.

These effects are not universally negative for every person. Reputation can make some traits attractive to a matching audience; for example, a venue known for loud drinking and frequent fights can be popular with people who actively prefer that environment while remaining unattractive to others.

An unavailable dish before an order is accepted is not a service failure. Once the venue accepts an order or equivalent commitment, failure to fulfill it can reduce satisfaction and personal opinion and may later affect popularity or reputation.

## Social depth

The first demand implementation does not require full Sims-like social simulation, but the persistent-person model must leave room for it.

- Individual people can become recognizable repeat visitors and later friends or romantic partners of the player.
- The player may eventually phone people, ask how they are and invite them over; any such direct contact reconstructs that person's offscreen state before interaction.
- Guests can later talk to one another, form relationships, argue, fight and change each other's opinions.
- Word of mouth should ultimately be grounded in these people and their connections. It is a narrative realization of the same demand feedback, not a separate currency.

## Development sequence

Validation proceeds through observable slices that may be revised after playtesting:

1. **Persistent population:** stable people, canonical needs and coarse offscreen reconstruction.
2. **Venue offer:** a saved food menu and unified active/inactive panel.
3. **Visit decision:** one persistent person evaluates needs, offer, budget and history.
4. **Order and fulfillment:** the chosen product becomes a service commitment and payment.
5. **Live guest needs:** every canonical need can affect an onsite visit.
6. **Feedback:** popularity, venue reputation and personal opinion stay distinct.
7. **Groups and time:** relationships and schedules shape plausible visitors.
8. **Venue formats:** infrastructure and offer produce takeaway, restaurant, event or self-service behavior.
9. **Social lifecycle:** relationships, families, ageing, death and replenishment deepen the population.

Early play prioritizes optimization, then recognizable people, then need-driven social situations.

## Order and fulfillment

The visit decision's `bestOfferItemId` becomes the persisted planned order. At a claimed serving-table station the guest shows their name/item and waits for ordinary world-interaction acceptance. Before acceptance, menu/venue/station loss or response timeout ends the visit without failed-service history.

Acceptance fixes the commitment and starts a bounded fulfillment window. The assigned station may contain the exact item already or receive it later through the ordinary inventory-to-serving-table interaction. Wrong stock is ignored. Accepted, reserved and served commitments survive menu deactivation and later offer edits. Lemonade continues through takeout and two-coin payment; fried potato continues through dining and four-coin payment.

Fulfillment timeout records one `failedAcceptedOrderCount` and timestamp, negative feedback and no payment. This history affects repeat visits; runtime/path cancellation does not.

## Implemented stages

Stage 1 provides 16 persistent people and coarse need reconstruction. Stage 2 persists the active food offer and unifies sign interaction in one menu panel. Stage 3 gives every person a stable budget/taste profile and replaces stock-driven waves with one-person visit opportunities. Stage 4 persists the chosen exact order, routes player acceptance through the shared interaction system, waits for exact station fulfillment and records completed or timed-out accepted service as objective history.

## Owners

- kitchen state/rules: `src/tavern/cookingDomain.js`;
- minigame/presentation: `src/tavern/cookingRuntime.js`;
- fixed kitchen interaction delegation: `src/tavern/kitchenInteractionRuntime.js`;
- facilities: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`;
- sign: `src/tavern/tavernSignRuntime.js`, `src/tavern/guestConfig.js`;
- guest flow/pathing: `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`;
- scheduling and orchestration: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`;
- order state, timers and legal transitions: `src/tavern/orderDomain.js`;
- visit decision and diagnostic breakdown: `src/tavern/visitDemandDomain.js`; canonical prices/tags: `src/tavern/saleProfileDomain.js`;
- active food offer: `src/tavern/venueOfferDomain.js`; unified sign-menu presentation/input and activity switch: `src/tavern/venueMenuRuntime.js`;
- guest reaction/carried-item presentation: `src/tavern/guestFeedback.js`;
- payment: `src/tavern/coinRuntime.js`;
- persistent people, budgets/preferences and offscreen needs: `src/character/populationDomain.js` (external owner consumed through its public evaluation API);
- `WorldScene` composes owners and delegates updates and callbacks.

## Invariants

- kitchen stock is JSON-safe and owned by stable serving-table ID: each table holds zero or one portion and its stable guest reservation;
- recipes consume inputs and publish outputs atomically through inventory operations;
- facility positions are read live by reserved table ID, so moved furniture changes only its assigned guest path;
- the build-mode movable tavern sign owns one live position shared by its visual, collider, interaction and guest check point;
- sign interaction always opens the same menu panel; active/inactive service state is controlled only by the panel switch in Stage 2;
- sign, stock reservation and service lifecycle cannot contradict each other;
- an active menu produces one opportunity every three to eight real seconds; it evaluates exactly one non-visiting persistent person and a refusal does not select a replacement;
- `venueOffer` remains independent from physical stock: stock cannot create or block demand, and zero stock does not prevent an exact order from being offered;
- a live visit keeps separate technical `guestId` and stable `personId`; one person cannot have two active visits, and fulfillment may reserve only exact `order.itemId` after acceptance;
- one serving-table station belongs to at most one active order, while station selection prefers exact stock, then empty stock, then another free station;
- successful purchase records one completed visit; an accepted fulfillment timeout records one failed accepted order; unaccepted or technical cancellation changes neither counter;
- accepted commitments survive menu deactivation and offer edits, and `served` ends the fulfillment timeout;
- dine-in guests reserve distinct dining-table IDs before consuming a dish; a table currently used by the player is excluded from new seat assignments, and the player cannot start using a guest-reserved table;
- lemonade is takeout worth two coins; a fried potato dish is dine-in worth four.

## Current baseline

Potato and lemonade feed independently stocked serving tables with existing dine-in/takeout, pathing and coin rewards. The sign panel owns offer/activity. Person-backed guests arrive for the decision's exact menu item, claim a live serving station, visibly offer the order and wait for explicit player acceptance. Prepared stock can fulfill immediately after acceptance; later stock uses the same physical serving-table flow. Completed and timed-out accepted orders update objective per-person history exactly once.

## Not yet

Recipe book, broader ingredients/storage, live guest needs, influence, popularity/reputation/opinion, group visits, social propagation, configurable schedules, staff and broader venue formats.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`, `check:task-086`, `check:task-087`, `check:task-088`, `check:task-089`; focused service, order and population Browser E2E.
