#!/usr/bin/env python3
"""Batch predict with fine-tuned ResNet18. Stdin JSON: [{id, path}, ...]."""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MODEL_PATH = REPO / "evals/models/image-resnet18/model.pt"


def main() -> None:
    try:
        import torch
        from PIL import Image
        from torchvision import models, transforms
    except ImportError as exc:
        raise SystemExit("pip install -r evals/scripts/requirements.txt") from exc

    if not MODEL_PATH.is_file():
        raise SystemExit(
            f"Model not found at {MODEL_PATH}. Run: npm run eval:train-ml"
        )

    payload = json.load(sys.stdin)
    items = payload if isinstance(payload, list) else payload.get("items", [])

    checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=False)
    mean = checkpoint["mean"]
    std = checkpoint["std"]
    positive_idx = int(checkpoint.get("positive_class_index", 1))

    transform = transforms.Compose(
        [
            transforms.Resize(256),
            transforms.CenterCrop(int(checkpoint.get("image_size", 224))),
            transforms.ToTensor(),
            transforms.Normalize(mean, std),
        ]
    )

    model = models.resnet18(weights=None)
    model.fc = torch.nn.Linear(model.fc.in_features, 2)
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)

    predictions = []
    with torch.no_grad():
        for item in items:
            path = Path(item["path"])
            with Image.open(path) as img:
                tensor = transform(img.convert("RGB")).unsqueeze(0).to(device)
            logits = model(tensor)
            proba = torch.softmax(logits, dim=1).cpu().numpy()[0]
            p_unallow = float(proba[positive_idx])
            p_allow = float(proba[1 - positive_idx])
            predictions.append(
                {
                    "id": item["id"],
                    "flagged": p_unallow >= 0.5,
                    "probaUnallow": p_unallow,
                    "probaAllow": p_allow,
                }
            )

    json.dump({"predictions": predictions}, sys.stdout)


if __name__ == "__main__":
    main()
