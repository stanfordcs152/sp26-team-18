#!/usr/bin/env python3
"""
Optional supplement: sample images from Deepfake-Eval-2024 (in-the-wild, 2024 social media).

Dataset: https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024
Access is GATED — accept terms on Hugging Face, then:
  huggingface-cli login
  # or set HF_TOKEN in the environment

Citation: Chandra et al., 2025. arXiv:2503.02857.

Mapping (typical real/fake labels in the image subset):
  real  -> allow
  fake  -> unallow

Usage:
  python evals/scripts/setup_deepfake_eval_2024.py --per-set 25
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).resolve().parent
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from lib.manifest_io import (  # noqa: E402
    build_row,
    filter_out_prefix,
    read_manifest,
    remove_images_with_prefix,
    write_manifest,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
ALLOW_DIR = REPO_ROOT / "evals" / "allow"
UNALLOW_DIR = REPO_ROOT / "evals" / "unallow"
ID_PREFIX = "dfe2024-"

CITATION = (
    "Chandra et al., 2025, Deepfake-Eval-2024 (nuriachandra/Deepfake-Eval-2024), "
    "arXiv:2503.02857, CC-BY-SA-4.0"
)


def normalize_label(raw: str) -> str | None:
    lower = str(raw).lower()
    if lower in ("real", "authentic", "0", "false"):
        return "real"
    if lower in ("fake", "synthetic", "deepfake", "1", "true"):
        return "fake"
    return None


def reservoir_by_label(stream, k: int, want: str, label_key: str, rng: random.Random) -> list[dict]:
    reservoir: list[dict] = []
    seen = 0
    for row in stream:
        row_dict = dict(row)
        norm = normalize_label(row_dict.get(label_key, ""))
        if norm != want:
            continue
        seen += 1
        if len(reservoir) < k:
            reservoir.append(row_dict)
        else:
            j = rng.randint(0, seen - 1)
            if j < k:
                reservoir[j] = row_dict
    if len(reservoir) < k:
        raise RuntimeError(f"Only found {len(reservoir)} '{want}' rows; need {k}")
    return reservoir


def find_image_column(features) -> str | None:
    if hasattr(features, "items"):
        for name, feat in features.items():
            if getattr(feat, "_type", None) == "Image" or "image" in name.lower():
                return name
    return None


def find_label_column(features) -> str | None:
    for candidate in ("label", "labels", "is_fake", "fake", "target"):
        if hasattr(features, "get") and candidate in features:
            return candidate
    if hasattr(features, "items"):
        for name in features:
            if "label" in name.lower() or name in ("is_fake", "fake"):
                return name
    return "label"


def save_image(row: dict, image_key: str, dest: Path) -> None:
    image = row[image_key]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if hasattr(image, "save"):
        image.save(dest, format="JPEG", quality=90)
        return
    raise TypeError(f"Cannot save image column '{image_key}' of type {type(image)}")


def run(args: argparse.Namespace) -> None:
    if args.dry_run:
        print("Would sample nuriachandra/Deepfake-Eval-2024 (gated) into evals/allow + evals/unallow")
        print(f"  per-set={args.per_set}, split={args.split}")
        return

    from datasets import load_dataset

    print("Loading Deepfake-Eval-2024 (requires Hugging Face access approval)...")
    try:
        ds = load_dataset(
            "nuriachandra/Deepfake-Eval-2024",
            split=args.split,
            streaming=True,
        )
    except Exception as exc:
        print(
            "\nFailed to load dataset. Ensure you:\n"
            "  1. Requested access at https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024\n"
            "  2. Ran `huggingface-cli login` or set HF_TOKEN\n",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    # Introspect first row for column names when possible
    features = ds.features
    image_key = find_image_column(features) or "image"
    label_key = find_label_column(features) or "label"

    rng = random.Random(args.seed)
    if args.clear:
        remove_images_with_prefix(ALLOW_DIR / "images", ID_PREFIX)
        remove_images_with_prefix(UNALLOW_DIR / "images", ID_PREFIX)

    reals = reservoir_by_label(ds, args.per_set, "real", label_key, rng)
    ds2 = load_dataset(
        "nuriachandra/Deepfake-Eval-2024",
        split=args.split,
        streaming=True,
    )
    fakes = reservoir_by_label(ds2, args.per_set, "fake", label_key, rng)

    source = f"{CITATION}; split={args.split}"
    allow_rows: list[dict] = []
    unallow_rows: list[dict] = []

    for i, row in enumerate(reals, start=1):
        row_id = f"{ID_PREFIX}allow-{i:04d}"
        rel = f"images/{row_id}.jpg"
        save_image(row, image_key, ALLOW_DIR / "images" / f"{row_id}.jpg")
        allow_rows.append(
            build_row(
                row_id=row_id,
                rel_path=rel,
                label="allow",
                source=source,
                notes=f"hf_label=real; {label_key}={row.get(label_key)}",
            )
        )

    for i, row in enumerate(fakes, start=1):
        row_id = f"{ID_PREFIX}unallow-{i:04d}"
        rel = f"images/{row_id}.jpg"
        save_image(row, image_key, UNALLOW_DIR / "images" / f"{row_id}.jpg")
        unallow_rows.append(
            build_row(
                row_id=row_id,
                rel_path=rel,
                label="unallow",
                source=source,
                notes=f"hf_label=fake; {label_key}={row.get(label_key)}",
            )
        )

    merge = lambda path, new: write_manifest(
        path, filter_out_prefix(read_manifest(path), ID_PREFIX) + new
    )
    merge(ALLOW_DIR / "manifest.jsonl", allow_rows)
    merge(UNALLOW_DIR / "manifest.jsonl", unallow_rows)

    print(f"Wrote {len(allow_rows)} allow + {len(unallow_rows)} unallow from Deepfake-Eval-2024")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-set", type=int, default=25)
    parser.add_argument("--split", default="train")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--clear", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    run(parser.parse_args())


if __name__ == "__main__":
    main()
