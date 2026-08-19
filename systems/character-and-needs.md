# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and canonical `0..100` N/E/S/T/L/D needs. Higher is safer; player is live, offscreen people use coarse reconstruction.

## Shared person need contract

- Stage 3 gives persistent people spending capacity and food preferences. Stage 9 nominal life is `100` days / ~`40` real hours: `newborn 1`, `infant 4`, `toddler 5`, `child 11`, `teen 16`, `youngAdult 21`, `adult 32`, `elder 10`; individual boundaries vary by about ±1 day.
- `ageYears` stores progress; `lifeStage` derives from age/timing. `lifeStatus` and reciprocal `partner/parent/child/sibling` links persist. Mature population targets ~`300`; natural life is `98..102` days and rare accidents target ~`1..2%` lifetime risk. Dead residents remain in family history and never visit.
- Generated residents use a deterministic `1000`-name pool; legacy `Resident N` names are repaired. Real residents have stable surnames and unrelated founder lines are distinct where possible. Pairing surname outcomes are `85%` wife-side takes husband-side, `5%` both keep, `5%` reverse, `5%` both take hyphenated `A-B`; children inherit paternal/maternal side `90/10`. A double surname survives child inheritance in `20%`, otherwise one component remains; marriage never stacks beyond two components.
- `youngAdult`/`adult` couples may have `1..3` children ≥`6` days apart. Mean births/day: `<=240:6`, `260:5`, `280:4`, `300:3`, `320:2`, `340:1`, `>=360:0`, interpolated with daily variation. Shared ancestry through great-grandparents forbids pairing; farther known ancestry and shared surname only lower pairing priority. Large living surname lines receive a mild `0.8..1.2` birth-priority correction without changing the daily birth target.
- Children persist and inherit spending, food preferences and visit periods with variation. Skills/talents are not implemented. No general time acceleration; sleep advances world time. `populationDomain` owns person data; `populationLifecycleDomain` owns generations; `personNames` and `personFamilyNames` own given-name and surname policy.
- Visit periods: night `00..06`, morning `06..12`, day `12..18`, evening `18..24`; preferred/off-schedule factors `1/0.2`. Physical guests advance live needs/lifecycle and cannot die mid-visit.
- One hysteretic N/E/S/T/L/D intent guides a live guest; critical non-food pressure may interrupt accepted-order waiting and later resume it.
- Hover shows NESTLD after `667 ms`; at `1334 ms` the card expands into a family tree. Real parents win; missing ancestors are deterministic display-only placeholders with surnames, never population/save entities. Long full names stay still until their own cell is hovered; then a looped marquee starts after `1 s`, and cursor leave lets the current loop finish before stopping. Coarse pointers use long-press and bar edits persist.

## Time, energy and satiety

One hour is `60` real seconds. E/hour: ordinary `5`, walking `5.5`, running `8`. Actions: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`, battle axe `0.1`. Targets: `20h` near-idle, `16..18h` normal, `14..16h` heavy.

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
- `T=0` for `10` game minutes starts one unskippable accident: three `750 ms` shakes, puddle/scent hooks, `-20 N`, witnessed `-15 D`; final `2 s` raises T `0->70`, lowers L `45`, then returns control.

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

After three identical actions, repeats cost `1 N` and use `repetition = 1 + 0.3 * pressure(N,30)`; activity change resets. Bucket self-use: three free uses, then `-1 N`. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`.

NPC proximity pauses D loss; conversation restores `15..30 D`; shared rest may restore D/E. Solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`; D pressure raises novelty drain to `1.25`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`. Activation uses A* through reachable profile points; enter/exit never moves the motor and effects are active-only.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

The target need is protected through exit; recovery is active-only. Normal cancel starts exit; urgent exit leaves `60%`; emergency uses profile time. Timelines are transient; load resumes `free`.

## Invariants

- formulas stay deterministic, framework-free and JSON-safe; time drain and discrete costs are additive;
- presentation never rewrites safe motor position; approach masks alter automatic positioning, not timeline effects;
- `WorldLocationRuntime` owns location facility/needs lifecycle;
- saves exclude debug presets/timeline state; population age/status/family/full-name/needs persist, including early death;
- dead people remain addressable for family history and never enter ordinary visit candidate pools;
- fictional ancestry is presentation-only and never enters relationships, saves, births or tavern demand;
- surname equality is presentation evidence, never proof of kinship; ancestry graph is authoritative;
- one family-tree box never aliases another displayed identity.

## Current baseline

`populationDomain` owns person data and the named baseline; `populationLifecycleDomain` expands worlds to 300 and advances generations. `personNames`/`personFamilyNames`, `guestIntentDomain`, `personInspectionRuntime` and `personFamilyTree` own names, surname policy, live lifecycle, inspection and missing-history presentation.

## Evidence

`check:needs`, `check:task-061`, `check:task-065`, `check:task-067`, `check:task-070`, `check:task-071`, `check:task-086`, `check:task-088`, `check:task-090`, `check:task-091`, `check:task-096`, `check:task-098`, `check:task-099`, `check:task-100`, `check:task-101`, `check:interaction`; focused browser E2E.
