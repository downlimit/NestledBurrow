# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and canonical `0..100` N/E/S/T/L/D needs. Player is live; offscreen people use coarse reconstruction.

## Shared person need contract

- Life: nominal `100` days / ~`40` real hours: newborn `1`, infant `4`, toddler `5`, child `11`, teen `16`, youngAdult `21`, adult `32`, elder `10`; boundaries ~±1 day. Natural life `98..102`; accidents ~`1..2%` lifetime.
- `ageYears`, `lifeStage`, `lifeStatus` and reciprocal `partner/parent/child/sibling` persist. Dead remain family history and never visit. Mature population target ~`300`.
- Sex is stable male/female near `50/50`; partners are opposite-sex. Generated people use `1000` deterministic names. Marriage surnames: `85%` wife takes husband, remaining `5/5/5%` keep/reverse/`A-B`; child side `90/10`, double survives `20%`.
- `youngAdult`/`adult` couples may have `1..3` children ≥`6` days apart. Births/day: `6@<=240`, `5@260`, `4@280`, `3@300`, `2@320`, `1@340`, `0@>=360`. Shared ancestry through great-grandparents blocks pairing; farther ancestry/surname lowers priority. Surname diversity trends to ~`90`; adult arrivals may restore roots, max `2/day`.
- `spendingCapacity` is persistent wealth/affordability, not a wallet. Есть пять уровней `2/3/4/5/6`; target weights `32:28:21:15:7` (~`31.1/27.2/20.4/14.6/6.8%`). It is a hard current price ceiling.
- Живущие супруги share one wealth level. Couples form only across same/adjacent levels and normalize to one household level. Newborn wealth is household level ±1. Adult household mobility changes one step at a time; ordinary living parent/child gap ≤2, with deterministic ~`2%` rare exceptions.
- Wealth balance may move at most two eligible adult households/day by one step. It targets the global mix and demand-relevant подгруппы of ≥`15`: preferred visit period, positive food tags and price preference. Future demand axes join this contract.
- `personEconomyProfile` derives stable `budget/neutral/premium` price preference plus sensitivity independently of wealth. Rich people may prefer cheap offers; poor people may prefer premium but never bypass affordability.
- Future household economy: one shared real coin balance. Purchases subtract coins, income adds them, dependents share it. Wealth changes slowly and separately; insufficient funds block purchase at any class, while poorer families may save for expensive purchases. Household changes cannot duplicate money; offscreen finance may be coarse.
- Children inherit food preferences and visit periods with variation. Skills/talents are not implemented.
- Visit periods: night/morning/day/evening in 6-hour blocks; preferred/off-schedule `1/0.2`. Physical guests advance needs/lifecycle and cannot die mid-visit. One N/E/S/T/L/D intent guides them; critical pressure may interrupt/resume an accepted order.
- Hover shows NESTLD after `667 ms`; at `1334 ms` family tree expands. Missing ancestors are deterministic display-only lines; fictional ancestry never enters gameplay relationships.

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

Waking: `S -7/h`, `T -6/h`, `N -1/h`, `D -2/h` without company. Activity surcharge: ordinary `0`, walking `0.5`, running `3`. At `S=15`, load/actions `1.25x`, recovery `0.8x`; at `S=0`, `1.5x/0.6x`. No normal awake regeneration. At `E<15`, 3 inactive real seconds with `S>0` start `1 E/s` recovery to `15`. Sleep restores `14 E/game hour * recovery multiplier`; `E=0` collapses ≥2 game hours and until `E=25`. Speed: `E>=30` 1; `10..30` linear `0.8..1`; `0..10` linear `0.6..0.8`. Running unavailable below `20 E`.

## Toilet, lustre and novelty

- `T<=25`: run `1.15x`, run E surcharge `1.25x`; long actions require `T>=20`. `T=0` for `10` game minutes causes the accident sequence, `-20 N`, witnessed `-15 D`, then `T=70`, `L-45`.
- L loss/hour: idle/walk/conversation/cooking `1`, running `2`, watering `1.5`, axe/hoe `3`, pickaxe `4`. `lustre speed = 1 - 0.50 * pressure(L,33)`; at `L=0`, speed `0.5x`, N drain `1.5x`.
- After three identical actions, repeats cost `1 N` with repetition pressure; activity change resets. Bucket self-use: three free uses, then `-1 N`. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`.
- NPC proximity pauses D loss; conversation restores `15..30 D`; solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`; effects are active-only.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

Need stays protected through exit. Cancel starts exit; urgent exit leaves `60%`; timelines are transient and load resumes `free`.

## Invariants

- formulas are deterministic, framework-free and JSON-safe; time drain and discrete costs are additive;
- presentation never rewrites safe motor position; `WorldLocationRuntime` owns location facility/needs lifecycle;
- population age/status/family/name/needs and `spendingCapacity` persist; dead remain family history and never visit;
- price preference never mutates wealth or bypasses affordability; spouses share one wealth level;
- wealth correction changes only eligible adult households, one step at a time, and cannot modify an active protected person;
- long-run wealth pressure targets `32:28:21:15:7` globally and in sufficiently large demand groups;
- future household coin balance is separate from wealth; explicit spending needs real money and household changes cannot duplicate it;
- fictional ancestry is presentation-only; surname equality is not proof of kinship; one family-tree box never aliases another identity.

## Current baseline

`populationDomain` owns people; `populationLifecycleDomain` advances ~300 residents. `populationWealthBalance` owns household wealth alignment, inheritance, mobility and demographic pressure. `personEconomyProfile` derives five wealth labels and price preference/sensitivity. Real household coins are future work; until then `spendingCapacity` is live affordability. Name, lineage, intent, inspection and family-tree modules retain their existing ownership.

## Evidence

`check:needs`, `check:task-100`, `check:task-101`, `check:task-102`, `check:interaction`; focused browser E2E.
