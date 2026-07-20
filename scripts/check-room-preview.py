from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "src" / "kenneyRoomConfig.json"
ASSET_ROOT = ROOT / "public" / "assets" / "third-party" / "kenney"
OUTPUT_PATH = ROOT / "artifacts" / "room-preview.png"
GAME_WIDTH = 960
GAME_HEIGHT = 540
TILE_SIZE = 16
BACKGROUND = (32, 27, 24, 255)


def build_layout(columns: int, rows: int, config: dict) -> list[list[str]]:
    wall_bands = config["wallBands"]
    band_count = len(wall_bands)
    if columns < 3 or rows < band_count * 2 + 1:
        raise ValueError("Room is too small for configured wall bands")

    layout: list[list[str | None]] = [[None] * columns for _ in range(rows)]

    for y in range(band_count, rows - band_count):
        layout[y][0] = config["sideFrame"]
        layout[y][-1] = config["sideFrame"]
        for x in range(1, columns - 1):
            layout[y][x] = config["floorFrame"]

    for index, band in enumerate(wall_bands):
        for y in (index, rows - band_count + index):
            layout[y][0] = band["left"]
            layout[y][-1] = band["right"]
            for x in range(1, columns - 1):
                layout[y][x] = band["center"]

    if any(frame is None for row in layout for frame in row):
        raise AssertionError("Room layout contains empty cells")

    return layout  # type: ignore[return-value]


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    atlas_image_path = ASSET_ROOT / config["imagePath"]
    atlas_json_path = ASSET_ROOT / config["atlasPath"]
    atlas_data = json.loads(atlas_json_path.read_text(encoding="utf-8"))
    atlas = Image.open(atlas_image_path).convert("RGBA")

    room_scale = int(config["roomScale"])
    tile_size = TILE_SIZE * room_scale
    columns = GAME_WIDTH // tile_size
    rows = GAME_HEIGHT // tile_size
    offset_x = (GAME_WIDTH - columns * tile_size) // 2
    offset_y = (GAME_HEIGHT - rows * tile_size) // 2
    layout = build_layout(columns, rows, config)

    frames: dict[str, Image.Image] = {}
    for name, frame_data in atlas_data["frames"].items():
        frame = frame_data["frame"]
        tile = atlas.crop(
            (
                frame["x"],
                frame["y"],
                frame["x"] + frame["w"],
                frame["y"] + frame["h"],
            )
        )
        frames[name] = tile.resize((tile_size, tile_size), Image.Resampling.NEAREST)

    preview = Image.new("RGBA", (GAME_WIDTH, GAME_HEIGHT), BACKGROUND)
    for y, row in enumerate(layout):
        for x, frame_name in enumerate(row):
            preview.alpha_composite(frames[frame_name], (offset_x + x * tile_size, offset_y + y * tile_size))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    preview.save(OUTPUT_PATH)

    pixel_hash = hashlib.sha256(preview.tobytes()).hexdigest()
    expected_hash = config["approvedPreviewSha256"]
    if pixel_hash != expected_hash:
        raise AssertionError(
            "Room preview differs from the approved visual baseline: "
            f"expected {expected_hash}, got {pixel_hash}. Inspect artifacts/room-preview.png before updating the baseline."
        )

    print(
        f"Room preview passed: {columns}x{rows} tiles, {GAME_WIDTH}x{GAME_HEIGHT}px, pixel sha256 {pixel_hash}."
    )


if __name__ == "__main__":
    main()
