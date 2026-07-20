from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "src" / "kenneyRoomConfig.json"
ASSET_ROOT = ROOT / "public" / "assets" / "third-party" / "kenney"
OUTPUTS = {
    "worldOverview": ROOT / "artifacts" / "world-overview.png",
    "cameraIndoor": ROOT / "artifacts" / "camera-indoor.png",
    "cameraOutdoor": ROOT / "artifacts" / "camera-outdoor.png",
    "topWallDetail": ROOT / "artifacts" / "top-wall-detail.png",
}


def load_frames(image_path: Path, atlas_path: Path) -> dict[str, Image.Image]:
    atlas = Image.open(image_path).convert("RGBA")
    data = json.loads(atlas_path.read_text(encoding="utf-8"))
    frames: dict[str, Image.Image] = {}
    for name, entry in data["frames"].items():
        frame = entry["frame"]
        frames[name] = atlas.crop((frame["x"], frame["y"], frame["x"] + frame["w"], frame["y"] + frame["h"]))
    return frames


def build_room_layout(config: dict, columns: int, rows: int, door_left: int, door_width: int) -> list[list[str | None]]:
    bands = config["wallBands"]
    band_count = len(bands)
    layout: list[list[str | None]] = [[None] * columns for _ in range(rows)]
    for y in range(band_count, rows - band_count):
        layout[y][0] = config["sideFrame"]
        layout[y][-1] = config["sideFrame"]
        for x in range(1, columns - 1):
            layout[y][x] = config["floorFrame"]
    for index, band in enumerate(bands):
        upper_y = index
        lower_y = rows - band_count + index
        layout[upper_y][0] = band["upperLeft"]
        layout[upper_y][-1] = band["upperRight"]
        layout[lower_y][0] = band["lowerLeft"]
        layout[lower_y][-1] = band["lowerRight"]
        for x in range(1, columns - 1):
            layout[upper_y][x] = band["center"]
            layout[lower_y][x] = band["center"]
    door_y = rows - band_count
    for x in range(door_left, door_left + door_width):
        layout[door_y][x] = config["floorFrame"]
        for y in range(door_y + 1, rows):
            layout[y][x] = None
    return layout


def pixel_hash(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def camera_view(world: Image.Image, center: tuple[int, int], size: tuple[int, int], player: Image.Image) -> Image.Image:
    width, height = size
    center_x, center_y = center
    scroll_x = min(max(round(center_x - width / 2), 0), world.width - width)
    scroll_y = min(max(round(center_y - height / 2), 0), world.height - height)
    view = world.crop((scroll_x, scroll_y, scroll_x + width, scroll_y + height))
    view.alpha_composite(player, (center_x - scroll_x - player.width // 2, center_y - scroll_y - player.height))
    return view


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    world_config = config["world"]
    tile_size = world_config["tileSize"]
    columns = world_config["columns"]
    rows = world_config["rows"]
    room_columns = world_config["roomColumns"]
    room_rows = world_config["roomRows"]
    room_x = world_config["roomTileX"]
    room_y = world_config["roomTileY"]
    door_width = world_config["doorWidth"]
    door_left_local = (room_columns - door_width) // 2
    door_left = room_x + door_left_local
    door_y = room_y + room_rows - len(config["wallBands"])

    room_frames = load_frames(ASSET_ROOT / config["imagePath"], ASSET_ROOT / config["atlasPath"])
    extension = config["extension"]
    world_frames = load_frames(ASSET_ROOT / extension["imagePath"], ASSET_ROOT / extension["atlasPath"])
    world = Image.new("RGBA", (columns * tile_size, rows * tile_size))
    for y in range(rows):
        for x in range(columns):
            world.alpha_composite(world_frames["grass"], (x * tile_size, y * tile_size))
    for y in range(door_y + 1, rows):
        for x in range(door_left, door_left + door_width):
            world.alpha_composite(world_frames["dirtPath"], (x * tile_size, y * tile_size))

    layout = build_room_layout(config, room_columns, room_rows, door_left_local, door_width)
    for local_y, row in enumerate(layout):
        for local_x, frame_name in enumerate(row):
            if frame_name is None:
                continue
            frames = world_frames if "Upper" in frame_name else room_frames
            world.alpha_composite(frames[frame_name], ((room_x + local_x) * tile_size, (room_y + local_y) * tile_size))

    player = Image.open(ASSET_ROOT / "player" / "tile_0267.png").convert("RGBA")
    spawn = ((room_x + room_columns // 2) * tile_size + tile_size // 2, (room_y + len(config["wallBands"]) + 3) * tile_size + 14)
    outdoor = ((door_left + 1) * tile_size + tile_size // 2, (door_y + 6) * tile_size + 14)
    game_size = (world_config["gameWidth"], world_config["gameHeight"])
    camera_indoor = camera_view(world, spawn, game_size, player)
    camera_outdoor = camera_view(world, outdoor, game_size, player)

    detail_height = len(config["wallBands"]) * tile_size
    left_detail = world.crop((room_x * tile_size, room_y * tile_size, (room_x + 3) * tile_size, room_y * tile_size + detail_height))
    right_detail = world.crop(((room_x + room_columns - 3) * tile_size, room_y * tile_size, (room_x + room_columns) * tile_size, room_y * tile_size + detail_height))
    scale = 4
    top_wall_detail = Image.new("RGBA", ((left_detail.width + right_detail.width) * scale, detail_height * scale))
    top_wall_detail.alpha_composite(left_detail.resize((left_detail.width * scale, detail_height * scale), Image.Resampling.NEAREST), (0, 0))
    top_wall_detail.alpha_composite(right_detail.resize((right_detail.width * scale, detail_height * scale), Image.Resampling.NEAREST), (left_detail.width * scale, 0))

    generated = {
        "worldOverview": world,
        "cameraIndoor": camera_indoor,
        "cameraOutdoor": camera_outdoor,
        "topWallDetail": top_wall_detail,
    }
    OUTPUTS["worldOverview"].parent.mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}
    for name, image in generated.items():
        image.save(OUTPUTS[name])
        hashes[name] = pixel_hash(image)

    expected = config.get("approvedPreviews", {})
    if any(expected.get(name) in (None, "pending") for name in OUTPUTS):
        raise AssertionError(f"Preview hashes are pending. Generated pixel hashes: {hashes}")
    for name, digest in hashes.items():
        if expected[name] != digest:
            raise AssertionError(f"{name} preview differs: expected {expected[name]}, got {digest}")
    print("World preview artifacts passed: " + ", ".join(f"{name} {digest}" for name, digest in hashes.items()))


if __name__ == "__main__":
    main()
