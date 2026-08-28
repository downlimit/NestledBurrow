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
- **Person (`person`)** — stable identity with needs, preferences, income class and history; **candidate** considers the venue, **guest** is the same person after a materialized visit.
- **Needs / visit motive / visit opportunity** — needs create a reason to visit; an opportunity is one bounded chance to consider the venue.
- **Popularity (`popularity`)** — bounded persistent flow pressure controlling opportunity cadence; it is not reputation or wealth.
- **Reputation profile (`reputationProfile`)** — descriptive venue identity from observed food/price tags plus separate universal reliability evidence; candidate discovery always stays positive.
- **Personal venue opinion (`venueOpinion`)** — one person's bounded direct-experience attitude, drifting slowly toward neutral.
- **Venue offer (`venueOffer`)** — currently promised menu/facilities; unoffered stock creates no demand.
- **Food preference (`foodPreference`)** — cuisine, dish-class and ingredient tastes.
- **Ценовой сегмент (`priceBand`)** — `budget/standard/premium`; current prototype thresholds `<=2`, `<=4`, `>4` coins.
- **Ценовое предпочтение (`pricePreference`)** — stable `budget/premium/neutral` taste independent of wealth.
- **Ценовая чувствительность (`priceSensitivity`)** — strength of a non-neutral price preference.
- **Offer fit (`offerFit`)** — motive + food taste + price preference among currently payable items.
- **Visit memory / recent-visit suppression** — remembered outcomes and a soft repeat-visit reduction that fades with time.
- **Spending capacity (`spendingCapacity`)** — historical field name for the persistent five-level income/wealth class; it is not a second wallet and no longer directly forbids a price.
- **Семейный кошелёк (`householdEconomy`)** — реальный общий запас монет домохозяйства; свободный остаток является жёсткой денежной проверкой покупки.
- **Potential demand / service capacity** — willing visitors before physical constraints / visits the live venue can actually admit and serve.
- **Group** — linked multi-person visit; **audience composition** — derived population mix, never a currency.

## How demand is formed

```text
open/scheduled venue
→ popularity schedules an opportunity
→ persistent candidate, reputation-biased but never hard-locked
→ reconstruct offscreen needs → motive
→ compare offer with motive, tastes, price preference and free household coins
→ apply reputation, personal opinion and recent-visit suppression
→ person/group decides
→ reserve real household money for each materialized order
→ physical capacity admits or records open-unserved
→ same persistent person becomes a live guest
→ service/facilities/people create experience
→ payment settles the reserved family money
→ memory/opinion update
→ completed sale updates food/price reputation and weakly reinforces flow
```

Popularity controls **reach**; needs create **motive**; offer/taste/price/cash/reputation/opinion determine **choice**; physical service determines **conversion**. Flow never changes wealth. Pre-commitment mismatch is missed revenue, not service failure. Reputation has inertia, but discovery stays nonzero so a changed venue can redirect its audience.

## Flow density and offscreen people

Current opportunity cadence `3..8` real seconds is prototype instrumentation. Flow grows slowly; direct experience dominates return choice. Above `GUEST_ACTIVE_CAP`, willing demand records deterministic `open-unserved`. Sustained manual closure has a weaker recoverable penalty than being open and unable to serve.

Offscreen people reconstruct from elapsed world time only when relevant. A physical guest advances canonical needs live on the same persistent person.

## Возраст посетителей

Естественный поток зависит от возраста, но принудительные TEST/E2E-вызовы конкретного человека могут обходить этот фильтр для диагностики.

- `newborn`, `infant`, `toddler` и `child` никогда не становятся инициаторами обычного визита;
- `newborn/infant/toddler` появляются в таверне **крайне редко** и только как сопровождаемый ребёнок собственного родителя; текущий стартовый шанс такого присоединения к подходящему родительскому визиту — `3%`;
- `child` тоже приходит только с родителем, но заметно чаще маленьких детей; стартовый шанс присоединения — `30%`;
- `teen` может инициировать визит, но его вес в естественном потоке сейчас `0.2` от обычного взрослого;
- если подросток инициировал групповой визит, примерно `70%` таких случаев пытаются собрать доступных родителей, `20%` — компанию других подростков, оставшиеся `10%` остаются одиночными;
- подросток также может присоединиться к родительскому визиту. Эти числа являются стартовым балансом, а не отдельными социальными классами.

## Venue formats

No persisted venue-format switch exists. The sale profile and live infrastructure choose per visit:
- `fried-potato-dish`: assisted dine-in or exact-stock self-service;
- `lemonade`: assisted dine-in, takeaway or exact-stock self-service.

Self-service atomically claims a free service place plus exact unreserved displayed stock and skips `take-order`; failed capture may fall back to an available ordinary path. Takeaway requires a portable item and releases its service place after transfer. Missing physical capacity after a positive decision is `open-unserved`. Event service waits for real activity infrastructure.

## Food offer and pricing

- Prices are fixed for now; the player controls assortment, quality, quantity and fulfillment. Player-authored prices are future work.
- Recipe complexity and price segment are independent. Expensive is not intrinsically better and cheap is not intrinsically worse.
- Для будущих пяти классов блюд стартовая **балансная** лестница цен: `10 / 30 / 80 / 200 / 500`. Это опорные числа для экономики и длинных симуляций, а не автоматическая замена текущих двух prototype prices `2/4`.
- Реальный семейный кошелёк — единственный жёсткий денежный барьер. Уровень достатка определяет масштаб доходов/накоплений семьи, поэтому богатые в среднем легче восполняют крупные траты, но сам по себе класс не запрещает бедной семье купить дорогое блюдо, если деньги реально накоплены.
- Ценовое предпочтение остаётся отдельным вкусом: богатый может любить дешёвое, бедный — дорогое. Оно влияет на выбор, но не создаёт деньги и не меняет класс.
- Neutral people ignore price segment. The player may legally run only cheap, only middle or only premium food; mixed-price menus are never mandatory.
- Food taste layers are cuisine/origin, dish class and ingredients. Unsuitable offer without commitment is missed revenue without feedback damage.
- Dish quality `bronze → silver → gold → platinum` is probabilistic from ingredient quality, cooking skill, equipment, recipe difficulty and modifiers; no hard tier cap. Recipes aggregate ingredient quality by default, with weights only for meaningful exceptions.

## Плейсхолдерная экономика рецептов

Балансная модель пяти будущих классов не добавляет новые блюда в живое меню. Она проверяет, что массовая дешёвая и редкая дорогая кухня остаются разными, но жизнеспособными стратегиями до создания реального контента.

- цена: **`10 / 30 / 80 / 200 / 500`**;
- полная производственная нагрузка на порцию: **`1 / 3 / 8 / 20 / 50`** условных единиц;
- часть, требующая собственно кулинарного мастерства: **`1 / 2 / 4 / 7 / 10`**;
- остальная повторяющаяся работа добычи, логистики, подготовки и обработки: **`0 / 1 / 4 / 13 / 40`**.

Условная единица нагрузки не равна секунде, количеству ингредиентов или будущему числу действий. Она нужна только для сравнения стратегий. Цена на единицу полной нагрузки одинакова у всех пяти уровней, поэтому дорогая кухня не получает бесплатное преимущество только из-за малого числа заказов.

На целевом составе населения `22:31:24:16:7` частота повода для уровней калибруется примерно как **`100% / 37.5% / 18.4% / 11.0% / 7.7%`**. Это мягкая привычность цены относительно образа жизни, а не разрешение на покупку: реальный кошелёк остаётся единственным денежным запретом. При одинаковом нормальном потоке длинная базовая выручка пяти специализаций получается сопоставимой, но дорогие уровни намного более волатильны. Более бедная аудитория естественно усиливает дешёвую кухню, более богатая — дорогую.

Автоматизация снимает прежде всего повторяющуюся часть производства. Обычные помощники могут почти полностью разгрузить простую кухню, но на сложной хуже справляются с точной работой и автономным завершением, что выражается скоростью, потерей качества или перерасходом ресурсов. Точные проценты помощников в `Task #104` являются только симуляционными профилями, не финальными характеристиками. Жёсткого запрета нет: специализированная дорогая инфраструктура должна позволять приблизиться к полной автоматизации сложной кухни, сохраняя преимущество хорошей ручной работы раньше по прогрессии.

## Household payment

После положительного решения цена выбранного блюда резервируется из свободных денег семейного кошелька до появления физического гостя. Несколько членов одной семьи не могут одновременно обещать одни и те же монеты: последующие решения видят уже уменьшенный свободный остаток.

Если визит не материализовался, заказ сорвался или гость ушёл без покупки, резерв снимается. При успешной оплате резерв списывается ровно один раз; только после успешного списания появляется монета игроку и записывается завершённая покупка. Фоновые семейные расходы не могут потратить уже зарезервированные деньги. Активный заказ после загрузки восстанавливает соответствующий резерв.

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

Implemented slices: persistent population → venue offer → visit decision → exact order/fulfillment → live guest needs → feedback/reputation/flow → groups/time → visit-local service formats → social lifecycle → price audience → real household funds and age-aware visits → placeholder recipe economy/automation balance. Early play prioritizes optimization, then recognizable people, then need-driven social situations.

## Owners

- kitchen: `src/tavern/cookingDomain.js`, `src/tavern/cookingRuntime.js`, `src/tavern/kitchenInteractionRuntime.js`;
- facilities/sign/menu: `src/facilities/facilityConfig.js`, `src/facilities/facilityRuntime.js`, `src/tavern/tavernSignRuntime.js`, `src/tavern/venueOfferDomain.js`, `src/tavern/venueMenuRuntime.js`;
- demand/groups: `src/tavern/visitDemandDomain.js`, `src/tavern/visitPartyDomain.js`, `src/tavern/saleProfileDomain.js`;
- service/guests: `src/tavern/tavernServiceDomain.js`, `src/tavern/tavernServiceRuntime.js`, `src/tavern/guestRuntime.js`, `src/tavern/guestController.js`, `src/tavern/gridPathfinder.js`, `src/tavern/guestIntentDomain.js`;
- orders/feedback/payment: `src/tavern/orderDomain.js`, `src/tavern/tavernFeedbackDomain.js`, `src/tavern/guestFeedback.js`, `src/tavern/coinRuntime.js`, `src/tavern/overheadPresentationRuntime.js`;
- people/wealth/food preferences: `src/character/populationDomain.js`, `src/character/populationWealthBalance.js`, `src/character/personEconomyProfile.js`;
- household money: `src/character/householdEconomyDomain.js`;
- `WorldScene` composes owners and delegates callbacks.

## Invariants

- kitchen stock is JSON-safe, stable-table-owned, zero/one portion with at most one guest reservation; recipe inventory changes are atomic;
- facility positions are read live; moved furniture changes only the assigned path; the movable tavern sign shares one position across visual/collider/interaction/guest check;
- sign, offer, stock reservation, service place and order lifecycle cannot contradict; `venueOffer` stays independent from physical stock;
- popularity controls opportunity cadence only; it cannot mutate tastes, wealth, price preference, opinions or reputation;
- income class, free household coins, price preference, food taste, opinion, reputation and flow remain distinct; only real free household coins are the hard monetary gate;
- placeholder recipe tier changes soft lifestyle frequency and production load, never creates a second affordability gate;
- automation may reduce routine work strongly, but complex work keeps a larger mastery-sensitive residue until sufficiently specialized investment exists;
- a materialized visit reserves its exact price; one household cannot double-spend that money; only successful settlement can create the player's sale value;
- completed sales reinforce cuisine/dish/ingredient/price tags with inertia; universal reliability is separate; reputation bias never makes discovery zero;
- one live `personId` has at most one visit; technical `guestId` stays separate; fulfillment/reservation always targets exact `order.itemId`;
- tiny children never lead natural visits; any tiny child guest is accompanied through a parent group; teens remain a reduced but nonzero natural audience;
- potato never becomes takeaway; lemonade may be assisted/takeaway/self-service. Self-service claims exact stock atomically; takeaway releases at transfer; dine-in retains place through consumption;
- accepted `serviceFormat`, service-place ownership, exact order and canonical needs persist; transient intent/presentation may re-arbitrate after load;
- one `guest-service` place belongs to at most one active guest/order; accepted commitments survive menu deactivation/edits and `served` ends timeout;
- successful purchase records once; accepted failure records once; unaccepted/technical cancellation changes neither completed nor failed count;
- shared-clock time and reputation independently bias candidates; off-schedule/discovery weight remains positive;
- agreeing groups max three: the group fits `GUEST_ACTIVE_CAP` as a unit or all record `open-unserved`; each spawned person retains independent order/needs/payment/history/opinion;
- overload or materialized no-capacity is `open-unserved`; accepted-order failure is stronger; sustained manual closure is weaker; physical guest count never exceeds `GUEST_ACTIVE_CAP`.

## Current baseline

Guests can use assisted, takeaway or exact-stock self-service paths. Orders survive interruptions, satisfaction precedes payment, and history/feedback update once per person. A purchase requires enough free money in the shared household wallet; `spendingCapacity` is now the persistent income class rather than a second price ceiling. Purchase funds are reserved before materialization and settled at payment. Stable price preference shapes choice; sales build inertial food and price reputation. Natural visitor composition also respects life stage: small children only accompany parents, teens appear less often and usually with family. Five future recipe tiers now have a non-player-visible balance model for price, production load, lifestyle frequency and automation pressure; current potato/lemonade content is unchanged.

## Not yet

Recipe book, broader ingredients/storage, player-authored prices, real five-dish mapping, final helper/minion stats, individual NPC professions/salaries, influence/word of mouth, configurable schedules, staff, seated/group payment, visible queue/forecast, event/non-food formats and competing NPC businesses.

## Evidence

`check:cooking`, `check:guest`, `check:facilities`, `check:task-049`, `check:task-058`, `check:task-086`, `check:task-087`, `check:task-088`, `check:task-089`, `check:task-091`, `check:task-095`, `check:task-096`, `check:task-097`, `check:task-102`, `check:task-103`, `check:task-104`; focused service-format, order, population, feedback, group and live-visit Browser E2E.