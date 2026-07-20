from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TILE_SIZE = 16
GAME_WIDTH = 320
GAME_HEIGHT = 180
WORLD_COLUMNS = 64
WORLD_ROWS = 48
WORLD_WIDTH = WORLD_COLUMNS * TILE_SIZE
WORLD_HEIGHT = WORLD_ROWS * TILE_SIZE

HOUSE_X = 19
HOUSE_Y = 11
HOUSE_COLUMNS = 26
HOUSE_ROWS = 17
DOOR_WIDTH = 2
DOOR_LEFT = HOUSE_X + (HOUSE_COLUMNS - DOOR_WIDTH) // 2
DOOR_Y = HOUSE_Y + HOUSE_ROWS - 1

ASSET_ROOT = ROOT / "public" / "assets" / "third-party"
VILLAGE_ROOT = ASSET_ROOT / "basic-village"
PLAYER_PATH = ASSET_ROOT / "kenney" / "player" / "tile_0267.png"

OUTPUTS = {
    "worldOverview": ROOT / "artifacts" / "world-overview.png",
    "cameraIndoor": ROOT / "artifacts" / "camera-indoor.png",
    "cameraOutdoor": ROOT / "artifacts" / "camera-outdoor.png",
    "topWallDetail": ROOT / "artifacts" / "top-wall-detail.png",
}

OUTDOOR_FRAMES = {
    "grass": 0,
    "grassDetails": [1, 2, 12, 13, 14, 24, 25, 26],
    "pathTop": [3, 4, 5],
    "pathMiddle": [15, 16, 17],
}

HOUSE_FRAMES = {
    "topLeft": 0,
    "top": 1,
    "topRight": 2,
    "sideLeft": 3,
    "sideRight": 4,
    "bottomLeft": 24,
    "bottom": 25,
    "bottomRight": 26,
    "floor": [53, 54, 55, 65, 66, 67, 77, 78, 79],
}

TREES = [
    (7, 6, 0),
    (52, 7, 1),
    (8, 33, 2),
    (51, 34, 0),
]


def load_sheet(filename: str) -> Image.Image:
    return Image.open(VILLAGE_ROOT / filename).convert("RGBA")


def crop_frame(sheet: Image.Image, frame_index: int) -> Image.Image:
    columns = sheet.width // TILE_SIZE
    x = (frame_index % columns) * TILE_SIZE
    y = (frame_index // columns) * TILE_SIZE
    return sheet.crop((x, y, x + TILE_SIZE, y + TILE_SIZE))


def draw_tile(world: Image.Image, sheet: Image.Image, frame_index: int, x: int, y: int) -> None:
    world.alpha_composite(crop_frame(sheet, frame_index), (x * TILE_SIZE, y * TILE_SIZE))


def render_world() -> Image.Image:
    outdoor = load_sheet("Outdoor_tileset.png")
    house = load_sheet("House_tileset.png")
    trees = load_sheet("Trees_and_bushes.png")
    world = Image.new("RGBA", (WORLD_WIDTH, WORLD_HEIGHT), (23, 23, 36, 255))

    for y in range(WORLD_ROWS):
        for x in range(WORLD_COLUMNS):
            detail = (x * 17 + y * 29) % 43
            frame = (
                OUTDOOR_FRAMES["grassDetails"][detail]
                if detail < len(OUTDOOR_FRAMES["grassDetails"])
                else OUTDOOR_FRAMES["grass"]
            )
            draw_tile(world, outdoor, frame, x, y)

    for y in range(DOOR_Y, WORLD_ROWS):
        frames = OUTDOOR_FRAMES["pathTop"] if y == DOOR_Y else OUTDOOR_FRAMES["pathMiddle"]
        for column, frame in enumerate(frames):
            draw_tile(world, outdoor, frame, DOOR_LEFT - 1 + column, y)

    for y in range(HOUSE_Y + 1, DOOR_Y):
        for x in range(HOUSE_X + 1, HOUSE_X + HOUSE_COLUMNS - 1):
            local_x = (x - HOUSE_X - 1) % 3
            local_y = (y - HOUSE_Y - 1) % 3
            draw_tile(world, house, HOUSE_FRAMES["floor"][local_y * 3 + local_x], x, y)

    for x in range(HOUSE_X, HOUSE_X + HOUSE_COLUMNS):
        if x == HOUSE_X:
            frame = HOUSE_FRAMES["topLeft"]
        elif x == HOUSE_X + HOUSE_COLUMNS - 1:
            frame = HOUSE_FRAMES["topRight"]
        else:
            frame = HOUSE_FRAMES["top"]
        draw_tile(world, house, frame, x, HOUSE_Y)

    for y in range(HOUSE_Y + 1, DOOR_Y):
        draw_tile(world, house, HOUSE_FRAMES["sideLeft"], HOUSE_X, y)
        draw_tile(world, house, HOUSE_FRAMES["sideRight"], HOUSE_X + HOUSE_COLUMNS - 1, y)

    for x in range(HOUSE_X, HOUSE_X + HOUSE_COLUMNS):
        if DOOR_LEFT <= x < DOOR_LEFT + DOOR_WIDTH:
            continue
        if x == HOUSE_X:
            frame = HOUSE_FRAMES["bottomLeft"]
        elif x == HOUSE_X + HOUSE_COLUMNS - 1:
            frame = HOUSE_FRAMES["bottomRight"]
        else:
            frame = HOUSE_FRAMES["bottom"]
        draw_tile(world, house, frame, x, DOOR_Y)

    for tree_x, tree_y, variant in TREES:
        base = variant * 3
        for row in range(4):
            for column in range(3):
                draw_tile(world, trees, base + row * 9 + column, tree_x + column, tree_y + row)

    return world


def camera_view(world: Image.Image, center: tuple[int, int], player: Image.Image) -> Image.Image:
    center_x, center_y = center
    scroll_x = min(max(round(center_x - GAME_WIDTH / 2), 0), WORLD_WIDTH - GAME_WIDTH)
    scroll_y = min(max(round(center_y - GAME_HEIGHT / 2), 0), WORLD_HEIGHT - GAME_HEIGHT)
    view = world.crop((scroll_x, scroll_y, scroll_x + GAME_WIDTH, scroll_y + GAME_HEIGHT))
    view.alpha_composite(
        player,
        (center_x - scroll_x - player.width // 2, center_y - scroll_y - player.height),
    )
    return view


def pixel_hash(image: Image.Image) -> str:
    return hashlib.sha256(image.tobytes()).hexdigest()


def main() -> None:
    world = render_world()
    player = Image.open(PLAYER_PATH).convert("RGBA")
    spawn = (
        (HOUSE_X + HOUSE_COLUMNS // 2) * TILE_SIZE + TILE_SIZE // 2,
        (HOUSE_Y + 8) * TILE_SIZE + TILE_SIZE - 2,
    )
    outdoor_target = (
        (DOOR_LEFT + 1) * TILE_SIZE + TILE_SIZE // 2,
        (DOOR_Y + 7) * TILE_SIZE + TILE_SIZE - 2,
    )

    house_crop = world.crop(
        (
            (HOUSE_X - 1) * TILE_SIZE,
            (HOUSE_Y - 1) * TILE_SIZE,
            (HOUSE_X + HOUSE_COLUMNS + 1) * TILE_SIZE,
            (DOOR_Y + 2) * TILE_SIZE,
        )
    )
    scale = 2
    house_detail = house_crop.resize(
        (house_crop.width * scale, house_crop.height * scale),
        Image.Resampling.NEAREST,
    )

    generated = {
        "worldOverview": world,
        "cameraIndoor": camera_view(world, spawn, player),
        "cameraOutdoor": camera_view(world, outdoor_target, player),
        "topWallDetail": house_detail,
    }

    OUTPUTS["worldOverview"].parent.mkdir(parents=True, exist_ok=True)
    hashes: dict[str, str] = {}
    for name, image in generated.items():
        image.save(OUTPUTS[name])
        hashes[name] = pixel_hash(image)

    print(
        "Basic Village preview artifacts generated: "
        + ", ".join(f"{name} {digest}" for name, digest in hashes.items())
    )


if __name__ == "__main__":
    main()
