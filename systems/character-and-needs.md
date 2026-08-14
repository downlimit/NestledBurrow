# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and the canonical `0..100` need set. HUD order for the player: N novelty, E energy, S satiety, T toilet, L lustre, D dialogue. Higher values remove pressure; no passive bonus stack.

The same need dimensions and meanings apply to persistent people in the population. The player keeps the full live runtime; offscreen people use bounded coarse reconstruction and future visible NPC behavior may use person-specific rates without inventing a separate need vocabulary.

## Shared person need contract

- A persistent person uses the same canonical need dimensions as the player: novelty, energy, satiety, toilet, lustre and dialogue/social contact.
- Each Stage-3 person also keeps a stable `spendingCapacity` and layered `foodPreferences` (`cuisine`, `dishClass`, `ingredient`). These are deterministic from the stable person ID, JSON-safe and normalized by the population owner; venue history remains outside the person profile.
- Offscreen people are not simulated frame by frame. Their last stored need state and evaluation time are persisted, then reconstructed when the person becomes relevant again: visit consideration, scene appearance, phone contact, invitation or another explicit interaction.
- Reconstruction uses elapsed world time plus bounded variation and may later use individual traits, age or lifestyle. It must preserve the same `0..100` meanings as live needs.
- While physically present, a person's needs are live and may drive behavior. Different people can therefore arrive with several simultaneous pressures rather than a single scripted reason.
- Sharing the need vocabulary does not require every NPC to use the player's exact drain rates, motor penalties or accident presentation. Those remain role-specific behavior layered on the same state semantics.

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

Resource work overrides running. Tool hits have no discrete L cost. HUD arrows show actual deltas for `660 ms`. Desktop bar clicks set transient debug values; reload restores saved state.

```text
lustre speed = 1 - 0.50 * pressure(L,33)
novelty drain multiplier = 1 + 0.5 * pressure(L,33)
```

At `L=0`, speed is `0.5x` and N drain `1.5x`. E/L compose with a `0.5..1` clamp; T affects only running.

## Novelty and dialogue

After three identical physical actions, repeats cost `1 N` and use `repetition = 1 + 0.3 * pressure(N,30)`; activity change resets. Bucket self-use has its own key: three free uses, then `-1 N`; another non-ordinary activity resets it. Accepted melee spends E on misses and is blocked when unaffordable. Gains: arena `+6`, discovery/event `+8..15`, leisure `+10..25`; no Atoll runtime.

NPC proximity pauses D loss; conversation restores `15..30 D`; shared rest may restore D/E. Solo-rest E multiplier is `1 - 0.25 * pressure(D,30)`; D pressure raises novelty drain up to `1.25`.

## Long interaction timeline

Long uses `approach -> enter -> active -> exit -> free`. Prompt scans rank gaze within radius/perimeter/wall checks without gating; A* runs only after activation. Walls block routes. Profiles filter perimeter points by eight directions. A one-cell object exposes eight candidate cells; wider objects expose corners and edge cells. Disabled classes are removed before probe and exact routing; at least one remains enabled. Crossing a point counts as arrival. Enter/exit interpolate presentation without moving the motor. Effects run only in active.

| Profile | Protected | Enter | Exit | Emergency |
|---|---|---:|---:|---:|
| shower | L | 700 ms | 900 ms | 400 ms |
| toilet | T | 500 ms | 600 ms | 300 ms |
| table/eating | S | 500 ms | 650 ms | 300 ms |
| bed/sleep | E | 1000 ms | 1200 ms | 500 ms |

The target need is protected through exit; recovery is active-only. Normal cancellation starts exit; transitions ignore it. Urgent exit leaves `60%`; emergency uses profile time. Timelines are transient; load resumes `free`.

## Invariants

- formulas stay deterministic, framework-free and JSON-safe;
- time drain and discrete costs are additive;
- presentation never rewrites safe motor position;
- approach masks change automatic positioning, not timeline pose or effects;
- `WorldLocationRuntime` owns location facility/needs lifecycle;
- saves exclude debug presets and interaction timeline state.

## Current baseline

`src/needs/needsDomain.js` owns canonical need IDs and player formulas; `src/needs/needsRuntime.js` coordinates; `src/needs/needsFlowRuntime.js` measures HUD deltas. `src/character/populationDomain.js` owns the 16-person baseline, stable demand profiles, population normalization and deterministic coarse offscreen reconstruction for all six needs. Timeline modules own phases and protection; approach owns reachable perimeter points and profile direction filtering. `src/main.js` composes.

## Evidence

`check:needs`, `check:task-061`, `check:task-065`, `check:task-067`, `check:task-070`, `check:task-071`, `check:task-086`, `check:task-088`, `check:interaction`; focused browser E2E.
