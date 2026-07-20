from __future__ import annotations

import argparse
import csv
import hashlib
import math
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Slice a pixel-art spritesheet into labeled frames and contact sheets."
    )
    parser.add_argument("sheet", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--frame-width", type=int, required=True)
    parser.add_argument("--frame-height", type=int, required=True)
    parser.add_argument("--margin", type=int, default=0)
    parser.add_argument("--spacing", type=int, default=0)
    parser.add_argument("--columns-per-page", type=int, default=12)
    parser.add_argument("--rows-per-page", type=int, default=10)
    parser.add_argument("--preview-scale", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.output.exists():
        shutil.rmtree(args.output)
    frames_directory = args.output / "frames"
    contact_directory = args.output / "contact-sheets"
    frames_directory.mkdir(parents=True)
    contact_directory.mkdir(parents=True)

    sheet = Image.open(args.sheet).convert("RGBA")
    width_numerator = sheet.width - args.margin * 2 + args.spacing
    height_numerator = sheet.height - args.margin * 2 + args.spacing
    width_denominator = args.frame_width + args.spacing
    height_denominator = args.frame_height + args.spacing

    if width_numerator <= 0 or height_numerator <= 0:
        raise ValueError("Margins leave no usable spritesheet area")
    if width_numerator % width_denominator or height_numerator % height_denominator:
        raise ValueError(
            "Spritesheet dimensions do not divide into whole frames with the supplied geometry"
        )

    columns = width_numerator // width_denominator
    rows = height_numerator // height_denominator
    frame_count = columns * rows
    frame_paths: list[Path] = []

    manifest_path = args.output / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as handle:
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

        for frame_index in range(frame_count):
            column = frame_index % columns
            row = frame_index // columns
            source_x = args.margin + column * width_denominator
            source_y = args.margin + row * height_denominator
            frame = sheet.crop(
                (
                    source_x,
                    source_y,
                    source_x + args.frame_width,
                    source_y + args.frame_height,
                )
            )
            frame_path = frames_directory / f"frame-{frame_index:04d}.png"
            frame.save(frame_path)
            frame_paths.append(frame_path)
            writer.writerow(
                [
                    frame_index,
                    frame_path.name,
                    column,
                    row,
                    source_x,
                    source_y,
                    args.frame_width,
                    args.frame_height,
                    sha256(frame_path),
                ]
            )

    page_capacity = args.columns_per_page * args.rows_per_page
    preview_width = args.frame_width * args.preview_scale
    preview_height = args.frame_height * args.preview_scale
    cell_width = max(preview_width + 8, 72)
    cell_height = preview_height + 22
    font = ImageFont.load_default()

    for page_number, start in enumerate(range(0, frame_count, page_capacity), start=1):
        page_frames = frame_paths[start : start + page_capacity]
        contact = Image.new(
            "RGB",
            (args.columns_per_page * cell_width, args.rows_per_page * cell_height),
            "#202020",
        )
        draw = ImageDraw.Draw(contact)

        for local_index, frame_path in enumerate(page_frames):
            frame_index = start + local_index
            column = local_index % args.columns_per_page
            row = local_index // args.columns_per_page
            x = column * cell_width
            y = row * cell_height
            frame = Image.open(frame_path).convert("RGBA").resize(
                (preview_width, preview_height), Image.Resampling.NEAREST
            )
            background = Image.new("RGB", frame.size, "#4a4a4a")
            background.paste(frame, mask=frame.getchannel("A"))
            contact.paste(background, (x + 4, y + 4))
            draw.text((x + 4, y + preview_height + 8), f"{frame_index:04d}", fill="white", font=font)

        contact.save(contact_directory / f"contact-{page_number:02d}.png")

    summary = (
        f"sheet={args.sheet}\n"
        f"sheet_size={sheet.width}x{sheet.height}\n"
        f"frame_size={args.frame_width}x{args.frame_height}\n"
        f"margin={args.margin}\n"
        f"spacing={args.spacing}\n"
        f"grid={columns}x{rows}\n"
        f"frame_count={frame_count}\n"
        f"contact_sheets={math.ceil(frame_count / page_capacity)}\n"
    )
    (args.output / "SUMMARY.txt").write_text(summary, encoding="utf-8")
    print(summary, end="")


if __name__ == "__main__":
    main()
