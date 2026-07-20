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
FRAME_SIZE = 16
SPACING = 1
MARGIN = 0
PAGE_SIZE = 120
COLUMNS = 12
CELL_WIDTH = 72
CELL_HEIGHT = 82
PREVIEW_SCALE = 4


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

        source_sheet = next(extracted.rglob("roguelikeSheet_transparent.png"))
        shutil.copy2(source_sheet, OUTPUT / "roguelikeSheet_transparent.png")

        with Image.open(source_sheet).convert("RGBA") as sheet:
            columns = (sheet.width - MARGIN * 2 + SPACING) // (FRAME_SIZE + SPACING)
            rows = (sheet.height - MARGIN * 2 + SPACING) // (FRAME_SIZE + SPACING)
            assert columns == 57, columns
            assert rows == 31, rows

            tiles_output = OUTPUT / "individual-tiles"
            tiles_output.mkdir()
            tile_files: list[Path] = []
            for row in range(rows):
                for column in range(columns):
                    frame_index = row * columns + column
                    left = MARGIN + column * (FRAME_SIZE + SPACING)
                    top = MARGIN + row * (FRAME_SIZE + SPACING)
                    frame = sheet.crop((left, top, left + FRAME_SIZE, top + FRAME_SIZE))
                    destination = tiles_output / f"tile_{frame_index:04d}.png"
                    frame.save(destination)
                    tile_files.append(destination)

        with (OUTPUT / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle)
            writer.writerow(
                [
                    "frame_index",
                    "filename",
                    "column",
                    "row",
                    "source_x",
                    "source_y",
                    "width",
                    "height",
                    "sha256",
                ]
            )
            for frame_index, tile_file in enumerate(tile_files):
                column = frame_index % columns
                row = frame_index // columns
                writer.writerow(
                    [
                        frame_index,
                        tile_file.name,
                        column,
                        row,
                        MARGIN + column * (FRAME_SIZE + SPACING),
                        MARGIN + row * (FRAME_SIZE + SPACING),
                        FRAME_SIZE,
                        FRAME_SIZE,
                        file_sha256(tile_file),
                    ]
                )

        font = ImageFont.load_default()
        page_rows = (PAGE_SIZE + COLUMNS - 1) // COLUMNS
        for page_index, page_start in enumerate(range(0, len(tile_files), PAGE_SIZE), start=1):
            page_tiles = tile_files[page_start : page_start + PAGE_SIZE]
            contact = Image.new(
                "RGB",
                (COLUMNS * CELL_WIDTH, page_rows * CELL_HEIGHT),
                "#202020",
            )
            draw = ImageDraw.Draw(contact)
            for local_index, source in enumerate(page_tiles):
                frame_index = page_start + local_index
                column = local_index % COLUMNS
                row = local_index // COLUMNS
                x = column * CELL_WIDTH
                y = row * CELL_HEIGHT
                with Image.open(source).convert("RGBA") as image:
                    image = image.resize(
                        (FRAME_SIZE * PREVIEW_SCALE, FRAME_SIZE * PREVIEW_SCALE),
                        Image.Resampling.NEAREST,
                    )
                    checker = Image.new("RGB", image.size, "#4a4a4a")
                    checker.paste(image, mask=image.getchannel("A"))
                    contact.paste(checker, (x + 4, y + 4))
                draw.text((x + 4, y + 70), f"{frame_index:04d}", fill="white", font=font)
            contact.save(OUTPUT / f"contact-{page_index:02d}.png")

        summary = [
            f"source commit: {SOURCE_COMMIT}",
            f"source path: {SOURCE_PATH}",
            f"spritesheet: {source_sheet.relative_to(extracted).as_posix()}",
            f"spritesheet size: {sheet.width}x{sheet.height}",
            f"frame geometry: {FRAME_SIZE}x{FRAME_SIZE}, margin={MARGIN}, spacing={SPACING}",
            f"grid: {columns}x{rows}",
            f"frame count: {len(tile_files)}",
            f"contact sheets: {(len(tile_files) + PAGE_SIZE - 1) // PAGE_SIZE}",
        ]
        (OUTPUT / "SUMMARY.txt").write_text("\n".join(summary) + "\n", encoding="utf-8")
        print("\n".join(summary))


if __name__ == "__main__":
    main()
