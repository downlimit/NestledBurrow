# Character, input, time and needs

## Purpose

This system owns player movement, time, sleep, energy and the six continuous needs. It also owns the first implementation target for how those needs influence one another without turning play into maintenance of six green bars.

## Player-visible contract

- keyboard and mobile produce the same movement/run intent;
- motor position is authoritative and presentation poses do not corrupt it;
- camera follows an explicit presentation target;
- world time is continuous; sleep accelerates simulation;
- a sleeping character is explicitly layered above the selected bed visual;
- all needs use `0..100`, where a higher value is better, and appear in the fixed order `N/E/S/T/L/D`;
- changes happen for understandable actions and receive visible HUD feedback.

## Need meanings

| Symbol | ID | Meaning |
|---|---|---|
| `N` | novelty | engagement and relief from repetition |
| `E` | energy | physical ability to move, work and stay awake |
| `S` | satiety | nutrition available to support effort and recovery |
| `T` | toilet | physiological freedom; `100` is relieved, `0` is an accident |
| `L` | lustre | cleanliness, comfort and feeling presentable |
| `D` | dialogue | social fulfilment and need for meaningful contact |

High values are primarily safety buffers and normal functioning, not a stack of passive bonuses. Cross-need effects concentrate below pressure thresholds or inside explicit actions. This prevents an “all green bars” engine from multiplying every reward.

## Time base and first implementation rates

Balance is expressed in points per game hour so it survives changes to real-time pacing. At the current `24` real minutes per game day, one game hour is `60` real seconds.

| Need/activity | First target |
|---|---:|
| `E` stationary awake | `−3 / game hour` |
| `E` walking | `−5 / game hour` |
| `E` running | `−12 / game hour` |
| axe hit / pickaxe hit / hoe use / watering | `−0.75 / −1 / −0.5 / −0.25 E` |
| `S` baseline awake | `−7 / game hour` |
| `T` baseline awake | `−6 / game hour` |
| `L` baseline awake | `−1 / game hour` |
| `N` baseline awake | `−1 / game hour` |
| `D` while awake without friendly company | `−2 / game hour` |

Running and heavy work may add action-specific satiety/lustre pressure, but should not silently multiply every drain. Resource profiles may override tool costs when the visible material justifies it.

## Shared pressure curve

For a need `X`, pressure below threshold `q` is:

```text
pressure(X, q) = clamp((q − X) / q, 0, 1)
```

Thresholds are used for communication and event availability; continuous formulas avoid abrupt stat cliffs.

## Energy and satiety

Satiety modifies energy expenditure and recovery only when hungry:

```text
hunger = pressure(S, 30)
energy spend multiplier = 1 + 0.5 × hunger
energy recovery multiplier = 1 − 0.4 × hunger
```

At `S=30+`, energy behaves normally. At `S=0`, effort costs `1.5×` and sleep/rest restores at `0.6×`. Food primarily restores `S`; special cooked items may deliberately convert food into immediate `E`.

There is no normal awake auto-regeneration. Explicit rest and sleep are the intended recovery loops. To prevent a soft lock, when `E<15`, the character has been stationary and inactive for `3` real seconds, and `S>0`, “catch breath” restores `1 E/real second` only up to `15`.

Normal sleep restores `14 E/game hour`, multiplied by the satiety recovery multiplier. At `E=0` the character collapses; accelerated time continues until at least two game hours pass and `E` reaches `25`. Other needs continue changing during collapse. Wake-up is deterministic rather than a random repeated attempt.

Energy affects movement smoothly:

```text
E ≥ 30: speed = 1.00
10 ≤ E < 30: speed = 0.80 + 0.20 × (E − 10) / 20
0 < E < 10: speed = 0.60 + 0.20 × E / 10
E = 0: collapse
```

Running is unavailable below `20 E`. Low energy does not change tool yield; it changes remaining options through cost, movement and collapse risk.

## Toilet

- `T≥25`: no movement effect.
- `10≤T<25`: hurried walk `1.05×`, but running costs `1.25×` energy and long actions cannot begin below `20 T`.
- `0<T<10`: speed falls linearly from `1.05×` to `0.85×`; running is unavailable.
- `T=0`: accident sets `T` to `70`, applies `−45 L` and `−20 N`; if witnessed, also `−15 D`. The location receives a scent consequence that encounters may use.

A toilet facility resolves `T` without a lustre penalty. Improvised relief restores `T` but costs lustre and may alter local animal behaviour. Drinks and juicy meals may apply discrete toilet costs instead of hidden permanent multipliers.

## Lustre

```text
lustre pressure = pressure(L, 25)
speed multiplier = 1 − 0.12 × lustre pressure
novelty drain multiplier = 1 + 0.5 × lustre pressure
```

Low lustre represents discomfort, not moral failure. It slightly slows movement and makes repetitive time feel worse. Mining, mud, smoke, improvised toilet use and weather can alter `L`; washing may remove useful camouflage or scent, so restoring lustre can itself be a decision.

The final combined movement multiplier from energy, toilet and lustre is clamped to at least `0.55` while conscious, preventing an unplayable crawl.

## Novelty

Novelty primarily changes repetition rather than all global rates.

```text
novelty pressure = pressure(N, 30)
after the third consecutive same labour action:
energy action cost multiplier = 1 + 0.3 × novelty pressure
```

Each further repeated labour action also costs `1 N`. Entering a new arena, changing activity or responding to an event resets the repetition chain. Initial rewards: new arena `+6 N`, meaningful discovery/event `+8..15 N`, deliberate leisure `+10..25 N`.

At low novelty the player can still complete the task; the system makes repetition increasingly unattractive and creates reasons to investigate or switch plans rather than taking control away.

## Dialogue

```text
dialogue pressure = pressure(D, 30)
solo-rest energy recovery multiplier = 1 − 0.25 × dialogue pressure
novelty drain multiplier *= 1 + 0.25 × dialogue pressure
```

Friendly proximity pauses passive `D` loss. A meaningful conversation normally restores `15..30 D`; shared rest may restore both `D` and `E`. Low dialogue does not reduce damage or movement. It increases the value of social opportunities, which may carry an obligation such as escorting a traveller, accepting a request or changing route.

## High-state policy

- `S>30` permits normal energy spend/recovery; extra satiety is buffer, not a damage buff.
- high `N`, `L` and `D` prevent their pressure effects and may satisfy contextual checks, but do not passively accelerate every other meter.
- beneficial cross-need conversion belongs to visible actions: shared camp (`E+D`), meal (`S`, sometimes `E`, possibly `T` cost), washing (`L`, possibly `E` or camouflage cost), exploration (`N` at `E/S` cost).

## Owners

- movement/controller: `characterMotor.js`, `characterSystem.js`, `controllers.js`, `input.js`;
- mobile: `mobileJoystick.js`;
- camera: `cameraFollowRuntime.js`;
- time and energy state: `gameClock.js`, `gameSessionState.js`;
- need rates and cross-effects: `needsDomain.js` and future need-effect coordinator/runtime;
- presentation/HUD details: `systems/presentation.md`.

## Invariants

- domain values remain framework-free and JSON-safe;
- camera/presentation never rewrites safe motor position;
- interaction/cooking/sleep suppression is explicit;
- tuning/debug storage is separate from gameplay save;
- consequences belong to domain/runtime owners, not HUD;
- event-specific consequences require a visible world cause;
- high needs do not form a broad passive bonus stack.

## Current baseline

Eight-direction movement, running energy, sleep/wake, continuous day/night and all six needs are integrated. Current numeric tuning predates this contract and must be replaced by a dedicated implementation task rather than treated as proof of the target balance above.

## Not yet fixed

- exact food catalogue and portable need conversions;
- final animation/audio feedback for pressure and accidents;
- combat-specific energy costs;
- long-term upgrades that change rates or thresholds;
- final playtest tuning after the first implementation.

## Evidence

`check:input`, `check:mobile-camera`, `check:movement`, `check:character`, `check:needs`, `check:clock-cycle`; browser E2E for integrated input/sleep paths.
