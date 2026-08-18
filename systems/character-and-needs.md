# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and canonical `0..100` needs. HUD: N novelty, E energy, S satiety, T toilet, L lustre, D dialogue. Higher is safer.

Persistent people share these needs. Player uses live runtime; offscreen people use coarse reconstruction.

## Shared person need contract

- Persistent people share canonical `N E S T L D`. Stage 3 adds deterministic `spendingCapacity` and cuisine/dish/ingredient preferences; venue history stays external.
- Stage 9 uses a nominal `100`-day life: `newborn 1`, `infant 4`, `toddler 5`, `child 11`, `teen 16`, `youngAdult 21`, `adult 32`, `elder 10` — about `40` real hours at `1x`. Each person's stage boundaries vary stably by up to about one day, so cohorts do not age in lockstep.
- `ageYears` stores lifecycle progress; `lifeStage` derives from age plus stable individual timing. `lifeStatus` and reciprocal `partner`, `parent`, `child`, `sibling` links persist with each person.
- Mature population is about `300`. Natural lifespan varies deterministically through roughly `98..102` game days. A rare age-weighted accident can kill at any stage, targeting only about `1..2%` lifetime risk. Dead residents stay in family history and cannot visit the tavern.
- Generated residents use a deterministic pool of `1000` common given names. The initial 284 generated residents receive distinct names; legacy `Resident N` placeholders are renamed during population normalization, and later births use the same pool deterministically.
- `youngAdult` and `adult` couples may have `1..3` children, at least `6` days apart. Birth targets/day: `<=240:6`, `260:5`, `280:4`, `300:3`, `320:2`, `340:1`, `>=360:0`, interpolated. This is a mean pressure: individual days vary around it instead of producing a fixed conveyor.
- New children are persistent people. Inheritance covers spending, food preferences and visit periods with parental influence plus deterministic variation. Skills/talents are not implemented.
- Existing mature residents are deterministically paired/seeded into prototype families; later unpartnered eligible adults may form an offscreen pair. Close relatives are excluded.
- Lifecycle balance assumes no general time acceleration; sleep advances the same world time. Skills, when content exists, must fit the shorter life.
- `populationDomain` owns person records, needs/demand and coarse evaluation; `populationLifecycleDomain` owns mature seeding, naming repair, pairing, daily death/birth and population balance; `personNames` owns the generated-name pool.
- Visit periods: night `00..06`, morning `06..12`, day `12..18`, evening `18..24`; preferred/off-schedule factors are `1/0.2`.
- A physical guest advances live needs/lifecycle and rebases evaluation time; death waits until that visit ends.
- One hysteretic N/E/S/T/L/D intent guides a live guest. Critical non-food pressure may interrupt accepted-order waiting and later resume it.
- Hover shows NESTLD after `667 ms`; at `1334 ms` total the card expands right into a family tree. Real parent links win; missing ancestors are deterministic display-only placeholders, never population/save entities. All seven displayed boxes are distinct person nodes and use distinct names within one tree. Coarse pointers use long-press; bar edits persist needs.

## Time, energy and satiety

One hour is `60` real seconds. Waking E/hour: ordinary `5`, walking `5.5`, running `8`. Base actions: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`, battle axe `0.1`. Targets: `20h` near-idle, `16..18h` normal, `14..16h` heavy.

Waking rates: `S -7/hour`, `T -6/hour`, `N -1/hour`, `D -2/hour` without friendly company. L depends on activity.

```text
pressure(X,q) = clamp((q - X) / q, 0, 1)
hunger = pressure(S,30)
urgency = T<=25 ? 1.25 : 1
hourly E spend = 5 + activity surcharge * (1 + 0.5 * hunger)
physical cost = base * (1 + 0.5 * hunger) * urgency * repetition
E recovery multiplier = 1 - 0.4 * hunger
```

Activity surcharge: ordinary `0`, walking `0.5`, running `3`. At `S=15`, load/actions are `1.25x` and recovery `0.8x`; at `S=0`, `1.5x/0.6x`.

No normal awake regeneration. At `E<15`, three inactive real seconds with `S>0` start catch-breath: `1 E/s` up to `15`. Sleep restores `14 E/game hour * recovery multiplier`. At `E=0`, collapse lasts at least two game hours and until `E=25`; other needs continue.

```text
E>=30: speed 1
10<=E<30: 0.80 + 0.20*(E-10)/20
0<E<10: 0.60 + 0.20*E/10
E=0: collapse
```

Running is unavailable below `20 E`.

## Toilet, lustre and movement

- `T>25`: no modifier.
- `0<=T<=25`: walk `1x`, run speed `1.15x`, run E surcharge `1.25x`.
- T never slows walking or blocks running; long actions require `T>=20`.
- `T=0` for `10` game minutes starts one unskippable accident: three `750 ms` shakes, puddle/scent hooks, `-20 N`, and witnessed `-15 D`. During the final `2 s`, T rises `0->70`, L falls `45`, then control returns.

| Activity | L loss/hour |
|---|---:|
| idle, walking, conversation, cooking | 1 |
| running | 2 |
| watering | 1.5 |
| axe/logging or hoe/soil | 3 |
| pickaxe/mining | 4 |

Resource work overrides running. Tool hits have no discrete L cost. HUD arrows show actual deltas for `660 ms`.

```text
lustre speed = 1 - 0.50 * pressure(L,33)
novelty drain multiplier = 1 + 0.5 * pressure(L,33)
```

At `L=0`, speed is `0.5x` and N drain `1.5x`. E/L compose with a `0.5..1` clamp; T affects only running.

## Novelty and dialogue

After three identical physical actions, repeats cost `1 N` and use `repetition = 1 + 0.3 * pressure(N,30)`; activity change resets. Bucket self-use has its own key: three free uses, then `-1 N`. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`; no Atoll runtime.

NPC proximity pauses D loss; conversation restores `15..30 D`; shared rest may restore D/E. Solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`; D pressure raises novelty drain up to `1.25`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`. Prompt scans without gating; activation starts A* through reachable profile points. Enter/exit never moves the motor; effects are active-only.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

The target need is protected through exit; recovery is active-only. Normal cancellation starts exit; urgent exit leaves `60%`; emergency uses profile time. Timelines are transient; load resumes `free`.

## Invariants

- formulas stay deterministic, framework-free and JSON-safe;
- time drain and discrete costs are additive;
- presentation never rewrites safe motor position;
- approach masks change automatic positioning, not timeline pose or effects;
- `WorldLocationRuntime` owns location facility/needs lifecycle;
- saves exclude debug presets and interaction timeline state; population age/status/family/needs persist, including death at a young age;
- dead people stay addressable by ID for family history and never enter ordinary visit candidate pools;
- fictional ancestry is presentation-only and can never enter relationships, saves, births or tavern demand;
- one family-tree box never aliases another displayed parent/grandparent identity.

## Current baseline

`populationDomain` owns stable person data and the named 16-person compatibility baseline; `populationLifecycleDomain` expands a mature world to 300, assigns generated names, advances varied generations and balances births. `personNames` owns 1000 generated-name variants. `guestIntentDomain` advances live needs/lifecycle. `personInspectionRuntime` owns selection/need edits and two-stage family presentation; `personFamilyTree` fills only missing historical ancestry. Timeline owners remain separate.

## Evidence

`check:needs`, `check:task-061`, `check:task-065`, `check:task-067`, `check:task-070`, `check:task-071`, `check:task-086`, `check:task-088`, `check:task-090`, `check:task-091`, `check:task-096`, `check:task-098`, `check:task-099`, `check:task-100`, `check:interaction`; focused browser E2E.
