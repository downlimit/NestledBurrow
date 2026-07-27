# External assets and licenses

This project uses only the listed third-party or project-provided assets in the playable prototype. Full source archives were used as temporary integration sources and are not stored on the production branch after the required files were selected.

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

### Active 8-direction diagonal extension

The diagonal frames are project-authored derivatives of the committed Kenney character. They were produced through deterministic pixel-grid editing after direct visual approval; generative image output is not accepted as a runtime source for this 16×16 character family.

- **Canonical pipeline:** hand-author the two left-facing 3/4 pose families on the exact 16×16 grid → mirror them for the right-facing directions → derive NPC variants through an exact palette remap from the committed cardinal sheets → generate a nearest-neighbor contact sheet → obtain visual approval → import binaries unchanged → integrate them through immutable visual profiles.
- **Reproducible builder:** `scripts/build-character-diagonals.py`.
- **Required non-mutating audit:** `scripts/check-character-diagonals.py`; it regenerates into an isolated temporary root, validates RGBA geometry and every frame, compares exact bytes and approved SHA-256 values, and emits `artifacts/character-diagonal-contact-sheet.png`.
- **Sheet geometry:** 48×64 PNG; 3 columns × 4 rows of 16×16 frames.
- **Columns:** `neutral`, `step-a`, `step-b`.
- **Rows:** `down-left`, `down-right`, `up-left`, `up-right`.
- **Walk cadence:** `step-a → neutral → step-b → neutral`.
- **Player diagonal sheet:** `public/assets/third-party/kenney/player/diagonal.png`
  - SHA-256: `402d12e53f0620cb7079ac51e134d398af4824267133e899b12af541535effe9`.
- **Home NPC diagonal sheet:** `public/assets/third-party/kenney/home-npc/diagonal.png`
  - SHA-256: `a54cd5b5d2398f6032c26d4284b0b7f612c838a48cc90ebda57c8adfddffd759`.
- **Street NPC diagonal sheet:** `public/assets/third-party/kenney/street-npc/diagonal.png`
  - SHA-256: `9f7f352a5627f3b5f6166f8d95685c4ad308f0941b72a670cd410a7f34df9164`.
- **Runtime integration:** player, home NPC and street NPC preload their approved diagonal sheets declaratively. The eight-sector facing quantizer selects cardinal or diagonal frame references without regenerating, recoloring or replacing the approved pixels.

## Legacy Kenney environment integration

The earlier Kenney Roguelike/RPG room and continuous-world atlases remain historical implementation material. They are no longer the active runtime environment after the Basic Village migration and must not be selected as the default source for new environment work.

## Pixelify Sans runtime font

- **Family:** Pixelify Sans.
- **Package:** `@fontsource/pixelify-sans` pinned to `5.2.7` in `package.json` and `package-lock.json`.
- **Official source:** https://fontsource.org/fonts/pixelify-sans
- **License:** SIL Open Font License 1.1, distributed inside the pinned package.
- **Runtime delivery:** package CSS imports `@fontsource/pixelify-sans/latin.css` and `@fontsource/pixelify-sans/cyrillic.css`; font binaries remain inside the installed dependency and are emitted by Vite rather than copied into tracked repository paths.
- **Role:** active Unicode HUD/dialogue font for English and Russian.
- **Integrity check:** `scripts/check-localization.mjs` verifies the pinned package and both subset imports.
- **Superseded asset:** the previously committed Rubik font is no longer an active runtime dependency and is removed by the font migration.

## Sunlit Save Point music

- **Provenance:** exact user-provided project attachment supplied for repository inclusion; no external CDN copy or substitute was used.
- **Runtime file:** `public/assets/audio/music/NestledBurrow_SunlitSavePoint.mp3`.
- **Runtime role:** one entry in the randomized seven-track background playlist controlled by the master and music channels.
- **Byte length:** `3,977,087`.
- **SHA-256:** `502dfd51bcfa7908becd39f604a6c73d868d9742fd3d1207c985cb9482627a91`.
- **Git blob SHA:** `76767a4fc6e5a7386118b044b5a99e02f24b0a07`.
- **Integrity check:** `scripts/check-audio.mjs` verifies the committed path, byte length and Git blob identity before runtime integration.

## User-uploaded ambient music library

- **Provenance:** exact project files uploaded by the user to `asset-inbox/incoming`; no external copy or substitute was used.
- **Delivery:** each runtime path references the exact uploaded Git blob without transcoding, normalization, recompression or byte modification.
- **Runtime integration:** Task #034 consumes these paths as a seven-track playlist together with `NestledBurrow_SunlitSavePoint.mp3`.

| Runtime file | Source upload | Git blob SHA |
| --- | --- | --- |
| `public/assets/audio/music/NestledBurrow_Ambient01.mp3` | `incoming/suno-song-3693411c.mp3` | `fe0ca6344d6dec08a0db0cff61e3832baa864265` |
| `public/assets/audio/music/NestledBurrow_Ambient02.mp3` | `incoming/suno-song-9d54e725.mp3` | `86f62c53ddef908809a1f9d410cf04c71bc0c6da` |
| `public/assets/audio/music/NestledBurrow_Ambient03.mp3` | `incoming/suno-song-c021cde4.mp3` | `c54abb765f04f337946c9617ca271a2f0f3c3716` |
| `public/assets/audio/music/NestledBurrow_Ambient04.mp3` | `incoming/suno-song-c322d726.mp3` | `1bfeb7c5e3a5ba782395373a1511ee2c04668d9f` |
| `public/assets/audio/music/NestledBurrow_Ambient05.mp3` | `incoming/suno-song-e6c3f46b.mp3` | `5c09c9bcff72b14f69f78085472d35de7a6c9886` |
| `public/assets/audio/music/NestledBurrow_Ambient06.mp3` | `incoming/suno-song-ee08dca2.mp3` | `188d62946399f80a9cd936797215eecef4799b63` |

| Runtime file | Byte length | SHA-256 |
| --- | ---: | --- |
| `NestledBurrow_Ambient01.mp3` | 1,400,592 | `090f87cf7b5c7c724c6eda76e597ff03b2bba7b1fb38d42ed9eb12857b007a9b` |
| `NestledBurrow_Ambient02.mp3` | 1,517,112 | `6718072ddd8cc1f85a07135c307f8ce67b9038c95da2a66a44fe728b121e04d7` |
| `NestledBurrow_Ambient03.mp3` | 1,418,448 | `af4c80498e484c1214c497a709046d6da959727381b6bea58878cd4bd4973b11` |
| `NestledBurrow_Ambient04.mp3` | 4,646,886 | `b32cd6a77bd783ac167afe75f3243f37129c7613749a281ee28e2d9f97ce584a` |
| `NestledBurrow_Ambient05.mp3` | 1,550,646 | `c9e054b9c94149c5cdda6a8be06a80df961a2b9e47b8aed77d9ed15cf3c57b90` |
| `NestledBurrow_Ambient06.mp3` | 1,392,462 | `a6bc44bded04434105c953dab23991187940c87fadea11357d2118a6e294069e` |

The uploaded `incoming/NestledBurrow_SunlitSavePoint.mp3` has Git blob SHA `76767a4fc6e5a7386118b044b5a99e02f24b0a07`, identical to the existing runtime file, and is intentionally not duplicated.

## User-uploaded furniture sprites

- **Provenance:** exact project PNG files uploaded by the user to `asset-inbox/incoming`; no external copy or substitute was used.
- **Delivery:** each runtime path references the exact uploaded Git blob without resampling, recoloring, recompression or derived exports.
- **Runtime integration:** Task #034 replaced the procedural shower, toilet and dining-table runtime drawings. The bed follow-up and build-mode correction use the same canonical PNGs for runtime furniture, library thumbnails, placement ghosts and demolition tint.

| Runtime file | Source upload | Native size | Git blob SHA |
| --- | --- | ---: | --- |
| `public/assets/project/facilities/NestledBurrow_Bed.png` | `incoming/bed.png` | `16×16` | `d828dec6d5056daa5cafbb3c173cfa0e8554b507` |
| `public/assets/project/facilities/NestledBurrow_Toilet.png` | `incoming/bathroom_toilet.png` | `16×16` | `d9f28cfc22467f365700cf7617d2d0f298fac17f` |
| `public/assets/project/facilities/NestledBurrow_Bathtub.png` | `incoming/bathroom_bathtub.png` | `32×32` | `8e987e03a7e8047df01e915e5b964bf5a6069906` |

| Runtime file | Byte length | SHA-256 |
| --- | ---: | --- |
| `NestledBurrow_Bed.png` | 2,415 | `5046a56d0e9cd13b8f85b34aaea3487fa0fb5626e880ce3179e3428dc8f35e91` |
| `NestledBurrow_Toilet.png` | 2,433 | `09634a14f5b7bac4327c698f910994e7cce4fd21f37a7c4a7be80dbbbb4ce2b7` |
| `NestledBurrow_Bathtub.png` | 4,534 | `afe4fee0f9100bfd23435a178ceaa4249be3afa5ef929e73b061f10789b637ff` |

## Project-authored dining table

- **Provenance:** prepared by the Lead with OpenAI image generation from the user's art direction, brought to the exact `48×16` grid version, and delivered to Codex as an immutable runtime binary. Codex did not generate or modify the image.
- **Runtime file:** `public/assets/project/facilities/NestledBurrow_DiningTableFeast.png`.
- **Runtime role:** the three-cell dining table used by the world, build library and placement preview; it remains distinct from the serving table.
- **Native size:** `48×16` RGBA PNG.
- **Byte length:** 730.
- **SHA-256:** `37fec3c3d5a521d8ac47592622fc79849c7e6b678fd9b4ae9086962365c54018`.
- **Git blob SHA:** `d12b16c0e6f4554d77f48f0e73c4e3963c291fd9`.

## Project-authored tavern sign

- **Provenance:** generated for Task #039 with OpenAI image generation from the user's art direction, then accepted by the user in the playable preview.
- **Runtime file:** `public/assets/project/facilities/NestledBurrow_TavernSign.png`.
- **Runtime role:** two-frame open/closed tavern advertising sign spritesheet.
- **Geometry:** 64×32 PNG; two horizontal 32×32 frames aligned to the 16 px world grid.
- **Byte length:** `2,981`.
- **SHA-256:** `47b15a21480a0096e4541900425dd0d870d9f50d1401d12832a6828abeaef154`.
- **Integrity check:** `scripts/check-guest.mjs` verifies the committed dimensions and exact bytes.
