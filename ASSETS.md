# External assets and licenses

This project uses only the listed third-party assets in the playable prototype. Full source archives were used as temporary integration sources and are not stored on the production branch after the required files were selected.

## Basic Village Tileset

- **Author:** Forchild
- **Official source page:** https://forchild.itch.io/village-tileset
- **License:** CC0
- **Tile grid:** 16×16
- **Role in project:** canonical and priority environment tileset for the playable prototype.
- **Selection policy:** use Basic Village first for terrain, buildings, vegetation and compatible environment props. A different pack requires a missing asset category or explicit visual approval.
- **Runtime source sheets:**
  - `Outdoor_tileset.png`
  - `House_tileset.png`
  - `Trees_and_bushes.png`
- **Final project paths:**
  - `public/assets/third-party/basic-village/Outdoor_tileset.png`
  - `public/assets/third-party/basic-village/House_tileset.png`
  - `public/assets/third-party/basic-village/Trees_and_bushes.png`
- **Runtime configuration:** `src/worldConfig.js`
- **World composition:** `src/worldLayout.js`
- **Visual verification:** `scripts/check-visual.mjs` and `scripts/check-room-preview.py`

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
