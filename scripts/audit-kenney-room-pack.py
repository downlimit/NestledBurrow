from __future__ import annotations

import csv
import hashlib
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "audit-output"
SOURCE_COMMIT = "c202320f7b8d4620f19707bf41503c79a347ded4"
SOURCE_PATH = "tasks/pixel-room/source/kenney_roguelike-rpg-pack.zip"
PAGE_SIZE = 120
COLUMNS = 12
CELL_WIDTH = 72
CELL_HEIGHT = 82
PREVIEW_SCALE = 4


def natural_key(path: Path) -> tuple:
    stem = path.stem
    parts: list[object] = []
    current = ""
    numeric = False
    for char in stem:
        if char.isdigit() != numeric and current:
            parts.append(int(current) if numeric else current)
            current = ""
        numeric = char.isdigit()
        current += char
    if current:
        parts.append(int(current) if numeric else current)
    return (*parts, path.as_posix())


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    with tempfile.TemporaryDirectory() as temporary_directory:
        temp = Path(temporary_directory)
        archive = temp / "kenney-pack.zip"
        extracted = temp / "extracted"
        extracted.mkdir()

        with archive.open("wb") as handle:
            subprocess.run(
                ["git", "show", f"{SOURCE_COMMIT}:{SOURCE_PATH}"],
                cwd=ROOT,
                check=True,
                stdout=handle,
            )

        with zipfile.ZipFile(archive) as zip_file:
            zip_file.extractall(extracted)

        png_files = sorted(
            [path for path in extracted.rglob("*.png") if path.is_file()],
            key=natural_key,
        )
        tile_files = [
            path
            for path in png_files
            if path.name.startswith("tile_") and Image.open(path).size == (16, 16)
        ]

        copied_tiles = OUTPUT / "individual-tiles"
        copied_tiles.mkdir()
        for source in tile_files:
            shutil.copy2(source, copied_tiles / source.name)

        metadata_files = [
            path
            for path in extracted.rglob("*")
            if path.is_file() and path.suffix.lower() in {".tsx", ".tmx", ".xml", ".txt"}
        ]
        metadata_output = OUTPUT / "metadata"
        metadata_output.mkdir()
        for source in metadata_files:
            relative_name = "__".join(source.relative_to(extracted).parts)
            shutil.copy2(source, metadata_output / relative_name)

        with (OUTPUT / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(["filename", "source_path", "width", "height", "sha256"])
            for source in tile_files:
                with Image.open(source) as image:
                    width, height = image.size
                writer.writerow(
                    [
                        source.name,
                        source.relative_to(extracted).as_posix(),
                        width,
                        height,
                        file_sha256(source),
                    ]
                )

        font = ImageFont.load_default()
        rows = (PAGE_SIZE + COLUMNS - 1) // COLUMNS
        for page_index, page_start in enumerate(range(0, len(tile_files), PAGE_SIZE), start=1):
            page_tiles = tile_files[page_start : page_start + PAGE_SIZE]
            sheet = Image.new("RGB", (COLUMNS * CELL_WIDTH, rows * CELL_HEIGHT), "#202020")
            draw = ImageDraw.Draw(sheet)
            for index, source in enumerate(page_tiles):
                column = index % COLUMNS
                row = index // COLUMNS
                x = column * CELL_WIDTH
                y = row * CELL_HEIGHT
                with Image.open(source).convert("RGBA") as image:
                    image = image.resize(
                        (image.width * PREVIEW_SCALE, image.height * PREVIEW_SCALE),
                        Image.Resampling.NEAREST,
                    )
                    tile_background = Image.new("RGB", image.size, "#4a4a4a")
                    tile_background.paste(image, mask=image.getchannel("A"))
                    sheet.paste(tile_background, (x + 4, y + 4))
                draw.text((x + 4, y + 70), source.stem.replace("tile_", ""), fill="white", font=font)
            sheet.save(OUTPUT / f"contact-{page_index:02d}.png")

        summary = [
            f"source commit: {SOURCE_COMMIT}",
            f"source path: {SOURCE_PATH}",
            f"all png files: {len(png_files)}",
            f"individual 16x16 tile files: {len(tile_files)}",
            f"contact sheets: {(len(tile_files) + PAGE_SIZE - 1) // PAGE_SIZE}",
        ]
        (OUTPUT / "SUMMARY.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")
        print("\n".join(summary))


if __name__ == "__main__":
    main()
