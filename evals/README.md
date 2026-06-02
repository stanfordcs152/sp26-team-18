# Classifier evaluation (Milestone 3 — Part 2)

TruthGuard evaluates **AI-generated political disinformation in images**. Eval assets live under `evals/`.

## Dataset

| Source | Role |
|--------|------|
| **[OpenFake](https://huggingface.co/datasets/ComplexDataLab/OpenFake)** | Primary — 100 real (`allow/`) + 100 synthetic (`unallow/`) |
| Deepfake-Eval-2024 | Optional supplement (`npm run eval:setup-deepfake-eval`) |

| Dataset label | Eval folder | Meaning |
|---------------|-------------|---------|
| `real` | `allow/` | Should **not** be flagged |
| `fake` | `unallow/` | Should be **caught** |

Citations: [`evals/datasets/SOURCES.md`](datasets/SOURCES.md).

## Layout

```
evals/
  config.ts              # thresholds (hybrid + ml_hybrid bands)
  run.ts                 # eval runner
  lib/                   # classifiers, metrics, ML bridge
  models/image-resnet18/ # ResNet18 checkpoint + split.json (model.pt gitignored)
  allow/  unallow/       # manifest.jsonl + images/
  scripts/               # setup + train_image_classifier.py
  results/
    openfake-benchmark.json           # summary table (poster numbers)
    *-openfake-200.json               # full per-image results (200-image approaches)
    ml-openfake-holdout-40.json       # ML holdout eval
    ml-hybrid-openfake-holdout-40.json
```

## Setup

```bash
pip install -r evals/scripts/requirements.txt
huggingface-cli login   # recommended on Windows
npm run eval:setup-openfake
```

Add to **`.env.local`** (loaded via `tsx --env-file=.env.local`):

**Paid (`npm run eval`):** `OPENAI_API_KEY`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

**Free (`npm run eval:free`):** `ANTHROPIC_API_KEY` — Claude for `llm`, `hybrid`, `ml_hybrid` escalations

## Approaches (six total)

| ID | What it is | Eval set | Flag rule |
|----|------------|----------|-----------|
| `heuristic` | C2PA + Rekognition + rule risk | 200 | Rule-based risk |
| `ml` | Fine-tuned **ResNet18** on pixels | **40 holdout** | `probaUnallow ≥ 0.5` |
| `ml_hybrid` | ResNet18 → OpenAI on uncertain band | **40 holdout** | ML or `visionShouldFlag` (not production) |
| `llm` | OpenAI Vision every image | 200 | `visionShouldFlag` |
| `hybrid` | Heuristic → OpenAI on uncertain cases | 200 | Heuristic or `visionShouldFlag` |
| `production` | **Exact upload pipeline** | 200 | `shouldFlagAnalysis` |

**Milestone mapping:** traditional = `heuristic` + `ml`; LLM = `llm`; hybrid = `hybrid`. `ml_hybrid` and `production` are extra benchmarks.

### Train ML (one time)

```bash
npm run eval:train-ml
```

- 80/20 stratified split (160 train / 40 test, seed 42)
- Saves `evals/models/image-resnet18/split.json` + `model.pt` (local only, gitignored)

### Run evals

```bash
npm run eval -- --dry-run
npm run eval -- --concurrency 1
npm run eval -- --approach ml_hybrid
npm run eval:production
npm run eval:free
```

New runs write timestamped JSON under `evals/results/` (gitignored). Committed poster numbers are in **`openfake-benchmark.json`**.

Tune thresholds in `evals/config.ts` (`uncertainRiskLow/High` for `hybrid`, `mlUncertainLow/High` for `ml_hybrid`).

## Benchmark results (OpenFake, paid mode)

Committed summary: [`evals/results/openfake-benchmark.json`](results/openfake-benchmark.json)

| Approach | N | Precision | Recall | F1 | LLM calls | USD / 1k |
|----------|--:|----------:|-------:|---:|----------:|---------:|
| `heuristic` | 200 | 0.471 | 0.160 | 0.239 | 0 | 1.00 |
| `ml` | 40† | 0.706 | 0.600 | 0.649 | 0 | 0.00 |
| `ml_hybrid` | 40† | 0.769 | 0.500 | 0.606 | 10 | 3.25 |
| `llm` | 200 | 1.000 | 0.030 | 0.058 | 200 | 13.00 |
| `hybrid` | 200 | 1.000 | 0.030 | 0.058 | 200 | 13.00 |
| `production` | 200 | 1.000 | 0.470 | 0.639 | 200 | 13.00 |

† **40-image held-out test** — not comparable sample size to 200-image rows; see `ml-openfake-holdout-40.json`.

**How to read this:**

- **`production`** is what users hit on upload — best recall among high-precision options on full 200.
- **`ml`** is the honest pixel classifier on held-out data; best F1 among ML approaches on that split.
- **`llm` / `hybrid`** optimize political disinfo (`visionShouldFlag`), not OpenFake’s synthetic/real label — low recall here is expected.
- **`ml_hybrid`** escalates 25% of holdout images to Vision; higher precision, lower recall than `ml` alone on this split.

Per-image outputs: `heuristic-openfake-200.json`, `llm-openfake-200.json`, `hybrid-openfake-200.json`, `production-openfake-200.json`, `ml-openfake-holdout-40.json`, `ml-hybrid-openfake-holdout-40.json`.

## Manifest format

```json
{"id":"openfake-core-validation-allow-0001","path":"images/....jpg","label":"allow","source":"...","notes":"model=pexels; type=real"}
```

One JSON object per line. `path` is relative to the manifest file.
