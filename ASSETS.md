# External assets and licenses

This project uses only the listed third-party assets in the playable prototype. Full source archives were used as temporary integration sources and are not stored on the production branch after the required files were selected.

## Basic Village Tileset

- **Author:** Forchild
- **Official source page:** https://forchild.itch.io/village-tileset
- **License:** CC0
- **Tile grid:** 16×16
- **Role in project:** canonical and priority environment tileset for the playable prototype.
- **Selection policy:** use Basic Village first for terrain, buildings, vegetation and compatible environment props. A different pack requires a missing asset category or explicit visual approval.
- **Official archive SHA-256:** `b4297a432566699e7a2858b067b4050c8631d8a96aa3cca99d29e97cae782b9a` (`BasicVillageTileset.zip`).
- **Runtime source sheets:**
  - `Outdoor_tileset.png` — 192×128, 12×8 frames, SHA-256 `967806f572267b87787d05414e98350c9cb19f5eab426db6d4889d99b123f89c`
  - `House_tileset.png` — 192×160, 12×10 frames, SHA-256 `89b48d140121ddec253b50d7e36c7bcae0c5b8e1168ae47b7cfeb5439b584085`
  - `Trees_and_bushes.png` — 144×96, 9×6 frames, SHA-256 `55be641f0a0f8461c9bdd5f1a1fc2fef607428194df152197335eabc96dd9b5a`
- **Final project paths:**
  - `public/assets/third-party/basic-village/Outdoor_tileset.png`
  - `public/assets/third-party/basic-village/House_tileset.png`
  - `public/assets/third-party/basic-village/Trees_and_bushes.png`
- **Selected frame groups:** centralized under semantic names in `src/worldConfig.js` as `OUTDOOR_FRAMES` and `HOUSE_FRAMES`; tree variants are assembled in `src/worldLayout.js` from verified 3×4 regions.
- **World composition:** `src/worldLayout.js`
- **Integrity and geometry checks:** `scripts/check-visual.mjs`
- **Rendered verification:** `scripts/check-room-preview.py`

## Kenney RPG Urban Pack

- **Author:** Kenney
- **Official source page:** https://kenney.nl/assets/rpg-urban-pack
- **License:** CC0 1.0 Universal
- **Original player selection:** one small ordinary human character with walk and idle frames for down, up, left and right movement.
- **Source files selected from archive:**
  - `Tiles/tile_0266.png`
  - `Tiles/tile_0267.png`
  - `Tiles/tile_0268.png`
  - `Tiles/tile_0269.png`
  - `Tiles/tile_0293.png`
  - `Tiles/tile_0294.png`
  - `Tiles/tile_0295.png`
  - `Tiles/tile_0296.png`
  - `Tiles/tile_0320.png`
  - `Tiles/tile_0321.png`
  - `Tiles/tile_0322.png`
  - `Tiles/tile_0323.png`
- **Original player runtime paths:**
  - `public/assets/third-party/kenney/player/tile_0266.png`
  - `public/assets/third-party/kenney/player/tile_0267.png`
  - `public/assets/third-party/kenney/player/tile_0268.png`
  - `public/assets/third-party/kenney/player/tile_0269.png`
  - `public/assets/third-party/kenney/player/tile_0293.png`
  - `public/assets/third-party/kenney/player/tile_0294.png`
  - `public/assets/third-party/kenney/player/tile_0295.png`
  - `public/assets/third-party/kenney/player/tile_0296.png`
  - `public/assets/third-party/kenney/player/tile_0320.png`
  - `public/assets/third-party/kenney/player/tile_0321.png`
  - `public/assets/third-party/kenney/player/tile_0322.png`
  - `public/assets/third-party/kenney/player/tile_0323.png`

### NPC palette-variant skins

The home and street NPC sheets are project-authored palette variants derived from the committed Kenney player frames above. Pixel geometry, transparency and animation poses are unchanged; only the palette is changed. CC0 permits these adaptations.

- **Home NPC sheet:** `public/assets/third-party/kenney/home-npc/character.png`
  - 48×64 PNG; 3 columns × 4 rows of 16×16 frames.
  - SHA-256: `8d33da9b389e77b0c27417d9d1ab326c0e7e67e6a0605896b1d6810e01e29ee1`.
  - Visual palette: green headwear and teal clothing.
- **Street NPC sheet:** `public/assets/third-party/kenney/street-npc/character.png`
  - 48×64 PNG; 3 columns × 4 rows of 16×16 frames.
  - SHA-256: `a07760963a248bbe78b6d858448f620e6f13999e59b55170de277f5d94576b02`.
  - Visual palette: blue headwear and burgundy clothing.
- **Canonical frame manifest:** `public/assets/third-party/kenney/npc-visual-profiles.manifest.json`.
- **Sheet columns:** `neutral`, `step-a`, `step-b`.
- **Sheet rows:** `down`, `left`, `right`, `up`.
- **Walk cadence:** `step-a → neutral → step-b → neutral`.
- **Binary delivery:** the two runtime PNG files are committed before the code-only NPC reskin task; Codex must consume these paths and must not create or replace binary assets in that task.

## Legacy Kenney environment integration

The earlier Kenney Roguelike/RPG room and continuous-world atlases remain historical implementation material. They are no longer the active runtime environment after the Basic Village migration and must not be selected as the default source for new environment work.

## Rubik Regular font

- **Source:** official `googlefonts/rubik` project, archived version-2 file `old/version-2/fonts/ttf/Rubik-Regular.ttf`.
- **License:** SIL Open Font License 1.1, committed as `public/assets/fonts/rubik/OFL.txt`.
- **Runtime file:** `public/assets/fonts/rubik/Rubik-Regular.ttf`.
- **SHA-256:** `a66d53c66f8e31520c9b6212eae9e1c6bdd59e01eab2f2068ddd1f80f062c235`.
- **Glyph validation:** fontTools cmap inspection confirmed representative Latin and Cyrillic coverage: `AaZzАаЯяЁё`.
- **Integrity check:** `scripts/check-localization.mjs` requires the committed font, license and exact SHA-256.
