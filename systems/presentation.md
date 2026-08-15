# Presentation, HUD, localization and audio

## Purpose

Owns screen-space feedback and sensory presentation; gameplay rules remain with their systems.

## Owners

- HUD/options: `src/ui/gameHud.js`; pulse timing: `src/ui/presentationTuning.js`;
- peaceful inventory: `src/inventory/inventoryRuntime.js`;
- combat slots and activation: `src/combat/combatLoadoutRuntime.js`;
- numbered self-use rules: `src/inventory/combatQuickUse.js`;
- cross-panel drag/click routing: `src/inventory/loadoutDragCoordinator.js`;
- panel modes and Alt lifecycle: `src/inventory/inventoryModeRuntime.js`;
- item visuals/gain cues: `src/inventory/inventoryVisuals.js`, `src/inventory/inventoryGainPresentation.js`;
- transient and interaction UI: `src/ui/transientMessageRuntime.js`, `src/ui/interactionHud.js`;
- transient world puddles: `src/world/puddleRuntime.js`, `src/world/puddleDomain.js`;
- text/localization: `localization/`, `src/ui/textResolution.js`, `src/ui/hud.js`, `public/locales/{ru,en}`;
- camera/audio/day-night: `src/character/cameraFollowRuntime.js`, `src/ui/presentationCameraRuntime.js`, `src/audio/`, `src/session/gameClock.js`.

## Invariants

- logical viewport is `640×360`; the world camera uses `2×` zoom to retain the former world scale, while screen-space UI renders through a separate `1×` camera;
- display zoom uses integer enlargement when the viewport permits it and fractional fit on screens narrower than `640×360`;
- visible strings exist in RU/EN and fit native/mobile layouts;
- compact pixel-HUD copy uses the supported ASCII hyphen `-`, never typographic dash glyphs that render as `?`;
- a missing localization entry fails closed: its technical key is never shown to the player;
- arena/path labels have explicit text-length budgets and may reduce font size before clipping;
- inventory/combat labels and quantities use project bitmap glyphs on whole pixels and remain scale `1` during panel transforms;
- ten peaceful hit zones are at least `22×22` and exclude joystick input;
- short physical Alt toggles stable `PEACEFUL`/`COMBAT`; held Alt exposes transient `LOADOUT_EDIT`;
- interaction stays blocked through Alt transition, held Alt and stable `COMBAT`;
- held Alt enables atomic drag-swap; release cancels unfinished drag;
- stable `COMBAT` keeps four action slots weapon-driven and maps number slots `1–6` to self-use;
- quick use is disabled during Alt, transition, suppression and editable-field input; drag never also applies an item;
- failed quick use does not consume an item, water or need value;
- panel transforms include frames, items, quantities, selection, water gauge, hit zones and gain cues; world drops and throw aim stay world-space;
- the bucket always shows its vertical fill gauge; load, migration and reorder emit no gain cue;
- procedural effects fire only after the owning mutation succeeds;
- puddles are location-scoped transient MULTIPLY sprites fixed to one `16×16` cell, dry at `1/30` day / `1/60` night real seconds, reset alpha on re-spawn and die with location teardown without save;
- long-use presentation never rewrites safe motor position and is never persisted;
- day/night multiply does not cover HUD or change gameplay state;
- player-visible changes require managed preview acceptance;
- need-flow arrows use stable row-seeded phases: visible/transparent `1500/3000`, `2250/1750`, `3000/500 ms`; fade-in/out are `180 ms`, peak alpha `0.9`.

## Current baseline

Localized HUD, peaceful/combat/loadout-edit panels, persistent ten-slot combat loadout, two-way drag, six numbered self-use slots, ten-slot inventory, gain feedback, transient messages, compact Atoll titles/path tips, needs, options, fullscreen, audio, mobile input, camera and day/night presentation are integrated. Current self-use profiles are cooked potato dish for satiety and bucket water for lustre; puddles from bucket self-use and toilet accidents share one runtime owner.

## Not yet

Final art direction, accessibility, complete controller navigation, stack splitting, additional expedition consumables, final sound design and target-device performance polish.

## Evidence

`check:inventory`, `check:hud`, `check:task-053`, `check:task-068`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:visual`, relevant Browser E2E.
