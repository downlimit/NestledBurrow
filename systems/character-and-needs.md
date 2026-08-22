# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and `0..100` N/E/S/T/L/D needs; offscreen people use coarse reconstruction.

## Shared person need contract

- Life: nominal `100` days/~`40` real hours: newborn `1`, infant `4`, toddler `5`, child `11`, teen `16`, youngAdult `21`, adult `32`, elder `10`; natural `98..102`, accidents ~`1..2%`. Age/status and reciprocal `partner/parent/child/sibling` persist; dead remain family history. Population ~`300`.
- Sex male/female near `50/50`; partners opposite-sex. Generated pool `1000` names. Surname rules persist across marriage/children.
- `youngAdult`/`adult` couples may have `1..3` children ≥`6` days apart. Births/day fall from `6@<=240` to `0@>=360`; close ancestry blocks pairing; arrivals max `2/day`.
- `spendingCapacity` — пять уровней достатка/дохода `2/3/4/5/6`, не кошелёк. Цель населения **`22:31:24:16:7`**: средне-бедный уровень крупнейший, бедных меньше, далее доля убывает к `7%`.
- Живущие супруги share one wealth level; пары образуются между тем же/соседним уровнем. Newborn wealth = household ±1; обычный межпоколенческий разрыв ≤2, ~`2%` rare exceptions.
- `populationWealthBalance`: редкое карьерно-экономическое событие (`2%`/день на eligible household) меняет достаток на ±1; max `2`/day. Цель `22:31:24:16:7` и спросовые подгруппы ≥`15` лишь смещают вероятность направления. Сумма денег класс не задаёт.
- `personEconomyProfile`: стабильное `budget/neutral/premium` предпочтение независимо от достатка; оно не создаёт денег и не меняет класс.
- `householdEconomy` хранит реальный общий баланс отдельно от достатка. Супруги и зависимые `newborn/infant/toddler/child/teen` используют один кошелёк; молодой взрослый отделяется, если не образовал пару.
- Опорные накопления домохозяйства: `5 000 / 15 000 / 45 000 / 120 000 / 300 000`; это характерный масштаб, не лимит. Доход работающего взрослого: `500 / 1 500 / 4 000 / 10 000 / 25 000`/день; `elder` даёт `0.75` доли. Профессии позже заменят фоновые источники.
- Доход и траты колеблются. Обязательные расходы идут всегда, гибкие уменьшаются при низком запасе и растут при высоком, поэтому накопления держатся в широком диапазоне вместо бесконечного роста. Текущий баланс сам по себе класс **не меняет**.
- Покупка резервирует реальные монеты; резерв нельзя потратить второй раз или фоновыми расходами. Отмена возвращает резерв, успешная оплата списывает один раз.
- При браке/взрослении/разделении семьи существующие монеты переносятся, объединяются или делятся без дублирования. Повышение/понижение сохраняет накопления и меняет будущий денежный поток.
- Visit periods night/morning/day/evening use preferred/off-schedule `1/0.2`; physical guests cannot die mid-visit.
- Hover NESTLD: `667 ms`; family tree: `1334 ms`; ancestry is display-only.

## Time, energy and satiety

One hour is `60` real seconds. E/hour: ordinary `5`, walking `5.5`, running `8`; action costs: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`.

```text
pressure(X,q) = clamp((q - X) / q, 0, 1)
hunger = pressure(S,30)
urgency = T<=25 ? 1.25 : 1
hourly E spend = 5 + activity surcharge * (1 + 0.5 * hunger)
physical cost = base * (1 + 0.5 * hunger) * urgency * repetition
E recovery multiplier = 1 - 0.4 * hunger
```

Waking: `S -7/h`, `T -6/h`, `N -1/h`, `D -2/h`; activity surcharge walk `0.5`, run `3`. `S=15`: load/actions `1.25x`, recovery `0.8x`; `S=0`: `1.5x/0.6x`. At `E<15`, 3 inactive real seconds with `S>0` starts `1 E/s` to `15`. Sleep restores `14 E/game hour * recovery multiplier`; `E=0` collapses ≥2 game hours until `E=25`. Running blocked below `20 E`.

## Toilet, lustre and novelty

- `T<=25`: run `1.15x`, E surcharge `1.25x`; long actions need `T>=20`. `T=0` for `10` game minutes -> accident, then `T=70`, `L-45`.
- L loss/hour: idle/walk/conversation/cooking `1`, running `2`, watering `1.5`, axe/hoe `3`, pickaxe `4`. `lustre speed = 1 - 0.50 * pressure(L,33)`; `L=0` -> speed `0.5x`, N drain `1.5x`.
- After three identical actions repeats cost `1 N`; activity change resets. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`.
- NPC proximity pauses D loss; conversation restores `15..30 D`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`; effects are active-only.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

Need stays protected through exit. Cancel starts exit; urgent exit leaves `60%`; load resumes `free`.

## Invariants

- formulas deterministic/JSON-safe; time drain and discrete costs additive;
- world-location runtime owns location/facility/needs lifecycle;
- population identity/family/needs/wealth persist; dead never visit;
- price preference never changes wealth and never bypasses affordability; spouses share wealth;
- wealth correction moves eligible adult households only, one step at a time; long-run target `22:31:24:16:7`;
- карьерная мобильность реализует эту коррекцию редкими событиями; баланс лишь смещает вероятность;
- household coins separate from wealth; one family has one spendable balance, reservations cannot double-spend, family transitions conserve money;
- fictional ancestry is presentation-only.

## Current baseline

`populationDomain` owns people; `populationLifecycleDomain` advances ~300 residents; `populationWealthBalance` owns wealth/career events; `personEconomyProfile` owns price preference; `householdEconomyDomain` owns shared money, cashflow and reservations.

## Evidence
`check:needs`, `check:task-100`, `check:task-101`, `check:task-102`, `check:task-103`, `check:interaction`; browser E2E.