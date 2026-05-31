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
"""

from __future__ import annotations

import argparse
import random
import sys
from pathlib import Path

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


def reservoir_sample(stream, k: int, label_value: str, rng: random.Random) -> list[dict]:
    """Reservoir sample rows where row['label'] == label_value from a streaming dataset."""
    reservoir: list[dict] = []
    seen = 0

    for row in stream:
        row_dict = dict(row)
        if row_dict.get("label") != label_value:
            continue
        seen += 1
        if len(reservoir) < k:
            reservoir.append(row_dict)
        else:
            j = rng.randint(0, seen - 1)
            if j < k:
                reservoir[j] = row_dict

    if len(reservoir) < k:
        raise RuntimeError(
            f"Stream ended with only {len(reservoir)} '{label_value}' examples; need {k}. "
            "Try a larger split (e.g. train) or lower --per-set."
        )
    return reservoir


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
    if hasattr(image, "save"):
        image.save(dest, format="JPEG", quality=90)
    else:
        raise TypeError(f"Unexpected image type: {type(image)}")


def write_samples(
    *,
    samples: list[dict],
    eval_label: str,
    images_dir: Path,
    manifest_path: Path,
    id_suffix: str,
    source: str,
    start_index: int,
) -> tuple[list[dict], int]:
    """Write images and return new manifest rows. eval_label is allow|unallow."""
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


def load_openfake_stream(config: str, split: str):
    from datasets import load_dataset

    return load_dataset(
        "ComplexDataLab/OpenFake",
        config,
        split=split,
        streaming=True,
    )


def sample_from_config(
    *,
    config: str,
    split: str,
    per_set: int,
    rng: random.Random,
) -> tuple[list[dict], list[dict]]:
    stream = load_openfake_stream(config, split)
    reals = reservoir_sample(stream, per_set, "real", rng)
    stream = load_openfake_stream(config, split)
    fakes = reservoir_sample(stream, per_set, "fake", rng)
    return reals, fakes


def clear_openfake_artifacts() -> None:
    remove_images_with_prefix(ALLOW_DIR / "images", ID_PREFIX)
    remove_images_with_prefix(UNALLOW_DIR / "images", ID_PREFIX)


def filter_demo_rows(rows: list[dict]) -> list[dict]:
    """Drop placeholder demo rows from initial scaffold."""
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
    )

    source = f"{OPENFAKE_CITATION}; config=core; split={args.split}"
    allow_rows, allow_idx = write_samples(
        samples=reals,
        eval_label="allow",
        images_dir=ALLOW_DIR / "images",
        manifest_path=ALLOW_MANIFEST,
        id_suffix=f"core-{args.split}",
        source=source,
        start_index=allow_idx,
    )
    unallow_rows, unallow_idx = write_samples(
        samples=fakes,
        eval_label="unallow",
        images_dir=UNALLOW_DIR / "images",
        manifest_path=UNALLOW_MANIFEST,
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
        )
        reddit_source = f"{OPENFAKE_CITATION}; config=reddit; split=test"
        allow_rows, allow_idx = write_samples(
            samples=reals,
            eval_label="allow",
            images_dir=ALLOW_DIR / "images",
            manifest_path=ALLOW_MANIFEST,
            id_suffix="reddit-test",
            source=reddit_source,
            start_index=allow_idx,
        )
        unallow_rows, unallow_idx = write_samples(
            samples=fakes,
            eval_label="unallow",
            images_dir=UNALLOW_DIR / "images",
            manifest_path=UNALLOW_MANIFEST,
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
    parser.add_argument(
        "--per-set",
        type=int,
        default=100,
        help="Number of real (allow) and fake (unallow) images from core config (default: 100).",
    )
    parser.add_argument(
        "--split",
        default="validation",
        choices=["train", "validation", "test"],
        help="OpenFake core split to stream (default: validation).",
    )
    parser.add_argument(
        "--reddit-per-set",
        type=int,
        default=0,
        help="Additional per-class samples from reddit/test in-the-wild config (default: 0).",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility.")
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Remove prior openfake-* images before downloading.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print plan without downloading.",
    )
    args = parser.parse_args()
    run(args)


if __name__ == "__main__":
    main()
