# Classifier evaluation (Milestone 3 — Part 2)

TruthGuard evaluates **AI-generated political disinformation in images**. All milestone assets live under `evals/` on branch `eval-classifier`.

## Dataset strategy

| Source | Role | Political focus | Access |
|--------|------|-----------------|--------|
| **[OpenFake](https://huggingface.co/datasets/ComplexDataLab/OpenFake)** | **Primary** — allow + unallow | Built for politically salient real vs synthetic | Hugging Face, open |
| **[Deepfake-Eval-2024](https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024)** | Optional supplement | In-the-wild 2024 social deepfakes | HF gated |
| FaceForensics++ / Celeb-DF | **Not used** | Celebrity face-swaps, not political memes/news | — |

**Label mapping (both primary scripts):**

| Dataset label | Eval set | Meaning for TruthGuard |
|---------------|----------|-------------------------|
| `real` | `allow/` | Authentic media — should **not** be flagged |
| `fake` | `unallow/` | Synthetic media — should be **caught** |

Citations and BibTeX: [`evals/datasets/SOURCES.md`](datasets/SOURCES.md).

## Layout

```
evals/
  config.ts                 # classifier thresholds
  run.ts                    # metrics runner
  lib/                      # classifiers, metrics
  allow/
    manifest.jsonl
    images/                 # populated by setup scripts
  unallow/
    manifest.jsonl
    images/
  scripts/
    setup_openfake.py       # primary downloader
    setup_deepfake_eval_2024.py
    requirements.txt
  datasets/SOURCES.md
  results/                  # timestamped runs gitignored; see production-openfake-200.json
```

## 1. Install Python deps (one time)

```bash
pip install -r evals/scripts/requirements.txt
```

Requires Python 3.10+ and enough disk space for streamed image samples (not the full 3.4 TB corpus).

## 2. Log in to Hugging Face (recommended on Windows)

Unauthenticated streaming often hits rate limits and partial downloads (PIL “cannot identify image file”).

```bash
huggingface-cli login
```

Optional: silence symlink warnings on Windows:

```powershell
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"
```

## 3. Download OpenFake samples

Default: **100 real → allow**, **100 fake → unallow** from `core/validation` (reproducible with `--seed 42`):

```bash
npm run eval:setup-openfake
```

Options:

```bash
# Preview without downloading
npm run eval:setup-openfake -- --dry-run

# Milestone minimum
npm run eval:setup-openfake -- --per-set 100

# Add in-the-wild Reddit test images (25 per class)
npm run eval:setup-openfake -- --per-set 100 --reddit-per-set 25

# Use train split (larger stream) or OOD test split
npm run eval:setup-openfake -- --split train --per-set 100

# Re-download: remove prior openfake-* files first
npm run eval:setup-openfake -- --clear --per-set 100
```

Images are saved as JPEG under `evals/allow/images/` and `evals/unallow/images/`. Manifest rows use ids like `openfake-core-validation-allow-0001` with `source` set to the OpenFake citation.

## 4. Optional: Deepfake-Eval-2024 supplement

1. Request access on [Hugging Face](https://huggingface.co/datasets/nuriachandra/Deepfake-Eval-2024).
2. `huggingface-cli login` (or set `HF_TOKEN`).
3. Run:

```bash
npm run eval:setup-deepfake-eval -- --per-set 25
```

Appends rows prefixed with `dfe2024-` (does not remove OpenFake samples).

## 5. Environment variables

Add to **`.env.local`** at the repo root. The eval runner loads this file automatically (`tsx --env-file=.env.local`).

### Free mode (`npm run eval:free`) — Claude LLM, no OpenAI/AWS

```env
ANTHROPIC_API_KEY=your-key-here
EVAL_CLAUDE_TEXT_ONLY=1
```

Get a key: https://console.anthropic.com/settings/keys (new accounts get ~$5 free credit).

`EVAL_CLAUDE_TEXT_ONLY=1` (default) sends **captions + metadata only** — cheap hosted LLM (~$0.25/1M tokens on Haiku). Set `EVAL_CLAUDE_TEXT_ONLY=0` to send the image (vision, costs more).

Optional: `ANTHROPIC_MODEL` or `EVAL_CLAUDE_MODEL` (default `claude-haiku-4-5`), `EVAL_CLAUDE_DELAY_MS` (default `400`).

### Paid mode (`npm run eval`) — OpenAI Vision + AWS Rekognition

```env
OPENAI_API_KEY=sk-proj-...
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Required for `llm`, `hybrid`, and `production` approaches. Rekognition has a **5MB per-image limit**; larger images skip celebrity hints but still run through GPT-4.1 Vision.

## 6. Validate and run classifiers

### Does this satisfy the milestone’s three approaches?

The assignment asks for **three** detection strategies:

| Milestone requirement | Your implementation | Satisfied? |
|----------------------|---------------------|------------|
| **Traditional / cheap classifier** | `heuristic` — C2PA + filename + keyword rules | Yes |
| **LLM-as-classifier** (hosted LLM, allow/unallow + rationale) | **Claude** (`npm run eval:free`) or **`npm run eval`** (OpenAI Vision) | Yes |
| **Hybrid** | `hybrid` — heuristic first, then Claude on uncertain cases | Yes |

The fourth approach, **`production`**, benchmarks the exact upload pipeline (not a separate milestone requirement).

### Commands

**Validate manifests (no API calls):**

```bash
npm run eval -- --dry-run
```

**Free mode** — runs `heuristic`, `llm`, and `hybrid` with Claude (see env vars above):

```bash
npm run eval:free -- --limit 5
npm run eval:free
npm run eval:free -- --approach hybrid
```

**Paid mode** — runs all four approaches (`heuristic`, `llm`, `hybrid`, `production`):

```bash
npm run eval -- --limit 5
npm run eval
```

**Production only** (skip heuristic / llm / hybrid):

```bash
npm run eval -- --approach production
npm run eval:production
```

Useful flags: `--limit N` (per class), `--concurrency N` (default `2`; paid production runs often use `1`).

Results land in `evals/results/<timestamp>-<approach>.json` and print a summary table (precision, recall, F1, confusion matrix, latency, estimated USD/1k). Tune thresholds in `evals/config.ts` before your final poster numbers.

### Approach reference

| ID | Free mode (`npm run eval:free`) | Paid mode (`npm run eval`) |
|----|----------------------------------|----------------------------|
| `heuristic` | C2PA + filename + keyword rules | C2PA + Rekognition + rule risk |
| `llm` | Claude Haiku (hosted LLM) | OpenAI Vision |
| `hybrid` | Heuristic + Claude | Heuristic + OpenAI on edge cases |
| `production` | — (paid only) | **Exact upload pipeline** (`runAnalysisPipeline` + `shouldFlagAnalysis`) |

Ground truth positive class = `unallow` (should flag).

### Production benchmark (OpenFake, 200 images)

Committed results: [`evals/results/production-openfake-200.json`](results/production-openfake-200.json)

| Metric | Value |
|--------|------:|
| Precision | 1.000 |
| Recall | 0.470 |
| F1 | 0.639 |
| TP / FP / TN / FN | 47 / 0 / 100 / 53 |
| Median latency | ~3.4s |
| Est. cost | ~$13 / 1k images |

Production path: GPT-4.1 Vision → `calculateRisk` → flag on `HIGH`/`CRITICAL` risk or `possibleKnownManipulation`. Zero false positives on real images; misses are mostly photorealistic or non-political fakes the LLM judged as authentic.

## Committing images to git

The milestone asks for labeled examples in the repo. After setup:

- ~100 JPEGs per set is typically hundreds of MB — acceptable for git or use **Git LFS** if your team prefers.
- Minimum for grading: manifests + reproducible `npm run eval:setup-openfake` command with pinned `--seed`.
- Hugging Face cache (optional): set `HF_HOME=evals/.cache` to keep downloads inside `evals/` (gitignored).

## Manifest format (manual rows)

```json
{"id":"allow-001","path":"images/photo-001.jpg","label":"allow","source":"OpenFake ...","notes":"model=laion"}
```

One JSON object per line. `path` is relative to the manifest file.
