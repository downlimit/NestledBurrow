# External assets and licenses

This project uses only the listed third-party assets in the playable prototype. Full source archives were used as temporary integration sources and are not stored on the current `main` branch after the required files were selected.

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

## Kenney Roguelike/RPG Pack

- **Author:** Kenney
- **Official source page:** https://kenney.nl/assets/roguelike-rpg-pack
- **License:** CC0 1.0 Universal
- **Used parts:** one floor tile and a verified family of outer, middle, inner, side, left-edge, and right-edge wall tiles.
- **Historical source archive:** commit `c202320f7b8d4620f19707bf41503c79a347ded4`, path `tasks/pixel-room/source/kenney_roguelike-rpg-pack.zip`.
- **Source sheet:** `Spritesheet/roguelikeSheet_transparent.png`, 968×526 pixels, 16×16 frames, `margin=0`, `spacing=1`, 57 columns and 31 rows.
- **Selection method:** every source frame was sliced into a labeled contact sheet, the supplied indoor sample map was reconstructed, and the selected tiles were visually inspected before integration. Raw frame numbers are not used by gameplay code.
- **Final semantic atlas:**
  - `public/assets/third-party/kenney/room/kenney-room-tiles.png`
  - `public/assets/third-party/kenney/room/kenney-room-tiles.json`
- **Canonical machine-readable audit manifest:** `src/kenneyRoomConfig.json`.
- **Atlas SHA-256:** `b7f461ec87dee4ed44ee5e02f9a693bd4a7ca29b316eb7cc2acb3bcdf0dc1fc0`.
- **Approved 960×540 room-preview pixel SHA-256:** `f3a896c06740dd7cd46475440c971e3d6fd56f25ffc462fae62eaea6ec299ae5`.
- **Semantic names and original source frames:**
  - `floor` → `119`
  - `wallOuter` → `698`
  - `wallVertical` → `756`
  - `wallOuterLeft` → `757`
  - `wallOuterRight` → `758`
  - `wallMiddle` → `873`
  - `wallMiddleLeft` → `872`
  - `wallMiddleRight` → `874`
  - `wallInner` → `868`
  - `wallInnerLeft` → `869`
  - `wallInnerRight` → `871`

Original frame numbers and source-file hashes are retained only in `src/kenneyRoomConfig.json` for traceability. Runtime code addresses the compact atlas exclusively by semantic frame names.

### Continuous world extension atlas

- **Used parts:** outdoor frames `0005` (`grass`) and `0006` (`dirtPath`), plus vertically flipped copies of the already audited wall edge frames for the down-facing upper joins.
- **Final semantic atlas:**
  - `public/assets/third-party/kenney/world/kenney-world-extension.png`
  - `public/assets/third-party/kenney/world/kenney-world-extension.json`
- **Canonical machine-readable audit manifest:** `src/kenneyRoomConfig.json`.
- **Atlas SHA-256:** `e491f948634436e3a5115e923d5f4cd724004d9935088f25c30e3baa53281efe`.
- **Approved preview artifacts:** `artifacts/world-overview.png`, `artifacts/camera-indoor.png`, `artifacts/camera-outdoor.png`, and `artifacts/top-wall-detail.png`.
