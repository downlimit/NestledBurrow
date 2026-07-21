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
- **Used parts:** one small ordinary human character with walk and idle frames for down, up, left, and right movement.
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
- **Final project paths:**
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

## Legacy Kenney environment integration

The earlier Kenney Roguelike/RPG room and continuous-world atlases remain historical implementation material. They are no longer the active runtime environment after the Basic Village migration and must not be selected as the default source for new environment work.

## Rubik Regular font

- Source: official `googlefonts/rubik` project (`fonts/ttf/Rubik-Regular.ttf`).
- License: SIL Open Font License 1.1; intended to be stored beside the asset as `public/assets/fonts/rubik/OFL.txt`.
- Selected file: `public/assets/fonts/rubik/Rubik-Regular.ttf`.
- SHA-256: pending in this environment because outbound access to GitHub raw assets is blocked by the configured proxy (HTTP 403) and the repository does not contain the font yet.
- Glyph validation: pending for the same asset-download limitation; must verify Latin and Cyrillic glyph coverage with real font inspection before merge.
