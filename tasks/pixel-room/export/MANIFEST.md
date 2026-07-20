# Pixel room text export manifest

This temporary export keeps the PR text-only. Decode each `.png.base64.txt` file after PR creation and write it to the listed final PNG path. Do not decode these files inside this branch.

| Base64 file | Final PNG path | Source path inside Kenney archive | Image size | Purpose | frameWidth | frameHeight | Used frame numbers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `tile_0266.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0266.png` | `Tiles/tile_0266.png` | 16 × 16 | player right walk frame 0 / idle candidate | 16 | 16 | right: 0 |
| `tile_0293.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0293.png` | `Tiles/tile_0293.png` | 16 × 16 | player right walk frame 1 | 16 | 16 | right: 1 |
| `tile_0320.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0320.png` | `Tiles/tile_0320.png` | 16 × 16 | player right walk frame 2 | 16 | 16 | right: 2 |
| `tile_0267.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0267.png` | `Tiles/tile_0267.png` | 16 × 16 | player down walk frame 0 / idle candidate | 16 | 16 | down: 0 |
| `tile_0294.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0294.png` | `Tiles/tile_0294.png` | 16 × 16 | player down walk frame 1 / idle frame | 16 | 16 | down: 1 |
| `tile_0321.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0321.png` | `Tiles/tile_0321.png` | 16 × 16 | player down walk frame 2 | 16 | 16 | down: 2 |
| `tile_0268.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0268.png` | `Tiles/tile_0268.png` | 16 × 16 | player up walk frame 0 / idle candidate | 16 | 16 | up: 0 |
| `tile_0295.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0295.png` | `Tiles/tile_0295.png` | 16 × 16 | player up walk frame 1 / idle frame | 16 | 16 | up: 1 |
| `tile_0322.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0322.png` | `Tiles/tile_0322.png` | 16 × 16 | player up walk frame 2 | 16 | 16 | up: 2 |
| `tile_0269.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0269.png` | `Tiles/tile_0269.png` | 16 × 16 | player left walk frame 0 / idle candidate | 16 | 16 | left: 0 |
| `tile_0296.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0296.png` | `Tiles/tile_0296.png` | 16 × 16 | player left walk frame 1 / idle frame | 16 | 16 | left: 1 |
| `tile_0323.png.base64.txt` | `public/assets/third-party/kenney/player/tile_0323.png` | `Tiles/tile_0323.png` | 16 × 16 | player left walk frame 2 | 16 | 16 | left: 2 |
| `roguelikeSheet_transparent.png.base64.txt` | `public/assets/third-party/kenney/room/roguelikeSheet_transparent.png` | `Spritesheet/roguelikeSheet_transparent.png` | 968 × 526 | room spritesheet frames: floor 494; top wall 90; bottom wall 147; left wall 146; right wall 148; corners 89, 91, 203, 205 | 16 | 16 | not a player animation |
