#!/usr/bin/env python3
"""Verify approved diagonal character sheets against their deterministic builder."""

from __future__ import annotations

import hashlib
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts/build-character-diagonals.py"
KENNEY_ROOT = Path("public/assets/third-party/kenney")
OUTPUTS = {
    "player/diagonal.png": "402d12e53f0620cb7079ac51e134d398af4824267133e899b12af541535effe9",
    "home-npc/diagonal.png": "a54cd5b5d2398f6032c26d4284b0b7f612c838a48cc90ebda57c8adfddffd759",
    "street-npc/diagonal.png": "9f7f352a5627f3b5f6166f8d95685c4ad308f0941b72a670cd410a7f34df9164",
}
PLAYER_CARDINAL_FILES = (
    "tile_0266.png",
    "tile_0267.png",
    "tile_0268.png",
    "tile_0269.png",
    "tile_0293.png",
    "tile_0294.png",
    "tile_0295.png",
    "tile_0296.png",
    "tile_0320.png",
    "tile_0321.png",
    "tile_0322.png",
    "tile_0323.png",
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def copy_builder_inputs(validation_root: Path) -> None:
    source = ROOT / KENNEY_ROOT
    target = validation_root / KENNEY_ROOT
    for filename in PLAYER_CARDINAL_FILES:
        destination = target / "player" / filename
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / "player" / filename, destination)
    for profile in ("home-npc", "street-npc"):
        destination = target / profile / "character.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / profile / "character.png", destination)


def verify_png(path: Path) -> None:
    with Image.open(path) as probe:
        probe.verify()
    with Image.open(path) as image:
        image.load()
        if image.mode != "RGBA":
            raise AssertionError(f"{path}: expected RGBA, got {image.mode}")
        if image.size != (48, 64):
            raise AssertionError(f"{path}: expected 48x64, got {image.size}")
        for row in range(4):
            for column in range(3):
                frame = image.crop((column * 16, row * 16, (column + 1) * 16, (row + 1) * 16))
                if frame.getbbox() is None:
                    raise AssertionError(f"{path}: empty frame at row {row}, column {column}")


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="nestledburrow-diagonal-audit-") as temporary:
        validation_root = Path(temporary)
        copy_builder_inputs(validation_root)
        subprocess.run(
            [sys.executable, str(BUILDER), "--root", str(validation_root)],
            cwd=ROOT,
            check=True,
        )

        for relative_path, expected_hash in OUTPUTS.items():
            committed = ROOT / KENNEY_ROOT / relative_path
            generated = validation_root / KENNEY_ROOT / relative_path
            verify_png(committed)
            verify_png(generated)
            committed_hash = sha256(committed)
            generated_hash = sha256(generated)
            if committed_hash != expected_hash:
                raise AssertionError(
                    f"{relative_path}: committed SHA-256 {committed_hash} != approved {expected_hash}"
                )
            if generated_hash != expected_hash:
                raise AssertionError(
                    f"{relative_path}: generated SHA-256 {generated_hash} != approved {expected_hash}"
                )
            if committed.read_bytes() != generated.read_bytes():
                raise AssertionError(f"{relative_path}: committed bytes differ from deterministic builder output")
            print(f"PASS {relative_path}: sha256:{expected_hash}")

        source_contact = validation_root / "artifacts/character-diagonal-contact-sheet.png"
        target_contact = ROOT / "artifacts/character-diagonal-contact-sheet.png"
        target_contact.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_contact, target_contact)
        print(f"Character diagonal audit passed; contact sheet: {target_contact.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
