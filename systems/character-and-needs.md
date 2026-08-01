# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and six continuous needs.

## Player contract

Keyboard and mobile produce the same movement/run intent. The motor position is authoritative; presentation poses do not corrupt it. A location transition places the motor at its declared safe spawn, clears velocity, applies the exit-facing and resets camera follow before controls resume.

All needs use `0..100` (higher is better) and HUD order `N/E/S/T/L/D`:

| Symbol | ID | Meaning |
|---|---|---|
| N | novelty | engagement and relief from repetition |
| E | energy | physical capacity and wakefulness |
| S | satiety | nutrition supporting effort/recovery |
| T | toilet | physiological freedom; `0` causes an accident |
| L | lustre | cleanliness, comfort, presentability |
| D | dialogue | meaningful social fulfilment |

High values provide normal function and safety, not stacked bonuses.

## Energy day target

Rates are points per game hour; one game hour is `60` real seconds.

| Current activity | Total E rate |
|---|---:|
| ordinary awake activity, waiting, conversation, cooking | `−5/hour` |
| walking | `−5.5/hour` |
| running | `−8/hour` |

Tool work adds a discrete cost while the activity rate continues:

| Use | Extra E |
|---|---:|
| axe / pickaxe | `−0.2 / −0.3` |
| hoe / watering | `−0.15 / −0.1` |

Targets from full E: about `20h` near-idle, `16–18h` normal day, `14–16h` heavy expedition. Scenarios: `10h ordinary + 6h walk + 1h run + 40 axe-like uses = 99 E`; `7h ordinary + 7h walk + 2h run + 50 uses averaging 0.25 E = 102 E`.

Other rates: `S −7/hour`, `T −6/hour`, `L −1/hour`, `N −1/hour`, `D −2/hour` while awake without friendly company.

```text
pressure(X,q) = clamp((q − X) / q, 0, 1)
```

## Energy and satiety

```text
hunger = pressure(S,30)
hourly E spend = 5 + activity surcharge × (1 + 0.5 × hunger)
tool E cost = base tool cost × (1 + 0.5 × hunger)
E recovery multiplier = 1 − 0.4 × hunger
```

Surcharges: `0` ordinary, `0.5` walking, `3` running. Hunger never multiplies the fixed `5 E/hour`; at `S=0`, walking is `5.75/hour`, running `9.5/hour`, tool costs `1.5×`, recovery `0.6×`. Food mainly restores S; meals may also restore E.

No normal awake auto-regeneration. Anti-softlock only: at `E<15`, after `3` real seconds stationary/inactive and with `S>0`, catch-breath restores `1 E/real second` up to `15`.

Sleep restores `14 E/game hour × recovery multiplier`. At `E=0`, collapse accelerates time until at least two game hours pass and E reaches `25`; other needs keep changing. Wake-up is deterministic.

```text
E≥30: speed 1.00
10≤E<30: 0.80 + 0.20×(E−10)/20
0<E<10: 0.60 + 0.20×E/10
E=0: collapse
```

Running is unavailable below `20 E`. Low E changes options, not tool yield.

## Toilet and lustre

- `T≥25`: no movement effect.
- `10≤T<25`: hurried walk `1.05×`; running costs `1.25× E`; long actions cannot start below `20 T`.
- `0<T<10`: speed falls `1.05→0.85`; running is unavailable.
- `T=0`: set `T=70`, apply `−45 L`, `−20 N`, and `−15 D` if witnessed; add a local scent consequence.

Facilities resolve T without losing L. Improvised relief restores T but costs L and may affect animals. Drinks/juicy meals use explicit T costs.

```text
lustre pressure = pressure(L,25)
speed multiplier = 1 − 0.12 × pressure
novelty drain multiplier = 1 + 0.5 × pressure
```

Low L is discomfort, not moral failure. Washing may remove useful camouflage or scent. Combined conscious movement multiplier from E/T/L is clamped to `0.55`.

## Novelty and dialogue

After the third consecutive same labour action:

```text
energy action cost multiplier = 1 + 0.3 × pressure(N,30)
```

Each further repeat also costs `1 N`. New arena, changed activity or event response resets repetition. Gains: new arena `+6 N`, discovery/event `+8..15`, leisure `+10..25`. Low N discourages repetition without taking control away.

```text
solo-rest E recovery multiplier = 1 − 0.25 × pressure(D,30)
novelty drain multiplier *= 1 + 0.25 × pressure(D,30)
```

Friendly proximity pauses D loss. Meaningful conversation restores `15..30 D`; shared rest may restore D+E. Low D makes social opportunities more valuable but does not reduce damage or movement.

## High-state policy

`S>30` permits normal E spend/recovery. High N/L/D remove pressure and may satisfy contextual checks, but do not globally accelerate other meters. Useful conversion belongs to visible actions: camp, meal, washing and exploration.

## Invariants

- values stay framework-free, JSON-safe and `0..100`;
- time-based activity drain and discrete action costs are additive;
- consequences belong to domain/runtime owners, not HUD;
- event-specific effects have visible world causes;
- high needs never form a broad passive bonus stack;
- camera/presentation never rewrites safe motor position.
- a transition is re-armed only after the motor leaves the destination trigger.

## Current baseline

Movement, running energy, sleep/wake, continuous time and all six needs exist. Burrow/Nest travel retains needs, time and energy while resetting the motor and camera to the destination contract. Current tuning predates this target.

## Evidence

`check:input`, `check:mobile-camera`, `check:movement`, `check:character`, `check:needs`, `check:clock-cycle`, `check:task-059`; browser E2E for movement/sleep/location paths.

## Not fixed

Food catalogue, combat costs, long-term rate upgrades, final feedback and post-playtest tuning.
