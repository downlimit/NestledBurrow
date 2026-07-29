# Character, input, time and needs

## Purpose

This system owns how the player moves, presents, spends time and receives continuous needs feedback.

## Player-visible contract

- keyboard and mobile produce the same movement/run intent;
- motor position is authoritative and presentation poses do not corrupt it;
- camera follows an explicit presentation target;
- world time is continuous; sleep accelerates simulation;
- a sleeping character is explicitly layered above the selected bed visual;
- energy and `N/E/S/T/L/D` change for understandable reasons and are visible in HUD.

## Owners

- movement/controller: `characterMotor.js`, `characterSystem.js`, `controllers.js`, `input.js`;
- mobile: `mobileJoystick.js`;
- camera: `cameraFollowRuntime.js`;
- time: `gameClock.js`, time fields in `gameSessionState.js`;
- needs: `needsDomain.js`;
- sleep furniture presentation: `debrisRuntime.js`;
- presentation/HUD details: `systems/presentation.md`.

## Invariants

- domain values remain framework-free and JSON-safe;
- camera/presentation never rewrites safe motor position;
- interaction/cooking/sleep suppression is explicit;
- bed collider and authoring offsets do not decide the sleeping occupant layer;
- tuning/debug storage is separate from gameplay save;
- new need consequences belong to domain/runtime owners, not HUD.

## Current baseline

Eight-direction movement, mobile sprint ring, running energy, sleep/wake, continuous day/night and six persistent needs are integrated. Facilities, NPC contact, movement and resource actions affect needs.

## Not yet

Final balance, zero-value consequences, consumables and long-term progression are unconfirmed.

## Evidence

`check:input`, `check:mobile-camera`, `check:movement`, `check:character`, `check:needs`, `check:clock-cycle`, `check:task-048`; browser E2E for integrated input/sleep paths.
