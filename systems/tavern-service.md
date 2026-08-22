# Tavern service

## Purpose

Owns kitchen transformation, service facilities, tavern opening, venue offer, visitor demand, guest behavior, orders, payment and tavern feedback.

## Player-visible contract

```text
potato → preparation → frying → assisted or exact-stock self-service dine-in guest → 4 coins
lemon + bucket water → juicer → assisted, takeaway or exact-stock self-service guest → 2 coins
```

A persistent person first has a reason to go out, chooses one exact offered item, arrives, and creates a service commitment only after acceptance; self-service is the explicit exception because it captures exact displayed stock before commitment.

## Demand terminology

- **Population (`population`)** — finite persistent people considered as visitors.
- **Person (`person`)** — stable identity with needs, preferences, spending capacity and history; **candidate** considers the venue, **guest** is the same person after a materialized visit.
- **Needs / visit motive / visit opportunity** — needs create a reason to visit; an opportunity is one bounded chance to consider the venue.
- **Popularity (`popularity`)** — bounded persistent flow pressure controlling opportunity cadence; it is not reputation or wealth.
- **Reputation profile (`reputationProfile`)** — descriptive venue identity from observed food/price tags plus separate universal reliability evidence; candidate discovery always stays positive.
- **Personal venue opinion (`venueOpinion`)** — one person's bounded direct-experience attitude, drifting slowly toward neutral.
- **Venue offer (`venueOffer`)** — currently promised menu/facilities; unoffered stock creates no demand.
- **Food preference (`foodPreference`)** — cuisine, dish-class and ingredient tastes.
- **Ценовой сегмент (`priceBand`)** — `budget/standard/premium`; current thresholds `<=2`, `<=4`, `>4` coins.
- **Ценовое предпочтение (`pricePreference`)** — stable `budget/premium/neutral` taste independent of wealth.
- **Ценовая чувствительность (`priceSensitivity`)** — strength of a non-neutral price preference; never overrides affordability.
- **Offer fit (`offerFit`)** — motive + food taste + price preference + affordability.
- **Visit memory / recent-visit suppression** — remembered outcomes and a soft repeat-visit reduction that fades with time.
- **Spending capacity (`spendingCapacity`)** — persistent wealth/affordability ceiling, distinct from price preference and future real household funds.
- **Potential demand / service capacity** — willing visitors before physical constraints / visits the live venue can actually admit and serve.
- **Group** — linked multi-person visit; **audience composition** — derived population mix, never a currency.

## How demand is formed

```text
open/scheduled venue
→ popularity schedules an opportunity
→ persistent candidate, reputation-biased but never hard-locked
→ reconstruct offscreen needs → motive
→ compare offer with motive, tastes, price preference and affordability
→ apply reputation, personal opinion and recent-visit suppression
→ person/group decides
→ physical capacity admits or records open-unserved
→ same persistent person becomes a live guest
→ service/facilities/people create experience
→ memory/opinion update
→ completed sale updates food/price reputation and weakly reinforces flow
```

Popularity controls **reach**; needs create **motive**; offer/taste/price/budget/reputation/opinion determine **choice**; physical service determines **conversion**. Flow never changes wealth. Pre-commitment mismatch is missed revenue, not service failure. Reputation has inertia, but discovery stays nonzero so a changed venue can redirect its audience.

## Flow density and offscreen people

Current opportunity cadence `3..8` real seconds is prototype instrumentation. Flow grows slowly; direct experience dominates return choice. Above `GUEST_ACTIVE_CAP`, willing demand records deterministic `open-unserved`. Sustained manual closure has a weaker recoverable penalty than being open and unable to serve.

Offscreen people reconstruct from elapsed world time only when relevant. A physical guest advances canonical needs live on the same persistent person.

## Venue formats

No persisted venue-format switch exists. The sale profile and live infrastructure choose per visit:
- `fried-potato-dish`: assisted dine-in or exact-stock self-service;
- `lemonade`: assisted dine-in, takeaway or exact-stock self-service.

Self-service atomically claims a free service place plus exact unreserved displayed stock and skips `take-order`; failed capture may fall back to an available ordinary path. Takeaway requires a portable item and releases its service place after transfer. Missing physical capacity after a positive decision is `open-unserved`. Event service waits for real activity infrastructure.

## Food offer and pricing

- Prices are fixed for now; the player controls assortment, quality, quantity and fulfillment. Player-authored prices are future work.
- Recipe complexity and price segment are independent. Expensive is not intrinsically better and cheap is not intrinsically worse.
- Affordability is a hard gate. Price preference is a soft fit among affordable items. A poor premium-preferring person may want expensive food but cannot buy above the ceiling; a rich budget-preferring person may deliberately choose cheap food.
- Neutral people ignore price segment. The player may legally run only cheap, only middle or only premium food; mixed-price menus are never mandatory.
- Food taste layers are cuisine/origin, dish class and ingredients. Unsuitable offer without commitment is missed revenue without feedback damage.
- Dish quality `bronze → silver → gold → platinum` is probabilistic from ingredient quality, cooking skill, equipment, recipe difficulty and modifiers; no hard tier cap. Recipes aggregate ingredient quality by default, with weights only for meaningful exceptions.

## Price audience and reputation inertia

Completed sales reinforce the item's `priceBand:*` tag through the same inertial descriptive reputation as cuisine/dish/ingredient tags. Repetition gradually attracts matching price preferences; one changed sale cannot instantly replace an established audience. Price reputation never changes anyone's wealth and never reduces discovery to zero, so changing segment may temporarily reduce demand while a new audience forms.

## Opening hours and menu

Early play uses direct open/closed control; later automation may add schedules. The sign opens one panel with **`Заведение открыто` / `Заведение закрыто`** (`Venue open / Venue closed`). Closing the panel preserves state; dish editing is locked while open. The two-row list scrolls when needed.

Persisted `venueOffer.foodItemIds` uses canonical sellable IDs; `NEW GAME` enables fried potato and lemonade. Offer and physical stock are independent: stock cannot create demand and zero stock does not prevent an exact order from being requested. While inactive, the prototype creates no physical opportunities; long manual closure may still produce the weaker flow penalty.

## Experience and feedback

Preference-sensitive traits such as cuisine, noise, cleanliness or social intensity may attract one person and repel another. Core service reliability is universal: accepting a commitment and failing it, wrong fulfillment, or an open venue unable to serve willing demand is negative for everyone. Broken service is stronger than manual closure. An unavailable dish before acceptance is not service failure.

Satisfaction tier `3` is neutral; `4–5` improve personal opinion, `1–2` reduce it. Satisfaction itself is transient. Own experience is strongest; future word of mouth may propagate selectively through real relationships.

## Order and fulfillment

- A guest claims one free `guest-service` place and reads the menu `2.5..6 s`; `bestOfferItemId` stays hidden until ordinary acceptance.
- Acceptance persists the exact commitment and timeout. Exact stock at the claimed place or exact later delivery fulfills it; wrong stock is ignored. Need interruption preserves reservation/order.
- Assisted service keeps menu → acceptance → fulfillment → payment. Dine-in stock remains visible through consumption.
- Takeaway consumes the transferred exact item, releases the service place immediately, then completes satisfaction/payment/history/feedback once while leaving.
- Self-service reserves pre-existing exact stock before commitment, skips `take-order`, then uses the same served/completed/payment/history/feedback contracts. One portion has one reservation.
- Payment follows satisfaction. Post-acceptance timeout/critical departure fails once; pre-acceptance departure does not.

## Live guest intent

`guestIntentDomain` owns deterministic N/E/S/T/L/D rates, hysteretic intent, interruption, takeout and satisfaction policy; `guestRuntime` owns routes/orders. Critical needs may interrupt accepted waiting for ordinary facilities/rest/conversation and then resume the same commitment. Player talk never seizes guest control.

## Development sequence

Implemented slices: persistent population → venue offer → visit decision → exact order/fulfillment → live guest needs → feedback/reputation/flow → groups/time → visit-local service formats → social lifecycle → price audience. Early play prioritizes optimization, then recognizable people, then need-driven social situations.

## Owners

- kitchen: `src/tavern/cookingDomain.js`, `src/tavern/cookingRuntime.js`, `src/tavern/kitchenInteractionRuntime.js`;
- facilities/sign/menu: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`, `src/tavern/tavernSignRuntime.js`, `src/tavern/venueOfferDomain.js`, `src/tavern/venueMenuRuntime.js`;
- demand/groups: `src/tavern/visitDemandDomain.js`, `src/tavern/visitPartyDomain.js`, `src/tavern/saleProfileDomain.js`;
- service/guests: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`, `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`, `src/tavern/guestIntentDomain.js`;
- orders/feedback/payment: `src/tavern/orderDomain.js`, `src/tavern/tavernFeedbackDomain.js`, `src/tavern/guestFeedback.js`, `src/tavern/coinRuntime.js`, `src/tavern/overheadPresentationRuntime.js`;
- people/wealth/food preferences: `src/character/populationDomain.js`; derived price profile: `src/character/personEconomyProfile.js`;
- `WorldScene` composes owners and delegates callbacks.

## Invariants

- kitchen stock is JSON-safe, stable-table-owned, zero/one portion with at most one guest reservation; recipe inventory changes are atomic;
- facility positions are read live; moved furniture changes only the assigned path; the movable tavern sign shares one position across visual/collider/interaction/guest check;
- sign, offer, stock reservation, service place and order lifecycle cannot contradict; `venueOffer` stays independent from physical stock;
- popularity controls opportunity cadence only; it cannot mutate tastes, wealth, price preference, opinions or reputation;
- wealth, price preference, food taste, opinion, reputation and flow remain distinct; price preference never overrides `spendingCapacity`; no price segment is intrinsically superior;
- completed sales reinforce cuisine/dish/ingredient/price tags with inertia; universal reliability is separate; reputation bias never makes discovery zero;
- one live `personId` has at most one visit; technical `guestId` stays separate; fulfillment/reservation always targets exact `order.itemId`;
- potato never becomes takeaway; lemonade may be assisted/takeaway/self-service. Self-service claims exact stock atomically; takeaway releases at transfer; dine-in retains place through consumption;
- accepted `serviceFormat`, service-place ownership, exact order and canonical needs persist; transient intent/presentation may re-arbitrate after load;
- one `guest-service` place belongs to at most one active guest/order; accepted commitments survive menu deactivation/edits and `served` ends timeout;
- successful purchase records once; accepted failure records once; unaccepted/technical cancellation changes neither completed nor failed count;
- shared-clock time and reputation independently bias candidates; off-schedule/discovery weight remains positive;
- agreeing groups max three: the group fits `GUEST_ACTIVE_CAP` as a unit or all record `open-unserved`; each spawned person retains independent order/needs/payment/history/opinion;
- overload or materialized no-capacity is `open-unserved`; accepted-order failure is stronger; sustained manual closure is weaker; physical guest count never exceeds `GUEST_ACTIVE_CAP`.

## Current baseline

Guests can use assisted, takeaway or exact-stock self-service paths. Orders survive interruptions, satisfaction precedes payment, and history/feedback update once per person. Affordability is a hard wealth ceiling; stable price preference shapes affordable choice; sales build inertial food and price reputation. Personal opinion/reliability affect willingness, reputation/time bias candidate composition, and popularity controls cadence.

## Not yet

Recipe book, broader ingredients/storage, real household wallet, player-authored prices, recipe complexity/margin balance, influence/word of mouth, configurable schedules, staff, seated/group payment, visible queue/forecast, event/non-food formats and competing NPC businesses.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`, `check:task-086`, `check:task-087`, `check:task-088`, `check:task-089`, `check:task-091`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-102`; focused service-format, order, population, feedback, group and live-visit Browser E2E.