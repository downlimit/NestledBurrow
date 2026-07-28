# Task #047 — Первый картофельный огородный цикл

## Status

Lead-owned farming binaries were visually accepted and are immutable. Codex may begin only from a confirmed Base SHA that contains the exact files and hashes below.

## Goal

Deliver the complete playable loop:

`buy potato seeds → till one 16×16 soil cell → plant → build a well → fill the watering can → water → grow → harvest 4–6 potatoes`

The same slice removes the obsolete neighbor quest and street NPC, turns the former home NPC into a stationary seed merchant, removes canonical map trees and the obsolete kitchen counters, compacts the interaction prompt, and establishes one pivot-based depth contract for world objects.

## Relevant systems

- `systems/world-and-resources.md`
- `systems/build-and-authoring.md`
- `systems/persistence.md`
- `systems/presentation.md`
- `systems/tavern-service.md`
- `ARCHITECTURE.md`
- `ASSETS.md`

## Required immutable binaries

### New Lead-owned files

1. `public/assets/project/farming/NestledBurrow_Farming.png`
   - RGBA PNG, `192×16`
   - native grid `16×16`
   - 12 horizontal frames:
     0. `potato-seeds`
     1. `potato`
     2. `soil-dry`
     3. `soil-wet-100`
     4. `soil-wet-66`
     5. `soil-wet-33`
     6. `crop-planted`
     7. `crop-planted-rotten`
     8. `crop-sprout`
     9. `crop-young`
     10. `crop-mature`
     11. `crop-rotten`
   - byte length `1319`
   - SHA-256 `2ec6df4ed336b68bc436557cc0cce5b0ce4135f6b698dcba78d18fbaa0fc2755`

2. `public/assets/project/farming/NestledBurrow_Well.png`
   - RGBA PNG, `16×16`
   - one buildable well frame
   - depth anchor offset `{x: 8, y: 14}`
   - collision rect `{left: 2, top: 8, right: 14, bottom: 14}`
   - byte length `365`
   - SHA-256 `38663d4ce106c0e7b4ec6dfeaacaeaf7542a60827475a61ae4704afc621e5226`

3. `public/assets/project/farming/NestledBurrow_Farming.manifest.json`
   - manifest version `2`;
   - canonical frame order, dimensions, hashes, moisture percentages, depth anchor, collision metadata and provenance.

### Existing immutable files reused

- seed merchant cardinal sheet: `public/assets/third-party/kenney/home-npc/character.png`
- seed merchant diagonal sheet: `public/assets/third-party/kenney/home-npc/diagonal.png`
- Basic Village environment remains the visual reference.
- Existing watering-can presentation is reused; no new watering-can binary is required.

## Asset contract

- Project-authored by the Lead through deterministic pixel-grid drawing.
- The final contact sheet was accepted by the user on 2026-07-28.
- No generative image model was used for the runtime binaries.
- No resampling or interpolation.
- Runtime uses nearest-neighbor filtering.
- Codex must not modify, regenerate, redraw, reinterpret, recolor, resize, recompress or replace these files.
- Missing or mismatched binary is a blocker.
- Codex implementation diff must contain no new or changed tracked binary files.
- Final report must state `Image generation was not invoked.`

## Critical gameplay constraints

- potato seed price: 1 persistent coin;
- seed and potato inventory stacks: maximum 99, multiple stacks allowed, atomic capacity planning;
- watering can capacity: 40, starts full;
- soil moisture decay counts only solar overlap 04:00–20:00;
- soil presentation selects `soil-wet-100`, `soil-wet-66`, `soil-wet-33` or `soil-dry` from the authoritative moisture state without introducing a second moisture model;
- potato requires 8 effective solar growth hours, maximum 4 credited per calendar day;
- moisture multiplier: 0–10 dry solar hours = 1; 10–17 = 2/3; 17–21 = 1/3; after 21 = 0;
- never-watered seed rots 72 absolute world hours after planting and uses `crop-planted-rotten`;
- after hydration, crop rots after 24 absolute world hours without new hydration and uses `crop-rotten`;
- rain counts as hydration; dynamic weather generation and weather UI are out of scope;
- harvest creates 4, 5 or 6 separate potato world items with uniform discrete probability;
- harvested potatoes and cooking potatoes are the same stackable `potato` inventory item;
- crops have no collision;
- well is a persistent 1×1 build object with a normal collider;
- only the well receives new build persistence in this slice; general build persistence remains out of scope.

## Content and presentation constraints

- remove `street-npc` and the neighbor quest completely;
- retain the former `home-npc` visual as stationary semantic entity `seed-merchant`;
- remove the permanent kitchen/raw/prepared/dishes/coins HUD panel;
- coin balance is visible beside the fullscreen control as a number with the canonical pixel coin, and remains visible in merchant UI;
- requested gameplay feedback uses code-native procedural Web Audio effects for resources, farming, inventory, cooking, tavern guests, time controls, build actions and shared menu open/close events;
- compact world interaction prompt sits above and never overlaps the inventory HUD;
- clock controls provide pause, 1×, 4× and 16× simulation speeds, show the active speed and hide while options or sleep are active;
- remove all canonical pre-planted map trees but keep manual tree construction;
- one canonical depth function orders player, merchant, manually placed trees, resources, walls/caps/junctions, facilities, bed, well, crops and dropped items by world depth pivot;
- the player changes order immediately when its foot point crosses an asset pivot, even while still inside the asset visual bounds.

## Validation

Before implementation, run `npm run check:task-047-assets`. Any failure is a blocker and must not be repaired by changing the expected hashes or binaries.

## Acceptance

A managed 320×180 preview proves the complete farming loop, all four soil moisture visuals, both rotten states, persistence/reload, RU/EN merchant UI, compact interaction prompt, absence of old HUD/canonical trees, and correct two-way tree depth crossing without leaving its visual bounds.

Do not stage, commit, push or open a gameplay PR before explicit user acceptance of the integrated preview. After `принято`, publish one Ready gameplay PR with final-head CI.
