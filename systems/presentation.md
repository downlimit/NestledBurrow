# Presentation, HUD, localization and audio

## Purpose

This system owns screen-space feedback and sensory presentation without becoming the owner of gameplay rules.

## Owners

- HUD/options: `gameHud.js`;
- inventory hotbar, drag input, selected-item marker and dropped-item presentation: `inventoryRuntime.js`;
- combat loadout frames, item presentation and screen-space labels: `combatLoadoutRuntime.js`;
- two-panel loadout dragging: `loadoutDragCoordinator.js`;
- peaceful/combat/loadout-edit HUD state, physical Alt input and panel transitions: `inventoryModeRuntime.js`;
- inventory item visuals: `inventoryVisuals.js`;
- inventory gain feedback: `inventoryGainPresentation.js`;
- transient gameplay messages: `transientMessageRuntime.js`;
- interaction/dialogue UI: `interactionHud.js`;
- text/localization: `localization/`, `textResolution.js`, `hud.js`, `public/locales/{ru,en}`;
- mobile controls: `mobileJoystick.js`;
- camera: `cameraFollowRuntime.js`;
- audio/settings: `audioRuntime.js`, `audioSettings.js`;
- day/night color: `gameClock.js` plus scene overlay wiring.

## Invariants

- logical viewport is `320×180`;
- visible strings exist in RU/EN and fit native/mobile layouts;
- inventory and combat labels/quantities use project bitmap glyphs on whole logical pixels, retain screen scale `1` while panels transform, and stackable items keep their count visible at one;
- ten inventory hit zones are at least `22×22` logical pixels and exclude joystick input;
- the lower inventory HUD starts in `PEACEFUL`; a short physical Alt toggles `PEACEFUL`/`COMBAT`, while held Alt exposes `LOADOUT_EDIT` only until release;
- interaction input and its HUD prompt are disabled from physical Alt keydown through the transition, throughout `LOADOUT_EDIT`, and for the whole stable `COMBAT` mode;
- held Alt enables atomic drag/swap between peaceful inventory and the persistent ten-slot combat loadout; releasing Alt cancels unfinished drag without latching `LOADOUT_EDIT`;
- stable `COMBAT` keeps combat actions inactive; its slots become drag targets only while Alt is held;
- the Q/E ear follows panel transitions through an opacity tween and never appears or disappears in one frame;
- inventory panel transforms include its frames, items, quantities, selection, water gauge, input zones and gain feedback; dropped items, held items and throw aim remain world-space;
- modal HUD suppression, blur, scene pause/sleep and destroy clear held Alt and restore the current stable mode;
- selected loot remains visible above the player; selected tools show for one second and fade over the next second;
- successful inventory gains show a 700 ms item/quantity cue at the affected slot;
- inventory and wallet drags show a sharp `8×8` pixel-rasterized throw aim orbiting the lower-torso throw pivot along the shared cursor direction; the player renders above it;
- the water bucket always shows a vertical fill gauge inside its inventory slot;
- load, migration and reordering never emit gain feedback;
- transient interaction failures reuse one HUD message owner and do not change the action button label;
- HUD reads domain state and procedural effects fire only after the owning mutation succeeds;
- day/night presentation does not cover HUD or alter gameplay state;
- player-visible changes require managed preview acceptance.

## Current baseline

Localized HUD, peaceful/combat/loadout-edit lower panels, persistent ten-slot combat loadout with two-way drag, ten-slot inventory, 700 ms aggregated gain feedback, transient interaction messages, dropped-item presentation, needs, options, fullscreen, audio, mobile joystick, presentation camera and day/night multiply are integrated.

## Not yet

Final art direction, accessibility pass, complete controller navigation, stack splitting, finished sound design and target-device performance polish.

## Evidence

`check:inventory`, `check:hud`, `check:task-053`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:task-048`, `check:task-049`, `check:visual`, relevant Browser E2E.
