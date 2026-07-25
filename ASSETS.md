- **Superseded asset:** the previously committed Rubik font is no longer an active runtime dependency and is removed by the font migration.

## Sunlit Save Point music

- **Provenance:** exact user-provided project attachment supplied for repository inclusion; no external CDN copy or substitute was used.
- **Runtime file:** `public/assets/audio/music/NestledBurrow_SunlitSavePoint.mp3`.
- **Runtime role:** looping background music controlled by the master and music channels.
- **Byte length:** `3,977,087`.
- **SHA-256:** `502dfd51bcfa7908becd39f604a6c73d868d9742fd3d1207c985cb9482627a91`.
- **Git blob SHA:** `76767a4fc6e5a7386118b044b5a99e02f24b0a07`.
- **Integrity check:** `scripts/check-audio.mjs` verifies the committed path, byte length and Git blob identity before runtime integration.

## User-uploaded ambient music library

The following exact blobs were uploaded by the user to `asset-inbox/incoming` and promoted without transcoding, normalization, recompression, or byte modification. Runtime code integration belongs to Task #034.

| Runtime file | Source upload | Git blob SHA |
| --- | --- | --- |
| `public/assets/audio/music/NestledBurrow_Ambient01.mp3` | `incoming/suno-song-3693411c.mp3` | `fe0ca6344d6dec08a0db0cff61e3832baa864265` |
| `public/assets/audio/music/NestledBurrow_Ambient02.mp3` | `incoming/suno-song-9d54e725.mp3` | `86f62c53ddef908809a1f9d410cf04c71bc0c6da` |
| `public/assets/audio/music/NestledBurrow_Ambient03.mp3` | `incoming/suno-song-c021cde4.mp3` | `c54abb765f04f337946c9617ca271a2f0f3c3716` |
| `public/assets/audio/music/NestledBurrow_Ambient04.mp3` | `incoming/suno-song-c322d726.mp3` | `1bfeb7c5e3a5ba782395373a1511ee2c04668d9f` |
| `public/assets/audio/music/NestledBurrow_Ambient05.mp3` | `incoming/suno-song-e6c3f46b.mp3` | `5c09c9bcff72b14f69f78085472d35de7a6c9886` |
| `public/assets/audio/music/NestledBurrow_Ambient06.mp3` | `incoming/suno-song-ee08dca2.mp3` | `188d62946399f80a9cd936797215eecef4799b63` |

`incoming/NestledBurrow_SunlitSavePoint.mp3` has the same Git blob SHA as the existing runtime file and was intentionally not duplicated.

## User-uploaded facility sprites

The following exact transparent PNG blobs were uploaded by the user and promoted without resampling, recoloring, recompression, or derived exports. Runtime code integration belongs to Task #034.

| Runtime file | Source upload | Native size | Git blob SHA |
| --- | --- | ---: | --- |
| `public/assets/project/facilities/NestledBurrow_Toilet.png` | `incoming/bathroom_toilet.png` | `16×16` | `d9f28cfc22467f365700cf7617d2d0f298fac17f` |
| `public/assets/project/facilities/NestledBurrow_Bathtub.png` | `incoming/bathroom_bathtub.png` | `32×32` | `8e987e03a7e8047df01e915e5b964bf5a6069906` |
| `public/assets/project/facilities/NestledBurrow_DiningTableFeast.png` | `incoming/dining_table_feast.png` | `48×16` | `57af651f65f6c6f4ff1ccac55f11819d0832efa3` |
