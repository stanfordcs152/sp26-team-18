#!/usr/bin/env python3
"""
Fine-tune a pretrained ResNet18 on OpenFake eval images (real vs synthetic).

This is a small transfer-learning vision classifier — not metadata TF-IDF.
Uses a fixed 80/20 stratified split (160 train / 40 held-out test, seed 42).
Trains on the 160 only; early-stops on the 40. Saves split.json so eval
runs only on images the model never saw.

Usage (repo root):
  python evals/scripts/train_image_classifier.py
  python evals/scripts/train_image_classifier.py --epochs 15 --dry-run
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ALLOW_MANIFEST = REPO / "evals/allow/manifest.jsonl"
UNALLOW_MANIFEST = REPO / "evals/unallow/manifest.jsonl"
MODEL_DIR = REPO / "evals/models/image-resnet18"


def load_rows(manifest: Path, label: str) -> list[dict]:
    rows = []
    for line in manifest.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        row = json.loads(line)
        if row.get("label") != label:
            raise ValueError(f"{manifest}: expected label {label}")
        rows.append(row)
    return rows


def resolve_image_path(manifest: Path, image_path: str) -> Path:
    return (manifest.parent / image_path).resolve()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    allow = load_rows(ALLOW_MANIFEST, "allow")
    unallow = load_rows(UNALLOW_MANIFEST, "unallow")

    samples: list[tuple[Path, int, str]] = []
    for row in allow:
        samples.append(
            (resolve_image_path(ALLOW_MANIFEST, row["path"]), 0, row["id"])
        )
    for row in unallow:
        samples.append(
            (resolve_image_path(UNALLOW_MANIFEST, row["path"]), 1, row["id"])
        )

    missing = [str(p) for p, _, _ in samples if not p.is_file()]
    if missing:
        raise SystemExit(f"Missing {len(missing)} image(s). First: {missing[0]}")

    print(f"Loaded {len(allow)} allow + {len(unallow)} unallow ({len(samples)} images)")

    if args.dry_run:
        print("Dry run — skipping training.")
        return

    try:
        import torch
        import torch.nn as nn
        from PIL import Image
        from sklearn.metrics import classification_report, f1_score
        from sklearn.model_selection import train_test_split
        from torch.utils.data import DataLoader, Dataset
        from torchvision import models, transforms
    except ImportError as exc:
        raise SystemExit(
            "Missing deps. Run: pip install -r evals/scripts/requirements.txt"
        ) from exc

    random.seed(args.seed)
    torch.manual_seed(args.seed)

    weights = models.ResNet18_Weights.IMAGENET1K_V1
    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)

    train_transform = transforms.Compose(
        [
            transforms.RandomResizedCrop(224, scale=(0.75, 1.0)),
            transforms.RandomHorizontalFlip(),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )

    class ImageDataset(Dataset):
        def __init__(self, items: list[tuple[Path, int, str]], transform):
            self.items = items
            self.transform = transform

        def __len__(self) -> int:
            return len(self.items)

        def __getitem__(self, idx: int):
            path, label, _row_id = self.items[idx]
            with Image.open(path) as img:
                img = img.convert("RGB")
            return self.transform(img), label

    def make_model() -> nn.Module:
        model = models.resnet18(weights=weights)
        model.fc = nn.Linear(model.fc.in_features, 2)
        return model

    def run_epoch(model, loader, optimizer, criterion, device, train: bool):
        if train:
            model.train()
        else:
            model.eval()

        total_loss = 0.0
        preds: list[int] = []
        labels: list[int] = []

        for images, y in loader:
            images = images.to(device)
            y = y.to(device)

            if train:
                optimizer.zero_grad()
                logits = model(images)
                loss = criterion(logits, y)
                loss.backward()
                optimizer.step()
            else:
                with torch.no_grad():
                    logits = model(images)
                    loss = criterion(logits, y)

            total_loss += loss.item() * len(y)
            preds.extend(logits.argmax(dim=1).cpu().tolist())
            labels.extend(y.cpu().tolist())

        avg_loss = total_loss / max(len(labels), 1)
        f1 = f1_score(labels, preds, pos_label=1, zero_division=0)
        return avg_loss, f1

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on {device}")

    labels = [label for _, label, _ in samples]
    train_items, val_items = train_test_split(
        samples, test_size=0.2, random_state=args.seed, stratify=labels
    )
    train_ids = [row_id for _, _, row_id in train_items]
    test_ids = [row_id for _, _, row_id in val_items]

    train_loader = DataLoader(
        ImageDataset(train_items, train_transform),
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
    )
    val_loader = DataLoader(
        ImageDataset(val_items, eval_transform),
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    model = make_model().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=args.lr)

    best_state = None
    best_val_f1 = -1.0
    patience = 5
    stale = 0

    for epoch in range(1, args.epochs + 1):
        train_loss, train_f1 = run_epoch(
            model, train_loader, optimizer, criterion, device, train=True
        )
        val_loss, val_f1 = run_epoch(
            model, val_loader, optimizer, criterion, device, train=False
        )
        print(
            f"Epoch {epoch:02d} | train loss {train_loss:.4f} f1 {train_f1:.3f} "
            f"| val loss {val_loss:.4f} f1 {val_f1:.3f}"
        )

        if val_f1 > best_val_f1:
            best_val_f1 = val_f1
            best_state = {k: v.cpu() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                print(f"Early stop at epoch {epoch}")
                break

    # Validation report from best checkpoint
    model.load_state_dict(best_state)
    model.to(device)
    val_preds: list[int] = []
    val_labels = [label for _, label, _ in val_items]
    model.eval()
    with torch.no_grad():
        for images, y in val_loader:
            images = images.to(device)
            val_preds.extend(model(images).argmax(dim=1).cpu().tolist())

    print("\nHoldout validation (20% stratified split):")
    print(classification_report(val_labels, val_preds, target_names=["allow", "unallow"]))

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    split_path = MODEL_DIR / "split.json"
    split_path.write_text(
        json.dumps(
            {
                "seed": args.seed,
                "testSize": 0.2,
                "trainCount": len(train_items),
                "testCount": len(val_items),
                "trainIds": train_ids,
                "testIds": test_ids,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    model_path = MODEL_DIR / "model.pt"
    torch.save(
        {
            "architecture": "resnet18",
            "state_dict": best_state,
            "classes": ["allow", "unallow"],
            "positive_class_index": 1,
            "image_size": 224,
            "mean": mean,
            "std": std,
            "trainedOnFraction": 0.8,
        },
        model_path,
    )

    report = {
        "model": "resnet18-transfer-learning",
        "features": "image pixels (224x224 RGB)",
        "trainCount": len(train_items),
        "valCount": len(val_items),
        "allowCount": len(allow),
        "unallowCount": len(unallow),
        "holdoutValF1Unallow": float(best_val_f1),
        "device": str(device),
        "epochsRan": epoch,
        "positiveClass": "unallow",
        "note": "Trained on 160 images; npm run eval -- --approach ml scores the 40 held-out test IDs in split.json.",
    }
    (MODEL_DIR / "training-report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )

    print(f"\nWrote {model_path.relative_to(REPO)}")
    print(f"Wrote {split_path.relative_to(REPO)}")
    print(f"Wrote {MODEL_DIR.joinpath('training-report.json').relative_to(REPO)}")


if __name__ == "__main__":
    main()
