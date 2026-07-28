# Presentation, HUD, localization and audio

## Purpose

This system owns screen-space feedback and sensory presentation without becoming the owner of gameplay rules.

## Owners

- HUD/options: `gameHud.js`;
- inventory hotbar, drag input, selected-item marker and dropped-item presentation: `inventoryRuntime.js`;
- inventory procedural item visuals: `inventoryVisuals.js`;
- interaction/dialogue UI: `interactionHud.js`;
- text/localization: `localization/`, `textResolution.js`, `hud.js`, `public/locales/{ru,en}`;
- mobile control visuals: `mobileJoystick.js`;
- camera: `cameraFollowRuntime.js`;
- audio/settings: `audioRuntime.js`, `audioSettings.js`;
- day/night color: `gameClock.js` plus scene overlay wiring.

## Invariants

- logical viewport is `320×180`;
- visible strings exist in RU/EN and fit native/mobile layouts;
- inventory labels and quantities use project bitmap glyphs on whole logical pixels;
- the ten inventory hit zones are at least `22×22` logical pixels and exclude joystick input;
- selected loot remains visible above the player; selected tools show for one second and fade over the next second;
- HUD reads domain state but does not calculate gameplay rates;
- options/debug preferences remain separate from gameplay save where appropriate;
- audio respects master/music/effects ownership;
- day/night presentation does not cover HUD or alter gameplay state;
- player-visible changes require managed preview acceptance.

## Current baseline

Localized HUD, ten-slot inventory, selected-item marker, dropped-item presentation, needs arrows/tooltips, options, fullscreen, audio playlist, mobile joystick, presentation camera and day/night multiply are integrated.

## Not yet

Final art direction, accessibility pass, complete controller navigation, stack splitting, finished sound design and target-device performance polish.

## Evidence

`check:inventory`, `check:hud`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:visual`, relevant Browser E2E.
