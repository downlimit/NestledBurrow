# Presentation, HUD, localization and audio

## Purpose

Owns screen-space feedback and sensory presentation; gameplay rules remain with their systems.

## Owners

- HUD/options: `src/ui/gameHud.js`; immutable semantic pulse timings: `src/ui/presentationTuning.js`;
- inventory hotbar/drag/selection/world items: `src/inventory/inventoryRuntime.js`;
- combat loadout frames/items/labels: `src/combat/combatLoadoutRuntime.js`;
- two-panel loadout dragging: `src/inventory/loadoutDragCoordinator.js`;
- HUD modes, physical Alt and panel transitions: `src/inventory/inventoryModeRuntime.js`;
- inventory item visuals: `src/inventory/inventoryVisuals.js`;
- inventory gain feedback: `src/inventory/inventoryGainPresentation.js`;
- transient gameplay messages: `src/ui/transientMessageRuntime.js`;
- interaction/dialogue UI: `src/ui/interactionHud.js`;
- text/localization: `localization/`, `src/ui/textResolution.js`, `src/ui/hud.js`, `public/locales/{ru,en}`;
- mobile controls: `src/controls/mobileJoystick.js`;
- camera: `src/character/cameraFollowRuntime.js`;
- audio/settings: `src/audio/audioRuntime.js`, `src/audio/audioSettings.js`;
- day/night color: `src/session/gameClock.js` plus scene overlay wiring.
- reachable use points: `src/interaction/interactionApproach.js`; long-use interpolation: `src/needs/interactionTimelineRuntime.js` with `src/needs/needsInteractionCoordinator.js`;

## Invariants

- logical viewport is `320×180`;
- visible strings exist in RU/EN and fit native/mobile layouts;
- inventory/combat labels and quantities use project bitmap glyphs on whole pixels, retain scale `1` during panel transforms, and show stack count at one;
- ten inventory hit zones are at least `22×22` logical pixels and exclude joystick input;
- the lower inventory HUD starts in `PEACEFUL`; a short physical Alt toggles `PEACEFUL`/`COMBAT`, while held Alt exposes `LOADOUT_EDIT` only until release;
- interaction input/prompt stay disabled from Alt keydown through transition, `LOADOUT_EDIT`, and stable `COMBAT`;
- held Alt enables atomic inventory/loadout drag-swap; release cancels unfinished drag without latching `LOADOUT_EDIT`;
- stable `COMBAT` keeps combat actions inactive; its slots become drag targets only while Alt is held;
- the Q/E ear follows panel transitions through an opacity tween and never appears or disappears in one frame;
- inventory transforms include frames, items, quantities, selection, water gauge, input zones and gain feedback; drops, held items and throw aim stay world-space;
- modal HUD suppression, blur, scene pause/sleep and destroy clear held Alt and restore the current stable mode;
- selected loot remains visible above the player; selected tools show for one second and fade over the next second;
- successful inventory gains show a 700 ms item/quantity cue at the affected slot;
- inventory/wallet drags show a sharp `8×8` throw aim at the lower-torso pivot along the shared cursor direction; player renders above it;
- the water bucket always shows a vertical fill gauge inside its inventory slot;
- load, migration and reordering never emit gain feedback;
- transient interaction failures reuse one HUD message owner and do not change the action button label;
- HUD reads domain state and procedural effects fire only after the owning mutation succeeds;
- day/night presentation does not cover HUD or alter gameplay state;
- player-visible changes require managed preview acceptance.
- long-use tweens move only the visible pose; motor stays safe and transient phases are never persisted.
- need-flow arrows use stable row-seeded phase offsets with no interval randomization or drift. One arrow is visible for exactly `1500 ms` and transparent for `3000 ms`; three arrows are visible for `3000 ms` and transparent for `500 ms`. The two-arrow profile is the exact linear midpoint: `2250 ms` visible and `1750 ms` transparent. Fade-in and fade-out are constant `180 ms` phases in every tier; only peak hold changes. Peak alpha is `0.9`, zero arrows remain fully transparent, and slow/medium/strong cycles are `4500/4000/3500 ms`.

## Current baseline

Localized HUD, peaceful/combat/loadout-edit lower panels, persistent ten-slot combat loadout with two-way drag, ten-slot inventory, 700 ms aggregated gain feedback, transient interaction messages, dropped-item presentation, needs, options, fullscreen, audio, mobile joystick, presentation camera and day/night multiply are integrated.

## Not yet

Final art direction, accessibility pass, complete controller navigation, stack splitting, finished sound design and target-device performance polish.

## Evidence

`check:inventory`, `check:hud`, `check:task-053`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:task-048`, `check:task-049`, `check:visual`, relevant Browser E2E.
