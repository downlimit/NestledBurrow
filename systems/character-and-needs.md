# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and canonical `0..100` N/E/S/T/L/D needs. Player is live; offscreen people use coarse reconstruction.

## Shared person need contract

- Life: nominal `100` days/~`40` real hours: newborn `1`, infant `4`, toddler `5`, child `11`, teen `16`, youngAdult `21`, adult `32`, elder `10`; natural `98..102`, accidents ~`1..2%`. Age/status and reciprocal `partner/parent/child/sibling` persist; dead remain family history. Mature population ~`300`.
- Sex is male/female near `50/50`; partners opposite-sex. Generated pool `1000` names. Marriage surname: `85%` wife takes husband; other `5/5/5%` keep/reverse/`A-B`; child side `90/10`, double survives `20%`.
- `youngAdult`/`adult` couples may have `1..3` children ≥`6` days apart. Births/day: `6@<=240`, `5@260`, `4@280`, `3@300`, `2@320`, `1@340`, `0@>=360`; close ancestry blocks pairing. Surname diversity trends ~`90`; arrivals max `2/day`.
- `spendingCapacity` is wealth/affordability, not a wallet. Есть пять уровней `2/3/4/5/6`; target `32:28:21:15:7`; higher price is unavailable.
- Живущие супруги share one wealth level; couples form across same/adjacent levels. Newborn wealth = household ±1; ordinary mobility = one step, parent/child gap ≤2, ~`2%` rare exceptions.
- Wealth balance moves ≤2 eligible adult households/day by one step and targets the global mix plus demand-relevant подгруппы ≥`15` (visit period, food tags, price preference).
- `personEconomyProfile` gives deterministic `budget/neutral/premium` preference + sensitivity independently of wealth; it never bypasses affordability.
- Future household economy: one real shared coin balance; wealth sets household-level income/ordinary expense/reserve, workers add income, dependents add expense, purchases subtract coins, sustained reserve pressure may slowly change wealth. Individual salaries wait for NPC professions.
- Children inherit food/visit preferences with variation. Skills/talents not implemented.
- Visit periods: night/morning/day/evening; preferred/off-schedule `1/0.2`. Physical guests advance needs/lifecycle and cannot die mid-visit.
- Hover shows NESTLD after `667 ms`; at `1334 ms` family tree expands; fictional ancestry is display-only.

## Time, energy and satiety

One hour is `60` real seconds. E/hour: ordinary `5`, walking `5.5`, running `8`; action costs: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`, battle axe `0.1`.

```text
pressure(X,q) = clamp((q - X) / q, 0, 1)
hunger = pressure(S,30)
urgency = T<=25 ? 1.25 : 1
hourly E spend = 5 + activity surcharge * (1 + 0.5 * hunger)
physical cost = base * (1 + 0.5 * hunger) * urgency * repetition
E recovery multiplier = 1 - 0.4 * hunger
```

Waking: `S -7/h`, `T -6/h`, `N -1/h`, `D -2/h` alone. Activity surcharge ordinary `0`, walking `0.5`, running `3`. At `S=15`: load/actions `1.25x`, recovery `0.8x`; `S=0`: `1.5x/0.6x`. At `E<15`, 3 inactive real seconds with `S>0` starts `1 E/s` to `15`. Sleep restores `14 E/game hour * recovery multiplier`; `E=0` collapses ≥2 game hours and until `E=25`. Speed: `E>=30` 1; `10..30` linear `0.8..1`; `0..10` linear `0.6..0.8`; running blocked below `20 E`.

## Toilet, lustre and novelty

- `T<=25`: run `1.15x`, run E surcharge `1.25x`; long actions require `T>=20`. `T=0` for `10` game minutes -> accident, `-20 N`, witnessed `-15 D`, then `T=70`, `L-45`.
- L loss/hour: idle/walk/conversation/cooking `1`, running `2`, watering `1.5`, axe/hoe `3`, pickaxe `4`. `lustre speed = 1 - 0.50 * pressure(L,33)`; `L=0` -> speed `0.5x`, N drain `1.5x`.
- After three identical actions repeats cost `1 N`; activity change resets. Bucket self-use: three free uses, then `-1 N`. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`.
- NPC proximity pauses D loss; conversation restores `15..30 D`; solo-rest E multiplier `1 - 0.25 * pressure(D,30)`.

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
- price preference never changes wealth or bypasses affordability; spouses share wealth;
- wealth correction moves eligible adult households only, one step at a time; long-run target `32:28:21:15:7`;
- household coins are separate from wealth and cannot duplicate through family changes;
- fictional ancestry is presentation-only.

## Current baseline

`populationDomain` owns people; `populationLifecycleDomain` advances ~300 residents; `populationWealthBalance` owns household wealth/mobility; `personEconomyProfile` owns wealth labels and price preference. Real household coins are future work.

## Evidence

`check:needs`, `check:task-100`, `check:task-101`, `check:task-102`, `check:interaction`; focused browser E2E.
