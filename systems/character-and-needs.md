# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and `0..100` needs. Fixed HUD order: N novelty, E energy, S satiety, T toilet, L lustre, D dialogue. Higher values remove pressure; no passive bonus stack.

## Time, energy and satiety

One hour is `60` real seconds. Waking E: ordinary `5/hour`, walking `5.5`, running `8`. Base actions: axe `0.2`, pickaxe `0.3`, hoe `0.15`, watering `0.1`, sword `0.75`, battle axe `0.1`.

Targets: `20h` near-idle, `16..18h` normal, `14..16h` heavy. Proofs: `10h ordinary + 6h walk + 1h run + 40 axe = 99 E`; `7h ordinary + 7h walk + 2h run + 50x0.25 = 102 E`.

Other waking rates: `S -7/hour`, `T -6/hour`, `N -1/hour`, `D -2/hour` without friendly company, plus activity-dependent L below.

```text
pressure(X,q) = clamp((q - X) / q, 0, 1)
hunger = pressure(S,30)
urgency = T<=25 ? 1.25 : 1
hourly E spend = 5 + activity surcharge * (1 + 0.5 * hunger)
physical cost = base * (1 + 0.5 * hunger) * urgency * repetition
E recovery multiplier = 1 - 0.4 * hunger
```

Activity surcharge is ordinary `0`, walking `0.5`, running `3`. Below `S=30`, hunger scales linearly: `S=15` gives load/actions `1.25x`, recovery `0.8x`; `S=0` gives `1.5x/0.6x` and hourly totals `5/5.75/9.5`.

No normal awake regeneration exists. Catch-breath at `E<15`, after three real seconds inactive with `S>0`, restores `1 E/s` up to `15`. Sleep restores `14 E/game hour * recovery multiplier`. At `E=0`, collapse lasts at least two game hours and until `E=25`; other needs continue.

```text
E>=30: speed 1
10<=E<30: 0.80 + 0.20*(E-10)/20
0<E<10: 0.60 + 0.20*E/10
E=0: collapse
```

Running is unavailable below `20 E`.

## Toilet, lustre and movement

- `T>25`: no modifier; at `0<=T<=25`, walk is `1x`, run speed `1.15x`, run E surcharge `1.25x`.
- T never slows movement or blocks running.
- Long actions cannot start below `20 T`.
- `T=0` for `10` game minutes starts one unskippable accident: three `750 ms` shakes, puddle/scent hooks and `-20 N`/witnessed `-15 D`. In the final `2 s`, `T` rises `0->70`, L falls `45`, then control returns.

| Activity | Total L loss/hour |
|---|---:|
| idle, walking, conversation, cooking | 1 |
| running | 2 |
| watering | 1.5 |
| axe/logging | 3 |
| hoe/soil | 3 |
| pickaxe/mining | 4 |

Resource work has priority over running and never stacks with it. Tool hits have no discrete L cost; events may use the discrete-L domain hook.
HUD arrows use actual N/E/S/T/L/D deltas through `660 ms`; presentation owns normalization and pulse timing.

```text
lustre speed = 1 - 0.50 * pressure(L,33)
novelty drain multiplier = 1 + 0.5 * pressure(L,33)
```

Below `L=33`, pressure is linear; at zero, speed is `0.5x` and N drain `1.5x`. E/L compose with a `0.5..1` clamp; T affects only running.

## Novelty and dialogue

After three identical physical actions, repeats cost `1 N` and set `repetition = 1 + 0.3 * pressure(N,30)`; activity change resets. Bucket self-use repeats under its own key, three free then `-1 N`; any other non-ordinary activity resets. Accepted melee spends E on misses and is blocked when unaffordable. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`; no Atoll runtime.

NPC proximity pauses D loss; conversation restores `15..30 D`; shared rest may restore D/E. Solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`; D pressure raises novelty drain up to `1.25`.

## Long interaction timeline

Long uses follow `approach -> enter -> active -> exit -> free`. Walls block route and final reach; a 1x1 object has eight perimeter points. The nearest route drains ordinary. Enter/exit preserve motor and affect pose; effects run only in active.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

The target need is protected enter through exit; recovery is active-only. Normal cancellation starts exit; transitions ignore it. Urgent leaves `60%`; emergency uses profile time. Timelines are transient; load resumes `free`.

## Invariants

- formulas stay deterministic, framework-free and JSON-safe;
- time drain and discrete costs are additive;
- event consequences have visible world causes and reusable outputs;
- camera/presentation never rewrites safe motor position;
- `WorldLocationRuntime` mounts/unmounts location facility/needs owners and delegates realtime;
- gameplay save excludes debug presets and interaction timeline state.

## Current baseline

`src/needs/needsDomain.js` owns formulas; `src/needs/needsRuntime.js` coordinates; `src/needs/needsFlowRuntime.js` measures HUD deltas. Timelines own phases/protection; approach owns reachable points. `WorldLocationRuntime` owns facility/needs lifecycle and realtime update; `src/main.js` composes.

## Evidence

`check:needs`, `check:task-061`, `check:task-065`, `check:interaction`; focused browser E2E.
