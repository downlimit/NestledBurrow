# Presentation, HUD, localization and audio

## Purpose

This system owns screen-space feedback and sensory presentation without becoming the owner of gameplay rules.

## Owners

- HUD/options: `gameHud.js`;
- inventory hotbar, drag input, selected-item marker and dropped-item presentation: `inventoryRuntime.js`;
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
- inventory labels and quantities use project bitmap glyphs on whole logical pixels; stackable items keep their count visible at one;
- ten inventory hit zones are at least `22×22` logical pixels and exclude joystick input;
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

Localized HUD, ten-slot inventory, 700 ms aggregated gain feedback, transient interaction messages, dropped-item presentation, needs, options, fullscreen, audio, mobile joystick, presentation camera and day/night multiply are integrated.

## Not yet

Final art direction, accessibility pass, complete controller navigation, stack splitting, finished sound design and target-device performance polish.

## Evidence

`check:inventory`, `check:hud`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:task-048`, `check:task-049`, `check:visual`, relevant Browser E2E.
