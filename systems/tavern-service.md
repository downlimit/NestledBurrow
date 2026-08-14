# Tavern service

## Purpose

This system owns kitchen transformation, service facilities, tavern opening, venue offer, visitor demand, guest behavior and payment feedback.

## Player-visible contract

```text
potato → preparation → frying → serving table → dine-in guest → 4 coins
lemon + bucket water → juicer → serving table → takeout guest → 2 coins
```

The current stock-triggered guest flow is a technical baseline. The intended model reverses that causality: a persistent person first has a reason to go out, considers the venue, then creates demand that the venue may or may not satisfy.

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

## Opening hours and audience

Early play uses direct `OPEN/CLOSED` control. A later automated venue may support a schedule.

Opening time affects audience composition through real people rather than a special night multiplier. Repeatedly operating at night naturally gives more opportunities to people whose schedules, needs or preferences make night visits plausible. A closed venue creates no penalty because no service obligation was accepted.

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

## First implementation slice

The first playable replacement for anonymous stock-triggered spawning should prove identity and demand causality before implementing the whole simulation.

Use a small persistent test population rather than the final target scale. Store the full canonical need state from the start, but initially let only satiety/hunger participate in the visit decision. Add only the minimum other properties required to make the choice meaningful:

- stable identity;
- canonical need state and last evaluation time;
- layered food preferences;
- spending capacity;
- last visit time / recent-visit suppression;
- simple personal venue opinion and visit memory.

Popularity may initially use one simple tunable opportunity rate. Rich reputation propagation, groups, multiple visit motives, social influence, population lifecycle and complex popularity curves are deliberately deferred until a known persistent person can already decide to visit from hunger + active food offer + budget + memory and then complete the existing service flow.

The first success criterion is:

> Opening the tavern no longer creates a compatible anonymous customer because food exists. It gives known persistent people opportunities to consider the venue; a concrete person chooses to visit for understandable reasons and returns later as the same person.

The early player-facing priority is optimization and development: improve production, offer and capacity. Discovering individual people becomes the second layer; emergent need/social chaos becomes the third.

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

Recipe book, broader ingredient variety, storage, persistent population, need-driven demand, visitor preferences/budgets/influence, popularity/reputation, venue offer/menu, group visits, social propagation, configurable schedules, staff and broader venue formats.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`; focused Task #058 Browser E2E.
