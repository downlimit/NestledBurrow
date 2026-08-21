# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, venue offer, visitor demand, guest behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → assisted or exact-stock self-service dine-in guest → 4 coins
lemon + bucket water → juicer → assisted, takeaway or exact-stock self-service guest → 2 coins
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
- **Reputation profile (`reputationProfile`)** — descriptive venue identity that biases audience composition. Sale tags, including observed price segment, and universal service reliability remain separate dimensions; discovery weight stays positive.
- **Personal venue opinion (`venueOpinion`)** — one person's bounded attitude from direct experience, with gradual world-time drift toward neutral.
- **Venue offer (`venueOffer`)** — currently promised menu, goods, activities or facilities; unoffered inventory creates no demand.
- **Food preference (`foodPreference`)** — layered cuisine, dish-class and ingredient tastes.
- **Ценовой сегмент (`priceBand`)** — coarse price class of one offered product: `budget`, `standard` or `premium`. Current fixed-price thresholds are `<=2`, `<=4`, `>4` coins and remain balance constants.
- **Ценовое предпочтение (`pricePreference`)** — stable person taste for `budget`, `premium` or neither (`neutral`), independent from wealth.
- **Ценовая чувствительность (`priceSensitivity`)** — strength of that non-neutral preference. It changes willingness, never the affordability ceiling.
- **Offer fit (`offerFit`)** — motive, food taste, price preference and budget fit for the current offer; affordability failure is ordinary mismatch.
- **Visit memory (`visitMemory`)** — remembered visits, outcomes, purchases and recency.
- **Recent-visit suppression (`recentVisitSuppression`)** — a soft repeat-visit reduction that fades with world time.
- **Spending capacity (`spendingCapacity`)** — the person's persistent purchasing-power/wealth proxy and hard affordable price ceiling; it is distinct from price preference.
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
→ venue offer is compared with motive, food tastes, price preference and spending capacity
→ reputation fit, personal venue opinion and recent-visit suppression are applied
→ the person decides whether to visit, alone or eventually with a group
→ physical service capacity determines whether the willing visit can actually be served
→ the same persistent person enters the world as a guest when materialized
→ all of that person's needs become live while present
→ service, facilities and other people produce an actual experience
→ the visit updates personal memory and opinion
→ the completed sale contributes food-tag and price-segment reputation evidence and may weakly reinforce aggregate flow
→ later social systems propagate that experience selectively through real relationships
```

Four separate questions remain visible: popularity controls **reach**; reconstructed needs create **motive**; offer/tastes/price/budget/reputation/opinion determine **choice**; physical capacity and service determine **conversion**. Flow never changes wealth. Unsuitable pre-commitment offers create missed revenue. Descriptive reputation has inertia, while positive discovery weight lets a changed menu redirect the audience progressively.

## Flow density and pacing

The current one-opportunity-every-`3..8`-real-seconds cadence is prototype instrumentation. Flow grows slowly; personal experience dominates return choice, reputation transfers weaker evidence, and positive service changes aggregate popularity more slowly still. Overload above `GUEST_ACTIVE_CAP` records deterministic offscreen `open-unserved` outcomes. Sustained manual closure has a weaker recoverable flow penalty than failure while open. Exact rates remain balance parameters.

## Persistent people without full offscreen simulation

Offscreen people retain their last state/evaluation time and reconstruct from elapsed world time, traits and bounded variation only when relevant. A physical guest advances every canonical need live on that same persistent person. Relationships, families, ageing, death and replenishment remain future population work.

## Venue formats

Stage 8 derives one visit-local service format from the canonical sale profile and live service infrastructure. The venue has no persisted format setting. `fried-potato-dish` allows assisted dine-in and dine-in self-service; `lemonade` additionally allows takeaway. Exact unreserved stock on a free service-capable table takes the self-service path. Otherwise an available service place supports assisted service or, for a portable item and a guest without another onsite intent, takeaway.

Self-service atomically claims the free table and reserves its exact displayed item. The order advances through the ordinary commitment states without a player `take-order` action. A failed exact capture may fall back to a still-available assisted/takeaway place. Missing live service capacity after a positive visit decision remains `open-unserved`. Event service stays unavailable until real activity infrastructure exists.

## Food offer and pricing

- Prices are currently fixed; the player controls offer, quality, quantity and fulfillment capacity. Player-authored prices are future work.
- Price complexity and price segment are independent concepts. Expensive food is not intrinsically better, and cheap food is not intrinsically worse.
- Affordability is a hard gate: an item above `spendingCapacity` cannot be ordered. Price preference is a separate soft fit after that gate. A low-wealth premium-preferring person may want expensive food but still choose only among affordable items; a rich budget-preferring person may deliberately favor cheap food.
- Neutral people ignore price segment. Non-neutral people prefer their matching segment according to stable sensitivity; adjacent/opposite segments reduce willingness without changing their money.
- The menu may legally contain only cheap, only middle-priced or eventually only premium items. There is no rule requiring the player to maintain a mixed-price menu.
- Food preference layers are cuisine/origin, dish class and ingredients; exact weights are balance constants.
- Inspecting an unsuitable offer and buying nothing is missed revenue without feedback damage.
- Dish quality `bronze → silver → gold → platinum` is probabilistic from ingredient quality, cooking skill, equipment, recipe difficulty and modifiers; no hard tier cap, so high skill may sometimes rescue poor inputs. Recipes aggregate ingredient quality by default, with optional weights only for meaningful exceptions; gardening and repair may improve inputs/equipment.

## Price audience and reputation inertia

Completed sales add the current item's price segment to the same inertial descriptive reputation evidence used by cuisine/dish/ingredient tags. Repeated cheap sales progressively make budget-preferring people more likely candidates; repeated sales in another segment gradually redirect that evidence. A single changed sale cannot instantly replace the established audience.

Wealth and price preference remain separate. Reputation may bias which people hear about or consider the venue, while every otherwise eligible person retains positive discovery weight. Changing menu prices or segment therefore may temporarily reduce effective demand until the venue accumulates matching evidence; it does not spawn an immediately matching audience and does not alter anyone's wealth.

## Opening hours and menu activation

Early play uses direct open/closed control; a later automated venue may support a schedule. The sign always opens one compact panel whose pill switch is labeled **`Заведение открыто` / `Заведение закрыто`** (`Venue open / Venue closed`) and directly controls service. Closing the panel, including with `Space` or `Escape`, preserves that state. Dish editing is locked while open. Its bounded two-row list scrolls by wheel or touch swipe when more products are added.

The persisted `venueOffer.foodItemIds` reuses canonical kitchen sellable IDs; `NEW GAME` enables fried potato and lemonade. Offer and physical stock remain independent, and person-backed guests can reserve only accepted items active in the offer. The current prototype produces no physical opportunities while inactive; Stage 6 feedback may still reconstruct the weaker effect of sustained manual closure from elapsed world time.

## Experience and negative feedback

A visit may react to accepted-order delay/wrong fulfillment, unavailable needed facilities, cleanliness/space/quality and direct conflict.

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
8. **Venue formats:** ordered food and live infrastructure produce assisted dine-in, takeaway or self-service behavior per visit.
9. **Social lifecycle:** relationships, families, ageing, death and replenishment deepen the population.
10. **Price audience:** persistent purchasing power, independent price preference and inertial price-segment reputation shape affordable choice and audience composition.

Early play prioritizes optimization, then recognizable people, then need-driven social situations.

## Order and fulfillment

- After the sign reaction, a guest claims one free `guest-service` facility; serving tables implement it first. Offer fit gives movement-compatible menu reading `2.5..6 s`; `bestOfferItemId` stays hidden until take-order acceptance.
- Acceptance persists the commitment and starts fulfillment. Exact stock already on or ordinarily served to the claimed table fulfills it; wrong stock is ignored. Reservation/timer survive need interruption.
- Assisted service keeps the established menu → offer → player acceptance → fulfillment → payment cycle. Dine-in food stays visible on the claimed table until standing consumption ends.
- Takeaway keeps player acceptance and exact fulfillment, consumes the handed-over item, releases the service place immediately after transfer, then completes its own satisfaction/payment/history/feedback once while leaving.
- Self-service reserves pre-existing exact stock before commitment, skips the `take-order` interaction and continues through the same served/completed/payment/history/feedback contracts. One portion can have one reservation.
- One visit-local satisfaction tier precedes paying; the coin spawns after that timeline. Timeout or critical post-acceptance departure fails once; pre-acceptance departure does not.

## Live guest intent

`guestIntentDomain` owns deterministic live rates, one hysteretic N/E/S/T/L/D intent, interruption, takeout and satisfaction policy; `guestRuntime` owns routes/orders. Critical pressure may interrupt accepted waiting, use ordinary toilet/wash facilities (quick sink before stronger shower), rest, wander or converse, then resume the same valid commitment. Player talk uses shared interaction and never seizes control.

## Implemented stages

Stages 1–4 provide persistent people, offer, demand, order and history; Stage 5 adds live needs/service/satisfaction; Stage 6 adds opinion, reputation and flow. Stage 7 independently combines reputation/time, invites linked on-time people and keeps each agreeing guest independent. Stage 8 derives assisted, takeaway and self-service behavior per participant from the ordered item and live infrastructure. Stage 10 adds wealth/affordability semantics, independent price preference and inertial price-audience evidence without requiring new menu UI.

## Owners

- kitchen state/rules: `src/tavern/cookingDomain.js`;
- minigame/presentation: `src/tavern/cookingRuntime.js`;
- fixed kitchen interaction delegation: `src/tavern/kitchenInteractionRuntime.js`;
- facilities: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`;
- sign: `src/tavern/tavernSignRuntime.js`, `src/tavern/guestConfig.js`;
- guest flow/pathing: `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`;
- live need/intent policy: `src/tavern/guestIntentDomain.js`;
- scheduling and orchestration: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`;
- persistent opinion, descriptive food/price reputation, flow cadence and overload/closure feedback formulas: `src/tavern/tavernFeedbackDomain.js`;
- time/reputation candidate diagnostics and linked-party selection: `src/tavern/visitPartyDomain.js`;
- order state, timers and legal transitions: `src/tavern/orderDomain.js`;
- visit decision and diagnostic breakdown: `src/tavern/visitDemandDomain.js`; canonical prices/tags/allowed service formats: `src/tavern/saleProfileDomain.js`;
- active food offer: `src/tavern/venueOfferDomain.js`; unified sign-menu presentation/input and activity switch: `src/tavern/venueMenuRuntime.js`;
- overhead thought/action owner: `src/tavern/overheadPresentationRuntime.js`; guest adapter: `src/tavern/guestFeedback.js`;
- payment: `src/tavern/coinRuntime.js`;
- persistent people, wealth ceiling and food preferences: `src/character/populationDomain.js`; derived wealth labels and price preference/sensitivity: `src/character/personEconomyProfile.js`;
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
- price preference never overrides `spendingCapacity`; wealth, price preference, food taste, opinion, reputation and flow remain distinct variables;
- no price segment is intrinsically superior. The player may legally run a single-segment menu; audience mismatch is demand fit, not a universal satisfaction penalty;
- completed sales reinforce their price-segment tag with the same inertia as descriptive food tags; changing segment redirects audience progressively and discovery weight never reaches zero;
- a live visit keeps separate technical `guestId` and stable `personId`; one person cannot have two active visits, and fulfillment may reserve only exact `order.itemId` after acceptance;
- the sale profile bounds allowed visit-local formats: potato never becomes takeaway; lemonade may be assisted, takeaway or exact-stock self-service;
- self-service atomically claims one free service place and one exact displayed portion, creates no `take-order` interaction and falls back to a physically available ordinary path after a failed capture;
- takeaway releases its service place at item transfer; assisted/self-service dine-in retains the place through onsite consumption;
- accepted `serviceFormat` and whether its service place remains active persist with the guest snapshot and restore without reselection;
- one `guest-service` facility belongs to at most one active guest/order; exact stock, empty stock, then another free table is preferred;
- successful purchase records one completed visit; an accepted fulfillment timeout records one failed accepted order; unaccepted or technical cancellation changes neither counter;
- accepted commitments survive menu deactivation and offer edits, and `served` ends the fulfillment timeout;
- dine-in food stays on the claimed table through consumption; generic dining tables retain only their ordinary player role;
- lemonade is two coins and may use takeaway; fried potato is four-coin dine-in;
- canonical needs, exact order and service-table ownership persist; transient intent/presentation may re-arbitrate after load;
- satisfaction tier 3 is neutral, tiers 4–5 strengthen that person's opinion and tiers 1–2 weaken it; satisfaction itself is never persisted;
- completed sales reinforce their canonical cuisine/dish-class/ingredient/price-band tags with inertia, while universal service reliability remains a separate reputation dimension;
- reputation biases candidate weighting while every otherwise eligible person retains a strictly positive discovery weight;
- shared-clock time multiplies reputation weight independently; off-schedule weight stays positive and flow cadence is unchanged. Only linked, inactive, on-time invitees independently evaluate the existing full visit decision;
- an agreeing group of at most three fits `GUEST_ACTIVE_CAP` as one unit or nobody spawns and each records `open-unserved`; spawned guests keep separate identity, order, needs, service, payment, history and opinion;
- flow pressure changes opportunity cadence only and cannot mutate population tastes, wealth, price preference, opinions or reputation tags;
- willing demand at the live cap and a materialized guest timing out without service capacity both record `open-unserved`; accepted-order failure has stronger feedback, sustained manual closure has weaker feedback;
- the physical guest count remains bounded by `GUEST_ACTIVE_CAP`; excess willing demand becomes offscreen feedback outcomes.

## Current baseline

Guests independently receive assisted, takeaway or self-service behavior after demand/group selection. Assisted orders retain manual acceptance, takeaway frees the handoff table after transfer, and pre-set exact stock may be captured without `take-order`. Interruptions resume the same order, satisfaction precedes payment, and history/feedback update once per person. Affordability is a hard wealth ceiling; stable price preference modifies affordable item choice; completed sales build inertial food and price-segment reputation. Opinion/reliability affect willingness; reputation and coarse time independently bias candidates; flow controls cadence.

## Not yet

Recipe book, broader ingredients/storage, player-authored prices, recipe complexity/margin balance, influence, relationship propagation, configurable schedules, families, staff, chairs/seated poses, shared tables/group payment, a visible queue/forecast panel, event format, non-food venue formats and competing NPC businesses.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`, `check:task-086`, `check:task-087`, `check:task-088`, `check:task-089`, `check:task-091`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-102`; focused service-format, order, population, feedback, group and live-visit Browser E2E.
