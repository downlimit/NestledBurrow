# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, venue offer, visitor demand, guest behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → claimed service-capable table → dine-in guest → 4 coins
lemon + bucket water → juicer → claimed service-capable table → dine-in or intent-driven takeout guest → 2 coins
```

Stage 4 uses the target causality: a persistent person first has a reason to go out, chooses one exact menu item, offers that order in person and creates a service commitment only after the player accepts it.

## Demand terminology

These terms are canonical. They describe different layers of the same system and must not be used interchangeably.

- **Population (`population`)** — finite persistent people, initially roughly one hundred; this system consumes them as potential visitors.
- **Person (`person`)** — one stable identity with needs, preferences, spending capacity and personal history.
- **Candidate (`candidate`)** — a person considering the venue; candidacy does not guarantee arrival.
- **Guest (`guest`)** — that same person after committing to a materialized visit.
- **Needs (`needs`)** — canonical person needs from `systems/character-and-needs.md`; satiety drives food motive and every need may affect onsite behavior.
- **Visit motive (`visitMotive`)** — the current need-based reason to consider a venue.
- **Visit opportunity (`visitOpportunity`)** — one bounded chance for a population member to consider the venue.
- **Popularity / flow pressure (`popularity`)** — a separate bounded persistent value controlling opportunity cadence. Organic gain is slow; explicit rare-event/dev impulses may be sharp.
- **Reputation profile (`reputationProfile`)** — descriptive venue identity that biases audience composition. Sale tags and universal service reliability remain separate dimensions; discovery weight stays positive.
- **Personal venue opinion (`venueOpinion`)** — one person's bounded attitude from direct experience, with gradual world-time drift toward neutral.
- **Venue offer (`venueOffer`)** — currently promised menu, goods, activities or facilities; unoffered inventory creates no demand.
- **Food preference (`foodPreference`)** — layered cuisine, dish-class and ingredient tastes.
- **Offer fit (`offerFit`)** — motive, taste and budget fit for the current offer; affordability failure is ordinary mismatch.
- **Visit memory (`visitMemory`)** — remembered visits, outcomes, purchases and recency.
- **Recent-visit suppression (`recentVisitSuppression`)** — a soft repeat-visit reduction that fades with world time.
- **Spending capacity (`spendingCapacity`)** — the person's affordable price range.
- **Influence (`influence`)** — future receiver-specific social reach based on tastes and relationships.
- **Potential demand (`potentialDemand`)** — people currently willing to visit before physical constraints.
- **Service capacity (`serviceCapacity`)** — demand the live venue can admit and serve.
- **Group (`group`)** — future multi-person visit with shared capacity constraints.
- **Audience composition (`audienceComposition`)** — the derived mix produced by people, reputation and context; it is never a spendable stat.

## How demand is formed

The causal order is fixed where stated even though exact balance formulas remain tunable.

```text
venue is open or scheduled open
→ popularity / flow pressure schedules a visit opportunity
→ one persistent person becomes a candidate, biased by reputation but never hard-locked by it
→ that person's offscreen needs are reconstructed
→ current needs create one or more possible visit motives
→ venue offer is compared with motive, tastes and spending capacity
→ reputation fit, personal venue opinion and recent-visit suppression are applied
→ the person decides whether to visit, alone or eventually with a group
→ physical service capacity determines whether the willing visit can actually be served
→ the same persistent person enters the world as a guest when materialized
→ all of that person's needs become live while present
→ service, facilities and other people produce an actual experience
→ the visit updates personal memory and opinion
→ the experience contributes reputation evidence and may weakly reinforce aggregate flow
→ later social systems propagate that experience selectively through real relationships
```

Four separate questions remain visible: popularity controls **reach**; reconstructed needs create **motive**; offer/tastes/budget/reputation/opinion determine **choice**; physical capacity and service determine **conversion**. Flow never changes wealth. Unsuitable pre-commitment offers create missed revenue. Descriptive reputation has inertia, while positive discovery weight lets a changed menu redirect the audience progressively.

## Flow density and pacing

The current one-opportunity-every-`3..8`-real-seconds cadence is prototype instrumentation for quickly exercising demand and service. It is not target progression balance.

Target guest flow must increase planfully over meaningful play time. A short sequence of good visits must not create a runaway feedback loop or an immediate crowd at the entrance. A person's own experience is a major determinant of whether they return; reputation weakly transfers evidence to other people, while ordinary positive service changes aggregate popularity more slowly still.

A large external popularity impulse may temporarily create far more willing visitors than the venue can comfortably serve. The game must not silently discard that pressure as a hard capacity cap: an open venue that cannot admit or serve willing people creates real negative experience. Personal opinions and universal service-reliability reputation then reduce later willingness, so actual guest flow can settle back toward a sustainable range unless the player expands capacity and successfully retains the higher demand. Excess demand does not require physically spawning an unbounded crowd; deterministic offscreen turned-away outcomes are valid when the visual/runtime guest cap is reached.

Established flow also creates an availability expectation. Before configurable schedules exist, sustained manual closure may weakly erode aggregate popularity over elapsed world time even while the tavern is not physically simulated. This closure effect is materially weaker than failure while the venue is open and recovers progressively after renewed successful activity. Exact rates, thresholds and recovery curves are balance parameters.

Once configurable opening hours exist, hours deliberately marked closed by the player's schedule are normal operating policy rather than service failure. The schedule becomes a load-management control: shortening hours reduces forecast demand and required production, while opening during declared hours still carries the stronger obligation to admit and serve the demand the venue accepts.

## Persistent people without full offscreen simulation

Offscreen people retain their last state/evaluation time and reconstruct from elapsed world time, traits and bounded variation only when relevant. A physical guest advances every canonical need live on that same persistent person. Relationships, families, ageing, death and replenishment remain future population work.

## Venue formats

Offer and infrastructure may later produce takeaway, cafe/bar, buffet/event or canteen/self-service behavior without explicit mode switches. Food service is implemented first. Future activities may add non-food motives and reuse the same demand structure for other professions.

## Food offer and pricing

- Prices are fixed; the player controls offer, quality, quantity and fulfillment capacity.
- Food preference layers are cuisine/origin, dish class and ingredients; exact weights are balance constants.
- Inspecting an unsuitable offer and buying nothing is missed revenue without feedback damage.
- Ingredient/cooking quality may later affect satisfaction while nominal prices stay simple.

## Opening hours and menu activation

Early play uses direct open/closed control; a later automated venue may support a schedule. The sign always opens one compact panel whose pill switch is labeled **`Заведение открыто` / `Заведение закрыто`** (`Venue open / Venue closed`) and directly controls service. Closing the panel, including with `Space` or `Escape`, preserves that state. Dish editing is locked while open. Its bounded two-row list scrolls by wheel or touch swipe when more products are added.

The persisted `venueOffer.foodItemIds` reuses canonical kitchen sellable IDs; `NEW GAME` enables fried potato and lemonade. Offer and physical stock remain independent, and person-backed guests can reserve only accepted items active in the offer. The current prototype produces no physical opportunities while inactive; Stage 6 feedback may still reconstruct the weaker effect of sustained manual closure from elapsed world time.

Future management UI should expose practical forecasts rather than hidden coefficients: expected visitors over a useful day/week horizon, available service capacity, food output, ingredient production, helper output and material/fuel consumption. Changing opening hours should update those forecasts directly so schedule, production and demand can be balanced from one readable view.

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

Preference-sensitive qualities are not universally positive or negative. Cleanliness, noise, social intensity, conflict frequency, cuisine and similar venue traits may attract one audience and repel another when matching person preferences exist.

Core service reliability is universal rather than taste-relative. Accepting a service commitment and then failing to fulfill it, delivering the wrong committed result, or otherwise leaving the promised service nonfunctional is negative for every person; no future personality trait should make broken service intrinsically desirable. An open venue that cannot actually admit or serve a willing visitor belongs to this stronger service-failure class rather than to the weaker manual-closure availability penalty.

An unavailable dish before an order is accepted is not a service failure. Once the venue accepts an order or equivalent commitment, failure to fulfill it can reduce satisfaction and personal opinion and contribute negative service-reliability reputation evidence.

## Social depth

Stable relationships and coarse preferred visit periods now shape lead/group selection. Future word of mouth may use these links; own experience remains strongest and no social currency/global broadcast exists.

## Development sequence

Validation proceeds through observable slices that may be revised after playtesting:

1. **Persistent population:** stable people, canonical needs and coarse offscreen reconstruction.
2. **Venue offer:** a saved food menu and unified active/inactive panel.
3. **Visit decision:** one persistent person evaluates needs, offer, budget and history.
4. **Order and fulfillment:** the chosen product becomes a service commitment and payment.
5. **Live guest needs:** every canonical need can affect an onsite visit.
6. **Feedback:** persistent personal opinion, descriptive venue reputation and aggregate popularity/flow pressure form one causal but non-collapsed feedback loop.
7. **Groups and time:** stable relationships and shared-clock schedule profiles shape plausible visitors and groups of up to three.
8. **Venue formats:** infrastructure and offer produce takeaway, restaurant, event or self-service behavior.
9. **Social lifecycle:** relationships, families, ageing, death and replenishment deepen the population.

Early play prioritizes optimization, then recognizable people, then need-driven social situations.

## Order and fulfillment

- After the sign reaction, a guest claims one free `guest-service` facility; serving tables implement it first. Offer fit gives movement-compatible menu reading `2.5..6 s`; `bestOfferItemId` stays hidden until take-order acceptance.
- Acceptance persists the commitment and starts fulfillment. Exact stock already on or ordinarily served to the claimed table fulfills it; wrong stock is ignored. Reservation/timer survive need interruption.
- Dine-in food stays visible on that table until standing consumption ends. Drinks share the flow and become takeout only when onsite intents do not justify staying.
- One visit-local satisfaction tier precedes paying; the coin spawns after that timeline. Timeout or critical post-acceptance departure fails once; pre-acceptance departure does not.

## Live guest intent

`guestIntentDomain` owns deterministic live rates, one hysteretic N/E/S/T/L/D intent, interruption, menu timing, takeout and satisfaction policy; `guestRuntime` owns routes/orders. Critical pressure may interrupt accepted waiting, use ordinary toilet/wash facilities (quick sink before stronger shower), rest, wander or converse, then resume the same valid commitment. Player talk uses shared interaction and never seizes control.

## Implemented stages

Stages 1–4 provide persistent people, offer, demand, order and history; Stage 5 adds live needs/service/satisfaction; Stage 6 adds opinion, reputation and flow. Stage 7 independently combines reputation/time, invites linked on-time people and keeps each agreeing guest independent.

## Owners

- kitchen state/rules: `src/tavern/cookingDomain.js`;
- minigame/presentation: `src/tavern/cookingRuntime.js`;
- fixed kitchen interaction delegation: `src/tavern/kitchenInteractionRuntime.js`;
- facilities: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`;
- sign: `src/tavern/tavernSignRuntime.js`, `src/tavern/guestConfig.js`;
- guest flow/pathing: `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`;
- live need/intent policy: `src/tavern/guestIntentDomain.js`;
- scheduling and orchestration: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`;
- persistent opinion, descriptive reputation, flow cadence and overload/closure feedback formulas: `src/tavern/tavernFeedbackDomain.js`;
- time/reputation candidate diagnostics and linked-party selection: `src/tavern/visitPartyDomain.js`;
- order state, timers and legal transitions: `src/tavern/orderDomain.js`;
- visit decision and diagnostic breakdown: `src/tavern/visitDemandDomain.js`; canonical prices/tags: `src/tavern/saleProfileDomain.js`;
- active food offer: `src/tavern/venueOfferDomain.js`; unified sign-menu presentation/input and activity switch: `src/tavern/venueMenuRuntime.js`;
- overhead thought/action owner: `src/tavern/overheadPresentationRuntime.js`; guest adapter: `src/tavern/guestFeedback.js`;
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
- an active menu uses bounded flow pressure to scale the prototype three-to-eight-second opportunity cadence; this interval is not target progression balance;
- `venueOffer` remains independent from physical stock: stock cannot create or block demand, and zero stock does not prevent an exact order from being offered;
- a live visit keeps separate technical `guestId` and stable `personId`; one person cannot have two active visits, and fulfillment may reserve only exact `order.itemId` after acceptance;
- one `guest-service` facility belongs to at most one active guest/order; exact stock, empty stock, then another free table is preferred;
- successful purchase records one completed visit; an accepted fulfillment timeout records one failed accepted order; unaccepted or technical cancellation changes neither counter;
- accepted commitments survive menu deactivation and offer edits, and `served` ends the fulfillment timeout;
- dine-in food stays on the claimed table through consumption; generic dining tables retain only their ordinary player role;
- lemonade is two coins and intent-driven takeout; fried potato is four-coin dine-in;
- canonical needs, exact order and service-table ownership persist; transient intent/presentation may re-arbitrate after load;
- satisfaction tier 3 is neutral, tiers 4–5 strengthen that person's opinion and tiers 1–2 weaken it; satisfaction itself is never persisted;
- completed sales reinforce their canonical cuisine/dish-class/ingredient tags with inertia, while universal service reliability remains a separate reputation dimension;
- reputation biases candidate weighting while every otherwise eligible person retains a strictly positive discovery weight;
- shared-clock time multiplies reputation weight independently; off-schedule weight stays positive and flow cadence is unchanged. Only linked, inactive, on-time invitees independently evaluate the existing full visit decision;
- an agreeing group of at most three fits `GUEST_ACTIVE_CAP` as one unit or nobody spawns and each records `open-unserved`; spawned guests keep separate identity, order, needs, service, payment, history and opinion;
- flow pressure changes opportunity cadence only and cannot mutate population tastes, wealth, opinions or reputation tags;
- willing demand at the live cap and a materialized guest timing out without service capacity both record `open-unserved`; accepted-order failure has stronger feedback, sustained manual closure has weaker feedback;
- the physical guest count remains bounded by `GUEST_ACTIVE_CAP`; excess willing demand becomes offscreen feedback outcomes.

## Current baseline

Guests read the menu while entering, reveal the item on acceptance and wait at their table; interruptions resume the same order, satisfaction precedes payment, and history updates once. Opinion/reliability affect willingness; reputation and coarse time independently bias candidates; flow controls cadence. Related on-time people may arrive together with separate visit state. E2E exposes lead, factors and group membership without ordinary UI.

## Not yet

Recipe book, broader ingredients/storage, influence, relationship propagation, configurable schedules, families, staff, chairs/seated poses, shared tables/group payment, a visible queue/forecast panel and broader venue formats.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`, `check:task-086`, `check:task-087`, `check:task-088`, `check:task-089`, `check:task-091`, `check:task-095`, `check:task-096`; focused service, order, population, feedback, group and live-visit Browser E2E.
