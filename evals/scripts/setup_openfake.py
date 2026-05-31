#!/usr/bin/env python3
"""
Sample politically themed images from OpenFake into TruthGuard eval sets.

Mapping (aligned with OpenFake real vs synthetic labels):
  - label=real  -> evals/allow   (authentic media; should NOT be flagged as synthetic)
  - label=fake  -> evals/unallow (synthetic media; should be caught)

Citation: Livernoche et al., 2025. OpenFake. arXiv:2509.09495.
Dataset: https://huggingface.co/datasets/ComplexDataLab/OpenFake

Usage:
  pip install -r evals/scripts/requirements.txt
  python evals/scripts/setup_openfake.py --per-set 100
  python evals/scripts/setup_openfake.py --per-set 100 --reddit-per-set 25
  python evals/scripts/setup_openfake.py --dry-run

Tip: set HF_TOKEN (huggingface-cli login) for stable streaming on Windows.
"""

from __future__ import annotations

import argparse
import random
import sys
import time
from io import BytesIO
from pathlib import Path
from typing import Iterator

# Allow importing manifest_io when run from repo root
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
ALLOW_MANIFEST = ALLOW_DIR / "manifest.jsonl"
UNALLOW_MANIFEST = UNALLOW_DIR / "manifest.jsonl"
ID_PREFIX = "openfake-"

OPENFAKE_CITATION = (
    "Livernoche et al., 2025, OpenFake (ComplexDataLab/OpenFake), "
    "arXiv:2509.09495, CC-BY-SA-4.0"
)


def load_openfake_stream(config: str, split: str):
    """Stream with decode=False so corrupt rows can be skipped without crashing a batch."""
    from datasets import Image as ImageFeature
    from datasets import load_dataset

    ds = load_dataset(
        "ComplexDataLab/OpenFake",
        config,
        split=split,
        streaming=True,
    )
    return ds.cast_column("image", ImageFeature(decode=False))


def pil_from_row_image(image_field) -> "object | None":
    """Decode a datasets Image(decode=False) value to RGB PIL, or None if unusable."""
    from PIL import Image

    if image_field is None:
        return None

    if hasattr(image_field, "save"):
        return image_field.convert("RGB")

    if isinstance(image_field, dict):
        raw = image_field.get("bytes")
        if raw:
            pil = Image.open(BytesIO(raw))
            pil.load()
            return pil.convert("RGB")
        path = image_field.get("path")
        if path:
            pil = Image.open(path)
            pil.load()
            return pil.convert("RGB")

    return None


def normalize_row(row) -> dict | None:
    """Return row dict with a decoded PIL image, or None to skip."""
    try:
        row_dict = dict(row)
    except Exception:
        return None

    pil = pil_from_row_image(row_dict.get("image"))
    if pil is None:
        return None

    row_dict["image"] = pil
    return row_dict


def safe_next(stream: Iterator, retries: int = 8) -> object | None:
    """Return next row, retrying on transient Hub / decode disconnects."""
    for attempt in range(retries):
        try:
            return next(stream)
        except StopIteration:
            return None
        except Exception as exc:
            if attempt == retries - 1:
                print(f"  stream read failed after {retries} tries: {exc}", file=sys.stderr)
                return None
            wait = min(30, 2 ** attempt)
            print(f"  stream error ({exc!r}); retry in {wait}s...", file=sys.stderr)
            time.sleep(wait)
    return None


def reservoir_sample_both(
    stream: Iterator,
    k_real: int,
    k_fake: int,
    rng: random.Random,
    *,
    max_skip: int = 5000,
) -> tuple[list[dict], list[dict], int]:
    """
    One pass over the stream: reservoir-sample real and fake rows.
    Skips corrupt / undecodable images instead of aborting.
    """
    reservoir_real: list[dict] = []
    reservoir_fake: list[dict] = []
    seen_real = 0
    seen_fake = 0
    skipped = 0

    while len(reservoir_real) < k_real or len(reservoir_fake) < k_fake:
        raw = safe_next(stream)
        if raw is None:
            break

        row_dict = normalize_row(raw)
        if row_dict is None:
            skipped += 1
            if skipped % 100 == 0:
                print(f"  skipped {skipped} rows (bad image / decode)...")
            if skipped >= max_skip:
                break
            continue

        label = row_dict.get("label")
        if label == "real":
            seen_real += 1
            if len(reservoir_real) < k_real:
                reservoir_real.append(row_dict)
            else:
                j = rng.randint(0, seen_real - 1)
                if j < k_real:
                    reservoir_real[j] = row_dict
        elif label == "fake":
            seen_fake += 1
            if len(reservoir_fake) < k_fake:
                reservoir_fake.append(row_dict)
            else:
                j = rng.randint(0, seen_fake - 1)
                if j < k_fake:
                    reservoir_fake[j] = row_dict

    if len(reservoir_real) < k_real or len(reservoir_fake) < k_fake:
        raise RuntimeError(
            f"Could only collect real={len(reservoir_real)}/{k_real}, "
            f"fake={len(reservoir_fake)}/{k_fake} (skipped {skipped} bad rows). "
            "Try: huggingface-cli login (HF_TOKEN), --split train, or run again."
        )

    if skipped:
        print(f"  skipped {skipped} undecodable / corrupt rows total")
    return reservoir_real, reservoir_fake, skipped


def format_notes(row: dict) -> str:
    parts = []
    for key in ("model", "type", "release_date"):
        val = row.get(key)
        if val:
            parts.append(f"{key}={val}")
    prompt = row.get("prompt") or ""
    if prompt:
        short = prompt if len(prompt) <= 120 else prompt[:117] + "..."
        parts.append(f'prompt="{short}"')
    return "; ".join(parts)


def save_image(row: dict, dest: Path) -> None:
    image = row["image"]
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not hasattr(image, "save"):
        raise TypeError(f"Unexpected image type: {type(image)}")
    image.save(dest, format="JPEG", quality=90)


def write_samples(
    *,
    samples: list[dict],
    eval_label: str,
    images_dir: Path,
    id_suffix: str,
    source: str,
    start_index: int,
) -> tuple[list[dict], int]:
    new_rows: list[dict] = []
    idx = start_index

    for row in samples:
        idx += 1
        row_id = f"{ID_PREFIX}{id_suffix}-{eval_label}-{idx:04d}"
        filename = f"{row_id}.jpg"
        rel_path = f"images/{filename}"
        save_image(row, images_dir / filename)
        new_rows.append(
            build_row(
                row_id=row_id,
                rel_path=rel_path,
                label=eval_label,
                source=source,
                notes=format_notes(row),
            )
        )

    return new_rows, idx


def sample_from_config(
    *,
    config: str,
    split: str,
    per_set: int,
    rng: random.Random,
    max_skip: int,
) -> tuple[list[dict], list[dict]]:
    stream = iter(load_openfake_stream(config, split))
    reals, fakes, _ = reservoir_sample_both(
        stream, per_set, per_set, rng, max_skip=max_skip
    )
    return reals, fakes


def clear_openfake_artifacts() -> None:
    remove_images_with_prefix(ALLOW_DIR / "images", ID_PREFIX)
    remove_images_with_prefix(UNALLOW_DIR / "images", ID_PREFIX)


def filter_demo_rows(rows: list[dict]) -> list[dict]:
    return [
        r
        for r in rows
        if not str(r.get("id", "")).startswith(("allow-demo-", "unallow-demo-"))
    ]


def merge_manifest(manifest_path: Path, new_rows: list[dict]) -> None:
    existing = filter_out_prefix(read_manifest(manifest_path), ID_PREFIX)
    existing = filter_demo_rows(existing)
    write_manifest(manifest_path, existing + new_rows)


def run(args: argparse.Namespace) -> None:
    rng = random.Random(args.seed)

    if args.dry_run:
        print("Dry run — would download from ComplexDataLab/OpenFake with:")
        print(f"  core split={args.split}, per-set={args.per_set}")
        if args.reddit_per_set > 0:
            print(f"  reddit test, per-set={args.reddit_per_set}")
        print(f"  -> {ALLOW_DIR / 'images'} (allow / real)")
        print(f"  -> {UNALLOW_DIR / 'images'} (unallow / fake)")
        return

    if not args.no_hf_login_hint and not (
        __import__("os").environ.get("HF_TOKEN")
        or __import__("os").environ.get("HUGGING_FACE_HUB_TOKEN")
    ):
        print(
            "Note: no HF_TOKEN set — run `huggingface-cli login` for fewer disconnects.\n"
        )

    if args.clear:
        clear_openfake_artifacts()

    allow_idx = 0
    unallow_idx = 0
    all_allow_rows: list[dict] = []
    all_unallow_rows: list[dict] = []

    print(f"Sampling OpenFake core/{args.split} ({args.per_set} per class)...")
    reals, fakes = sample_from_config(
        config="core",
        split=args.split,
        per_set=args.per_set,
        rng=rng,
        max_skip=args.max_skip,
    )

    source = f"{OPENFAKE_CITATION}; config=core; split={args.split}"
    allow_rows, allow_idx = write_samples(
        samples=reals,
        eval_label="allow",
        images_dir=ALLOW_DIR / "images",
        id_suffix=f"core-{args.split}",
        source=source,
        start_index=allow_idx,
    )
    unallow_rows, unallow_idx = write_samples(
        samples=fakes,
        eval_label="unallow",
        images_dir=UNALLOW_DIR / "images",
        id_suffix=f"core-{args.split}",
        source=source,
        start_index=unallow_idx,
    )
    all_allow_rows.extend(allow_rows)
    all_unallow_rows.extend(unallow_rows)
    print(f"  wrote {len(allow_rows)} allow + {len(unallow_rows)} unallow (core)")

    if args.reddit_per_set > 0:
        print(f"Sampling OpenFake reddit/test ({args.reddit_per_set} per class)...")
        reals, fakes = sample_from_config(
            config="reddit",
            split="test",
            per_set=args.reddit_per_set,
            rng=rng,
            max_skip=args.max_skip,
        )
        reddit_source = f"{OPENFAKE_CITATION}; config=reddit; split=test"
        allow_rows, allow_idx = write_samples(
            samples=reals,
            eval_label="allow",
            images_dir=ALLOW_DIR / "images",
            id_suffix="reddit-test",
            source=reddit_source,
            start_index=allow_idx,
        )
        unallow_rows, unallow_idx = write_samples(
            samples=fakes,
            eval_label="unallow",
            images_dir=UNALLOW_DIR / "images",
            id_suffix="reddit-test",
            source=reddit_source,
            start_index=unallow_idx,
        )
        all_allow_rows.extend(allow_rows)
        all_unallow_rows.extend(unallow_rows)
        print(f"  wrote {len(allow_rows)} allow + {len(unallow_rows)} unallow (reddit)")

    merge_manifest(ALLOW_MANIFEST, all_allow_rows)
    merge_manifest(UNALLOW_MANIFEST, all_unallow_rows)

    allow_total = len(read_manifest(ALLOW_MANIFEST))
    unallow_total = len(read_manifest(UNALLOW_MANIFEST))
    print(f"\nDone. Manifest counts: allow={allow_total}, unallow={unallow_total}")
    print("Run: npm run eval -- --dry-run")


def main() -> None:
    parser = argparse.ArgumentParser(description="Sample OpenFake into TruthGuard eval sets.")
    parser.add_argument("--per-set", type=int, default=100)
    parser.add_argument(
        "--split",
        default="validation",
        choices=["train", "validation", "test"],
    )
    parser.add_argument("--reddit-per-set", type=int, default=0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--clear", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--max-skip",
        type=int,
        default=5000,
        help="Abort if more than this many corrupt rows are skipped (default: 5000).",
    )
    parser.add_argument(
        "--no-hf-login-hint",
        action="store_true",
        help="Suppress HF_TOKEN reminder.",
    )
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
