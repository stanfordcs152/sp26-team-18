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
  results/                  # run output (gitignored *.json)
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

## 5. Validate and run classifiers

### Free mode (recommended — $0 API cost)

Uses **local Ollama** — default is **text-only LLM on OpenFake captions** (no GPU vision; avoids GGML crashes).

```bash
# 1. Install Ollama: https://ollama.com
ollama pull llama3.2:1b
# 2. Ensure Ollama is running (app or `ollama serve`)

npm run eval -- --dry-run
npm run eval:free -- --limit 5       # smoke test
npm run eval:free                    # full run, USD/1k = 0
```

**LLM provider** (`EVAL_LLM_PROVIDER`, default `caption`):

| Value | What it does |
|-------|----------------|
| `caption` | **Default.** Ollama text model reads OpenFake `prompt=` from manifest notes — no vision/GPU |
| `ollama-vision` | Local vision (moondream/llava) — only if your GPU supports it |
| `gemini` | Google AI Studio free tier — set `GEMINI_API_KEY` |

```powershell
# Optional: try vision again if GPU works
$env:EVAL_LLM_PROVIDER = "ollama-vision"
ollama pull moondream
npm run eval:free -- --limit 5 --approach llm
```

| Approach | Free stack |
|----------|------------|
| `heuristic` | C2PA + filename + election keywords from manifest `notes` |
| `llm` | Caption LLM (default) or vision / Gemini per table above |
| `hybrid` | Heuristic first, LLM on uncertain cases |

### Paid mode (OpenAI + AWS)

```bash
npm run eval -- --dry-run
npm run eval -- --limit 5
npm run eval
```

Requires `.env.local` with `OPENAI_API_KEY` and AWS credentials.

Results land in `evals/results/` and print a summary table (precision, recall, F1, confusion matrix, latency, estimated USD/1k).

Tune thresholds in `evals/config.ts` before your final poster numbers.

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

## Three detection approaches

| ID | Stack |
|----|--------|
| `heuristic` | C2PA + `detectAi` + AWS Rekognition + `calculateRisk` |
| `llm` | OpenAI Vision (`extractImageText`) |
| `hybrid` | Heuristic fast-path; LLM on uncertain / celebrity / invalid C2PA |

Ground truth positive class = `unallow` (should flag).
