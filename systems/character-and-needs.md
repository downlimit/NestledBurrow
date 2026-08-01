# Character, input, time and needs

## Purpose

Owns movement, time, sleep, energy and the six continuous needs. This document is the first implementation target, not immutable final tuning.

## Player contract

All needs use `0..100` (higher is better) and fixed HUD order `N/E/S/T/L/D`:

| Symbol | ID | Meaning |
|---|---|---|
| N | novelty | engagement; relief from repetition |
| E | energy | physical capacity and wakefulness |
| S | satiety | nutrition supporting effort/recovery |
| T | toilet | physiological freedom; `0` causes an accident |
| L | lustre | cleanliness, comfort, presentability |
| D | dialogue | meaningful social fulfilment |

High values are mainly safety buffers and normal function, not a stack of passive bonuses. Cross-effects concentrate below pressure thresholds or inside visible actions.

## First rates

Rates are points per game hour. Current pacing is `24` real minutes/day, so one game hour is `60` real seconds.

| Flow | Target |
|---|---:|
| E stationary / walking / running | `−3 / −5 / −12` |
| axe / pickaxe / hoe / watering | `−0.75 / −1 / −0.5 / −0.25 E` per use |
| S baseline awake | `−7` |
| T baseline awake | `−6` |
| L / N baseline awake | `−1 / −1` |
| D awake without friendly company | `−2` |

Shared pressure below threshold `q`:

```text
pressure(X,q) = clamp((q − X) / q, 0, 1)
```

## Energy and satiety

```text
hunger = pressure(S,30)
energy spend multiplier = 1 + 0.5 × hunger
energy recovery multiplier = 1 − 0.4 × hunger
```

At `S=0`, effort costs `1.5×` and recovery is `0.6×`. Food mainly restores S; explicit cooked items may convert S into immediate E.

No normal awake auto-regeneration. Anti-softlock only: at `E<15`, after `3` real seconds stationary/inactive and with `S>0`, catch-breath restores `1 E/real second` up to `15`.

Sleep restores `14 E/game hour × recovery multiplier`. At `E=0`, collapse accelerates time until at least two game hours pass and E reaches `25`; other needs continue changing. Wake-up is deterministic.

```text
E≥30: speed 1.00
10≤E<30: 0.80 + 0.20×(E−10)/20
0<E<10: 0.60 + 0.20×E/10
E=0: collapse
```

Running is unavailable below `20 E`. Low E changes remaining options, not tool yield.

## Toilet and lustre

- `T≥25`: no movement effect.
- `10≤T<25`: hurried walk `1.05×`; running costs `1.25× E`; long actions cannot start below `20 T`.
- `0<T<10`: speed falls linearly `1.05→0.85`; running is unavailable.
- `T=0`: accident sets `T=70`, applies `−45 L`, `−20 N`, and `−15 D` if witnessed; the location receives a scent consequence.

Facilities resolve T without a lustre penalty. Improvised relief restores T but costs L and may alter animal behaviour. Drinks/juicy meals use explicit T costs.

```text
lustre pressure = pressure(L,25)
speed multiplier = 1 − 0.12 × pressure
novelty drain multiplier = 1 + 0.5 × pressure
```

Low L is discomfort, not moral failure. Washing may remove useful camouflage or scent. Combined conscious movement multiplier from E/T/L is clamped to at least `0.55`.

## Novelty and dialogue

After the third consecutive same labour action:

```text
energy action cost multiplier = 1 + 0.3 × pressure(N,30)
```

Each further repeat also costs `1 N`. Entering a new arena, changing activity or responding to an event resets repetition. Initial gains: new arena `+6 N`, discovery/event `+8..15`, deliberate leisure `+10..25`. Low N discourages repetition without taking control away.

```text
solo-rest E recovery multiplier = 1 − 0.25 × pressure(D,30)
novelty drain multiplier *= 1 + 0.25 × pressure(D,30)
```

Friendly proximity pauses D loss. Meaningful conversation restores `15..30 D`; shared rest may restore D+E. Low D creates valuable social opportunities with obligations (escort, request, route change), not damage or movement penalties.

## High-state policy

`S>30` permits normal E spend/recovery. High N/L/D remove pressure and may satisfy contextual checks, but do not globally accelerate other meters. Beneficial conversion belongs to visible actions: shared camp (E+D), meal (S/E with possible T cost), washing (L with energy/camouflage cost), exploration (N at E/S cost).

## Invariants

- values remain framework-free, JSON-safe and `0..100`;
- consequences belong to domain/runtime owners, not HUD;
- every event-specific effect has a visible world cause;
- high needs never form a broad passive bonus stack;
- camera/presentation never rewrites safe motor position.

## Current baseline

Movement, running energy, sleep/wake, continuous time and all six needs exist. Current numeric tuning predates this contract and is not proof of the target balance.

## Evidence

`check:input`, `check:mobile-camera`, `check:movement`, `check:character`, `check:needs`, `check:clock-cycle`; browser E2E for integrated movement/sleep paths.

## Not fixed

Food catalogue, combat costs, long-term rate upgrades, final feedback and post-playtest tuning.
