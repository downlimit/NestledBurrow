# Restore the room from a verified free Kenney pack

Work from the current `main` and obey the root `AGENTS.md`.

## Purpose

Replace the temporary generated wooden room textures with correctly selected free Kenney room assets while keeping the existing Kenney character. Fix the asset-selection pipeline so future packs cannot be integrated through guessed numeric IDs.

## Source recovery

The original official archives are available in repository history at commit:

`15c740574397c2cace6b05c810b6a5e7bfc7f4f9`

Recover them only into a temporary directory with `git show`:

```bash
mkdir -p .tmp/kenney

git show 15c740574397c2cace6b05c810b6a5e7bfc7f4f9:tasks/pixel-room/source/kenney_roguelike-rpg-pack.zip > .tmp/kenney/kenney_roguelike-rpg-pack.zip
git show 15c740574397c2cace6b05c810b6a5e7bfc7f4f9:tasks/pixel-room/source/kenney_rpg-urban-pack.zip > .tmp/kenney/kenney_rpg-urban-pack.zip
```

Do not commit either archive or `.tmp/`.

## Investigation first

Before changing runtime code:

1. List the complete archive structure.
2. Find all official atlas metadata files: XML, JSON, TXT, TSX or other mappings.
3. Determine whether standalone tile PNGs exist.
4. Document exactly why the previous indexes were wrong:
   - whether the atlas had spacing, margin, metadata ordering or transparent cells;
   - whether Phaser frame numbering differed from the pack's tile numbering;
   - whether the selected numbers were simply the wrong visual assets.
5. Write the findings into `tasks/restore-kenney-room/INVESTIGATION.md`.

Do not proceed from guessed row/column math.

## Asset-selection pipeline

Create a small deterministic extraction tool under `scripts/`.

Requirements:

- Prefer standalone source PNGs when present.
- Otherwise parse the official atlas metadata and extract exact rectangles from the source sheet.
- Do not use naked numeric frame IDs in runtime code.
- Export selected assets as standalone semantic PNG files:
  - `public/assets/third-party/kenney/room/floor-wood.png`
  - `wall-top.png`
  - `wall-bottom.png`
  - `wall-left.png`
  - `wall-right.png`
  - `corner-top-left.png`
  - `corner-top-right.png`
  - `corner-bottom-left.png`
  - `corner-bottom-right.png`
- Use only visually coherent assets from one Kenney room style.
- Do not mix unrelated dungeon, graveyard, industrial or furniture sprites into the room shell.

Because Codex PR transport may reject binary additions, also export every final PNG as base64 text under:

`tasks/restore-kenney-room/export/`

Create `MANIFEST.json` containing for each asset:

- semantic name;
- final project path;
- source pack;
- exact source path or atlas sprite name;
- source rectangle when applicable;
- width and height;
- SHA-256 of decoded PNG;
- intended role.

The main chat will decode the base64 files into real PNGs before merge.

## Contact sheet

Generate a labeled contact sheet showing all nine selected room assets at enlarged nearest-neighbor scale.

Export it as base64 text too, but do not integrate it into the game. Its purpose is review.

The labels must make it impossible to confuse floor, walls and corners.

## Runtime integration

After selecting verified assets:

- replace the generated room textures with the nine standalone Kenney PNGs;
- keep integer nearest-neighbor scaling;
- keep the current 960×540 canvas, player, movement, joystick, build label and collision behavior;
- reference semantic texture keys only;
- do not load the old full room spritesheet;
- do not add Tiled, physics, furniture, doors or new mechanics.

## Automated checks

Update `scripts/check-visual.mjs` so it validates:

- all nine semantic room files exist after base64 decoding;
- their dimensions match `MANIFEST.json`;
- their SHA-256 values match the manifest;
- no runtime reference to `roguelikeSheet_transparent.png` remains;
- no runtime room frame index table remains;
- player direction and idle checks continue to pass.

Add a check that every room texture key used by `src/main.js` is represented in the manifest.

## Manual self-test

Launch the game and inspect it at native 960×540 and a mobile viewport.

Explicitly verify:

- floor reads as floor rather than fences, props or graves;
- top and bottom walls are correct horizontal pieces;
- left and right walls are correct vertical pieces;
- all four corners connect sensibly;
- no unrelated sprites appear;
- player idle and all four walk directions still work;
- joystick does not cover or break the player;
- room bounds remain correct.

Include the exact observations in the final response. A successful build alone is not completion.

## Cleanup and documentation

- Keep `INVESTIGATION.md`, extraction script, manifest and final semantic assets.
- Remove temporary archives, extraction directories and contact-sheet export after the main chat has decoded and reviewed it.
- Update `ASSETS.md`, `PROJECT.md` and `LIBRARY.md` only after the runtime result has been visually inspected.
- Do not invent the next gameplay task.

## Commands

Run:

```bash
npm ci
npm run check
npm run dev -- --host 0.0.0.0
```

Create one final commit. Do not push and do not use `gh`.