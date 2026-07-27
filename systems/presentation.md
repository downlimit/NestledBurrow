# Presentation, HUD, localization and audio

## Purpose

This system owns screen-space feedback and sensory presentation without becoming the owner of gameplay rules.

## Owners

- HUD/options: `gameHud.js`;
- interaction/dialogue UI: `interactionHud.js`;
- text/localization: `localization/`, `textResolution.js`, `public/locales/{ru,en}`;
- mobile control visuals: `mobileJoystick.js`;
- camera: `cameraFollowRuntime.js`;
- audio/settings: `audioRuntime.js`, `audioSettings.js`;
- day/night color: `gameClock.js` plus scene overlay wiring.

## Invariants

- logical viewport is `320×180`;
- visible strings exist in RU/EN and fit native/mobile layouts;
- HUD reads domain state but does not calculate gameplay rates;
- options/debug preferences remain separate from gameplay save where appropriate;
- audio respects master/music/effects ownership;
- day/night presentation does not cover HUD or alter gameplay state;
- player-visible changes require managed preview acceptance.

## Current baseline

Localized HUD, needs arrows/tooltips, options, fullscreen, audio playlist, mobile joystick, presentation camera and day/night multiply are integrated.

## Not yet

Final art direction, accessibility pass, complete controller navigation, finished sound design and target-device performance polish.

## Evidence

`check:hud`, `check:text-resolution`, `check:i18n`, `check:audio`, `check:visual`, relevant Browser E2E.
