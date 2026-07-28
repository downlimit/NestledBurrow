# Task #047 — Первый картофельный огородный цикл

## Status

Blocked until the Lead-owned farming binaries listed below exist in the confirmed Base SHA. Codex must not begin implementation before that read-back.

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
   - RGBA PNG, `144×16`
   - native grid `16×16`
   - 9 horizontal frames:
     0. `potato-seeds`
     1. `potato`
     2. `soil-dry`
     3. `soil-wet`
     4. `crop-planted`
     5. `crop-sprout`
     6. `crop-young`
     7. `crop-mature`
     8. `crop-rotten`
   - byte length `1040`
   - SHA-256 `3f241cfa1c05aa23d71b021a62fa4a25d7b552193b05268c0f762aa7f57ab2db`

2. `public/assets/project/farming/NestledBurrow_Well.png`
   - RGBA PNG, `16×16`
   - one buildable well frame
   - depth anchor offset `{x: 8, y: 14}`
   - collision rect `{left: 2, top: 8, right: 14, bottom: 14}`
   - byte length `365`
   - SHA-256 `38663d4ce106c0e7b4ec6dfeaacaeaf7542a60827475a61ae4704afc621e5226`

3. `public/assets/project/farming/NestledBurrow_Farming.manifest.json`
   - canonical frame order, dimensions, hashes, depth anchor, collision metadata and provenance.

### Existing immutable files reused

- seed merchant cardinal sheet: `public/assets/third-party/kenney/home-npc/character.png`
- seed merchant diagonal sheet: `public/assets/third-party/kenney/home-npc/diagonal.png`
- Basic Village environment remains the visual reference.
- Existing watering-can presentation is reused; no new watering-can binary is required.

## Asset contract

- Project-authored by the Lead through deterministic pixel-grid drawing.
- No generative image model was used.
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
- potato requires 8 effective solar growth hours, maximum 4 credited per calendar day;
- moisture multiplier: 0–4 dry solar hours = 1; 4–8 = 2/3; 8–12 = 1/3; after 12 = 0;
- never-watered seed rots 72 absolute world hours after planting;
- after hydration, crop rots after 24 absolute world hours without new hydration;
- rain counts as hydration; dynamic weather generation and weather UI are out of scope;
- harvest creates 4, 5 or 6 separate potato world items with uniform discrete probability;
- crops have no collision;
- well is a persistent 1×1 build object with a normal collider;
- only the well receives new build persistence in this slice; general build persistence remains out of scope.

## Content and presentation constraints

- remove `street-npc` and the neighbor quest completely;
- retain the former `home-npc` visual as stationary semantic entity `seed-merchant`;
- remove the permanent kitchen/raw/prepared/dishes/coins HUD panel;
- coin balance is visible in merchant UI;
- compact world interaction prompt sits above and never overlaps the inventory HUD;
- remove all canonical pre-planted map trees but keep manual tree construction;
- one canonical depth function orders player, merchant, manually placed trees, resources, walls/caps/junctions, facilities, bed, well, crops and dropped items by world depth pivot;
- the player changes order immediately when its foot point crosses an asset pivot, even while still inside the asset visual bounds.

## Validation

Before implementation, run `node scripts/check-task-047-assets.mjs`. Any failure is a blocker and must not be repaired by changing the expected hashes or binaries.

## Acceptance

A managed 320×180 preview proves the complete farming loop, persistence/reload, RU/EN merchant UI, compact interaction prompt, absence of old HUD/canonical trees, and correct two-way tree depth crossing without leaving its visual bounds.

Do not stage, commit, push or open a PR before explicit user acceptance. After `принято`, publish one Ready PR with final-head CI.
