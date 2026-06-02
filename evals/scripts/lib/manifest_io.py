"""Shared helpers for writing eval manifest.jsonl files."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator


def read_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue
        rows.append(json.loads(trimmed))
    return rows


def write_manifest(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [json.dumps(row, ensure_ascii=False) for row in rows]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def filter_out_prefix(rows: list[dict[str, Any]], id_prefix: str) -> list[dict[str, Any]]:
    return [r for r in rows if not str(r.get("id", "")).startswith(id_prefix)]


def remove_images_with_prefix(images_dir: Path, filename_prefix: str) -> int:
    if not images_dir.exists():
        return 0
    removed = 0
    for file in images_dir.iterdir():
        if file.is_file() and file.name.startswith(filename_prefix):
            file.unlink()
            removed += 1
    return removed


def build_row(
    *,
    row_id: str,
    rel_path: str,
    label: str,
    source: str,
    notes: str = "",
) -> dict[str, Any]:
    return {
        "id": row_id,
        "path": rel_path,
        "label": label,
        "source": source,
        **({"notes": notes} if notes else {}),
    }
