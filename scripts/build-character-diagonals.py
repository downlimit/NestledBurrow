#!/usr/bin/env python3
"""Build the approved 8-direction diagonal character sheets deterministically.

The four diagonal poses are hand-authored on a 16×16 pixel grid for the canonical
Kenney-derived player. Right-facing rows are exact horizontal mirrors. NPC sheets
are exact palette remaps derived from their committed cardinal sheets.

Outputs:
- public/assets/third-party/kenney/player/diagonal.png
- public/assets/third-party/kenney/home-npc/diagonal.png
- public/assets/third-party/kenney/street-npc/diagonal.png
- artifacts/character-diagonal-contact-sheet.png
"""

from __future__ import annotations

import argparse
import hashlib
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

FRAME_SIZE = 16
COLUMNS = ("neutral", "step-a", "step-b")
DIAGONAL_ROWS = ("down-left", "down-right", "up-left", "up-right")

PLAYER_CARDINAL_FRAMES = {
    "down": ("tile_0267", "tile_0294", "tile_0321"),
    "left": ("tile_0266", "tile_0293", "tile_0320"),
    "right": ("tile_0269", "tile_0296", "tile_0323"),
    "up": ("tile_0268", "tile_0295", "tile_0322"),
}

PALETTE = {
    ".": (0, 0, 0, 0),
    "A": (135, 77, 39, 255),
    "B": (245, 169, 76, 255),
    "C": (218, 146, 62, 255),
    "D": (188, 125, 54, 255),
    "E": (96, 96, 90, 255),
    "F": (55, 55, 51, 255),
    "G": (149, 95, 62, 255),
    "H": (180, 115, 74, 255),
    "I": (101, 65, 64, 255),
    "J": (113, 72, 47, 255),
    "K": (141, 82, 67, 255),
    "L": (197, 185, 147, 255),
    "M": (145, 142, 185, 255),
    "N": (161, 157, 204, 255),
    "O": (214, 212, 170, 255),
    "P": (122, 119, 164, 255),
    "Q": (220, 134, 82, 255),
    "R": (197, 118, 82, 255),
}

DOWN_LEFT = (
    (
        "................",
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADBBEEBBCDA...",
        ".AFEGHGGHGCDA...",
        "..FEHIHHIHEBA...",
        "..JGHIHHIHEFA...",
        "..KJHHGGHHFF....",
        ".KKLNGHHGOPK....",
        ".KHGMLOOOLMK....",
        ".KGHMPMMLGHK....",
        ".KKKMMMMMPK.....",
        "...KPMKKMMK.....",
        "...KQQKKQQK.....",
    ),
    (
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADBBEEBBCDA...",
        ".AFEGHGGHGCDA...",
        "..FEHIHHIHEBA...",
        "..JGHIHHIHEFA...",
        "..KJHHGGHHFF....",
        ".KKLMGHHGOPK....",
        ".KLLMLOOOLKK....",
        ".KHGPPMMLGHK....",
        ".KGHPMMMMGHK....",
        ".KKKPMKKMPQK....",
        "...KKKKKMMQK....",
        ".......KQQK.....",
    ),
    (
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADBBEEBBCDA...",
        ".AFEGHGGHGCDA...",
        "..FEHIHHIHEBA...",
        "..JGHIHHIHEFA...",
        ".KKJHHGGHHFF....",
        ".KHLMGHHGOPK....",
        ".KGLMLOOOLKK....",
        ".KKKPPMMLGHK....",
        "...KPMMMMGHK....",
        "...KPMKKMPKKK...",
        "...KMMKKKKK.....",
        "...KQQK.........",
    ),
)

UP_LEFT = (
    (
        "................",
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADCCBBCCCDA...",
        ".AFBCCBBCCBDA...",
        "..FEBBBBBBEBA...",
        "..JGEEEEEEFA....",
        "..JJGHHHHGFF....",
        ".KKLNLOOOLPK....",
        ".KHGMPMMLGHK....",
        ".KGHMMPMLGHK....",
        ".KKKMMPPMK......",
        "...KPMKKMMK.....",
        "...KQQKKQQK.....",
    ),
    (
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADCCBBCCCDA...",
        ".AFBCCBBCCBDA...",
        "..FEBBBBBBEBA...",
        "..JGEEEEEEFA....",
        "..JJGHHHHGFFK...",
        ".KKLMGHHGOPK....",
        ".KLLMLOOOLKK....",
        ".KHGMPMMLGHK....",
        ".KGHMMPPMGK.....",
        ".KKKQQKKMMK.....",
        "...KKKKKMMK.....",
        ".......KQQK.....",
    ),
    (
        ".....AAAAAA.....",
        "...AAABCCBAA....",
        "..AACCBBCCBAA...",
        "..ADCCBBCCDAA...",
        ".AADCCBBCCCDA...",
        ".AFBCCBBCCBDA...",
        "..FEBBBBBBEBA...",
        "..JGEEEEEEFA....",
        ".KJJGHHHHGFF....",
        ".KHLMGHHGOPK....",
        ".KGLMLOOOLKK....",
        ".KKKMPMMLGHK....",
        "...KMMPPMGHK....",
        "...KMMKKQQKKK...",
        "...KMMKKKKK.....",
        "...KQQK.........",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Repository root; defaults to the parent of scripts/.",
    )
    return parser.parse_args()


def frame_from_rows(rows: tuple[str, ...]) -> Image.Image:
    if len(rows) != FRAME_SIZE or any(len(row) != FRAME_SIZE for row in rows):
        raise ValueError("Every authored frame must be exactly 16×16")
    image = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), PALETTE["."])
    pixels = image.load()
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            pixels[x, y] = PALETTE[symbol]
    return image


def build_player_cardinal_sheet(root: Path) -> Image.Image:
    source_dir = root / "public/assets/third-party/kenney/player"
    sheet = Image.new("RGBA", (48, 64), PALETTE["."])
    for row_index, direction in enumerate(("down", "left", "right", "up")):
        for column_index, texture_key in enumerate(PLAYER_CARDINAL_FRAMES[direction]):
            source = Image.open(source_dir / f"{texture_key}.png").convert("RGBA")
            if source.size != (FRAME_SIZE, FRAME_SIZE):
                raise ValueError(f"{texture_key}.png must be 16×16, got {source.size}")
            sheet.paste(source, (column_index * FRAME_SIZE, row_index * FRAME_SIZE))
    return sheet


def build_diagonal_sheet() -> Image.Image:
    sheet = Image.new("RGBA", (48, 64), PALETTE["."])
    for column, rows in enumerate(DOWN_LEFT):
        left = frame_from_rows(rows)
        sheet.paste(left, (column * FRAME_SIZE, 0))
        sheet.paste(left.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (column * FRAME_SIZE, 16))
    for column, rows in enumerate(UP_LEFT):
        left = frame_from_rows(rows)
        sheet.paste(left, (column * FRAME_SIZE, 32))
        sheet.paste(left.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (column * FRAME_SIZE, 48))
    return sheet


def derive_exact_palette_map(source: Image.Image, variant: Image.Image) -> dict[tuple[int, ...], tuple[int, ...]]:
    if source.size != variant.size:
        raise ValueError(f"Palette sources must share dimensions: {source.size} != {variant.size}")
    observed: dict[tuple[int, ...], Counter[tuple[int, ...]]] = defaultdict(Counter)
    for source_pixel, variant_pixel in zip(source.getdata(), variant.getdata(), strict=True):
        observed[source_pixel][variant_pixel] += 1

    mapping: dict[tuple[int, ...], tuple[int, ...]] = {}
    for source_pixel, candidates in observed.items():
        if len(candidates) != 1:
            raise ValueError(f"NPC sheet is not an exact palette-only variant for {source_pixel}: {candidates}")
        mapping[source_pixel] = next(iter(candidates))
    return mapping


def recolor_exact(image: Image.Image, mapping: dict[tuple[int, ...], tuple[int, ...]]) -> Image.Image:
    missing = set(image.getdata()) - set(mapping)
    if missing:
        raise ValueError(f"Authored diagonal sheet uses unmapped source colors: {sorted(missing)}")
    output = Image.new("RGBA", image.size)
    output.putdata([mapping[pixel] for pixel in image.getdata()])
    return output


def save_png(image: Image.Image, path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_contact_sheet(pairs: tuple[tuple[Image.Image, Image.Image], ...]) -> Image.Image:
    gap = 4
    native = Image.new("RGBA", (100, 200), PALETTE["."])
    for row, (cardinal, diagonal) in enumerate(pairs):
        y = row * (64 + gap)
        native.paste(cardinal, (0, y))
        native.paste(diagonal, (52, y))
    return native.resize((native.width * 8, native.height * 8), Image.Resampling.NEAREST)


def main() -> None:
    root = parse_args().root.resolve()
    base = root / "public/assets/third-party/kenney"
    player_cardinal = build_player_cardinal_sheet(root)
    home_cardinal = Image.open(base / "home-npc/character.png").convert("RGBA")
    street_cardinal = Image.open(base / "street-npc/character.png").convert("RGBA")

    player_diagonal = build_diagonal_sheet()
    home_diagonal = recolor_exact(
        player_diagonal,
        derive_exact_palette_map(player_cardinal, home_cardinal),
    )
    street_diagonal = recolor_exact(
        player_diagonal,
        derive_exact_palette_map(player_cardinal, street_cardinal),
    )

    outputs = {
        base / "player/diagonal.png": player_diagonal,
        base / "home-npc/diagonal.png": home_diagonal,
        base / "street-npc/diagonal.png": street_diagonal,
    }
    for path, image in outputs.items():
        if image.size != (48, 64):
            raise AssertionError(f"{path}: expected 48×64, got {image.size}")
        if image.getbbox() is None:
            raise AssertionError(f"{path}: image is empty")
        print(f"{path.relative_to(root)}  {save_png(image, path)}")

    contact = build_contact_sheet(
        (
            (player_cardinal, player_diagonal),
            (home_cardinal, home_diagonal),
            (street_cardinal, street_diagonal),
        )
    )
    preview_path = root / "artifacts/character-diagonal-contact-sheet.png"
    print(f"{preview_path.relative_to(root)}  {save_png(contact, preview_path)}")


if __name__ == "__main__":
    main()
