# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and canonical `0..100` N/E/S/T/L/D needs. Higher is safer; player is live, offscreen people use coarse reconstruction.

## Shared person need contract

- Life: nominal `100` days / ~`40` real hours: newborn `1`, infant `4`, toddler `5`, child `11`, teen `16`, youngAdult `21`, adult `32`, elder `10`; boundaries vary ~±1 day. Natural life `98..102` days; accidents ~`1..2%` lifetime.
- `ageYears`, derived `lifeStage`, `lifeStatus` and reciprocal `partner/parent/child/sibling` persist. Dead remain family history and never visit. Mature population targets ~`300`.
- Every resident resolves to stable male/female sex. Generated people are deterministic and near `50/50`; `partner` is valid only across opposite sexes and invalid same-sex partner edges are repaired. Husband/wife surname roles follow sex.
- Generated residents use a deterministic `1000`-name pool; legacy names are repaired. Founder lines are distinct where possible. Marriage surnames: `85%` wife takes husband, `5%` both keep, `5%` reverse, `5%` both take `A-B`. Children inherit paternal/maternal side `90/10`; double surname survives in `20%`, else one component; max two components.
- `youngAdult`/`adult` couples may have `1..3` children ≥`6` days apart. Mean births/day: `6@<=240`, `5@260`, `4@280`, `3@300`, `2@320`, `1@340`, `0@>=360`, interpolated with daily variation. Shared ancestry through great-grandparents blocks pairing; farther ancestry/shared surname only lowers priority.
- Dense bloodlines lose birth priority and may be capped at fewer children. Visible surname diversity trends toward ~`90`: intervention starts below `105`, strengthens below `90`, strong floor `75`. Some replenishment slots become adult arrivals, max `2/day`; when possible `95%` restore an extinct surname root, `5%` introduce unused surnames. Arrivals have display-only missing ancestry.
- `spendingCapacity` remains the persistent purchasing-power/wealth proxy (`2/4/6` in the current balance) and is inherited by children with variation. It is a hard affordability ceiling, not a taste for cheap or expensive goods.
- `personEconomyProfile` derives a stable price preference (`budget/neutral/premium`) and preference strength from person identity independently of wealth. A rich person may prefer cheap offers; a low-wealth person may prefer premium offers but cannot bypass `spendingCapacity`. Neutral people receive no price-band preference effect. These derived traits are recoverable from stable ID and are not additional save fields.
- Children inherit spending, food preferences and visit periods with variation. Skills/talents are not implemented.
- Visit periods: night `00..06`, morning `06..12`, day `12..18`, evening `18..24`; preferred/off-schedule `1/0.2`. Physical guests advance live needs/lifecycle and cannot die mid-visit.
- One N/E/S/T/L/D intent guides a live guest; critical non-food pressure may interrupt accepted-order waiting and resume.
- Hover shows NESTLD after `667 ms`; at `1334 ms` family tree expands. Missing ancestors are deterministic display-only opposite-sex family lines with plausible surname flow. Names are clipped per cell; long names scroll immediately on hover, loop, wait `1 s`, and repeat while hovered. Cursor leave lets the active loop finish. `СЕМЬЯ/FAMILY` is centered; expanded header adds localized age stage with sex-aware Russian grammar.

## Time, energy and satiety

One hour is `60` real seconds. E/hour: ordinary `5`, walking `5.5`, running `8`. Actions: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`, battle axe `0.1`. Targets: `20h` idle, `16..18h` normal, `14..16h` heavy.

Waking rates: `S -7/hour`, `T -6/hour`, `N -1/hour`, `D -2/hour` without friendly company. L depends on activity.

```text
pressure(X,q) = clamp((q - X) / q, 0, 1)
hunger = pressure(S,30)
urgency = T<=25 ? 1.25 : 1
hourly E spend = 5 + activity surcharge * (1 + 0.5 * hunger)
physical cost = base * (1 + 0.5 * hunger) * urgency * repetition
E recovery multiplier = 1 - 0.4 * hunger
```

Activity surcharge: ordinary `0`, walking `0.5`, running `3`. At `S=15`, load/actions `1.25x`, recovery `0.8x`; at `S=0`, `1.5x/0.6x`.

No normal awake regeneration. At `E<15`, three inactive real seconds with `S>0` start catch-breath: `1 E/s` up to `15`. Sleep restores `14 E/game hour * recovery multiplier`. At `E=0`, collapse lasts ≥2 game hours and until `E=25`.

```text
E>=30: speed 1
10<=E<30: 0.80 + 0.20*(E-10)/20
0<E<10: 0.60 + 0.20*E/10
E=0: collapse
```

Running is unavailable below `20 E`.

## Toilet, lustre and movement

- `T>25`: no modifier; `0<=T<=25`: walk `1x`, run `1.15x`, run E surcharge `1.25x`; long actions require `T>=20`.
- `T=0` for `10` game minutes starts one unskippable accident: three `750 ms` shakes, puddle/scent hooks, `-20 N`, witnessed `-15 D`; final `2 s` raises T `0->70`, lowers L `45`.
- L loss/hour: idle/walk/conversation/cooking `1`, running `2`, watering `1.5`, axe/hoe `3`, pickaxe `4`. Resource work overrides running; tool hits have no discrete L cost. HUD arrows show deltas for `660 ms`.

```text
lustre speed = 1 - 0.50 * pressure(L,33)
novelty drain multiplier = 1 + 0.5 * pressure(L,33)
```

At `L=0`, speed `0.5x`, N drain `1.5x`. E/L compose with a `0.5..1` clamp; T affects only running.

## Novelty and dialogue

After three identical actions, repeats cost `1 N` and use `repetition = 1 + 0.3 * pressure(N,30)`; activity change resets. Bucket self-use: three free uses, then `-1 N`. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`.

NPC proximity pauses D loss; conversation restores `15..30 D`; shared rest may restore D/E. Solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`; D pressure raises novelty drain to `1.25`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`; A* reaches profile points, enter/exit never moves the motor, effects are active-only.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

Target need stays protected through exit. Cancel starts exit; urgent exit leaves `60%`; emergency uses profile time. Timelines are transient; load resumes `free`.

## Invariants

- formulas stay deterministic, framework-free and JSON-safe; time drain and discrete costs are additive;
- presentation never rewrites safe motor position; approach masks alter automatic positioning, not timeline effects;
- `WorldLocationRuntime` owns location facility/needs lifecycle;
- saves exclude debug presets/timeline state; population age/status/family/full-name/needs persist, including early death;
- `spendingCapacity` is persistent wealth/affordability; derived price preference never mutates wealth and never bypasses affordability;
- dead people remain addressable for family history and never enter ordinary visit pools;
- fictional ancestry is presentation-only and never enters relationships, saves, births or tavern demand;
- surname equality is presentation evidence, never proof of kinship; ancestry graph is authoritative;
- one family-tree box never aliases another displayed identity.

## Current baseline

`populationDomain` owns person data; `populationLifecycleDomain` expands worlds to 300 and advances generations. `personEconomyProfile` derives wealth labels and stable price preference/sensitivity without adding save state. `personNames`/`personFamilyNames`, `populationLineageBalance`, `guestIntentDomain`, `personInspectionRuntime` and `personFamilyTree` own names, lineage renewal, live lifecycle, inspection and missing-history presentation.

## Evidence

`check:needs`, `check:task-100`, `check:task-101`, `check:task-102`, `check:interaction`; focused browser E2E.
