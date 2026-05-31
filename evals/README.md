# Classifier evaluation (Milestone 3 — Part 2)

TruthGuard evaluates **AI-generated political disinformation in images**. Everything for this milestone lives under `evals/` so it can ship on branch `eval-classifier` without touching app routes.

## Layout

```
evals/
  config.ts              # thresholds (tune before full runs)
  run.ts                 # CLI entrypoint
  lib/                   # metrics, classifiers, manifest loader
  allow/
    manifest.jsonl       # one JSON object per line
    images/              # benign images (add yours here)
  unallow/
    manifest.jsonl
    images/              # should-be-caught images
  results/               # JSON output (gitignored)
```

## Manifest format

One JSON object per line in `allow/manifest.jsonl` or `unallow/manifest.jsonl`:

```json
{"id":"allow-001","path":"images/photo-001.jpg","label":"allow","source":"Wikimedia Commons","notes":"Vacation photo"}
```

- `path` — relative to the manifest file (preferred: `images/...`)
- `source` — citation or how you collected it (for the report)

## Three approaches

| ID | Stack |
|----|--------|
| `heuristic` | C2PA + `detectAi` + AWS Rekognition celebrities + `calculateRisk` |
| `llm` | OpenAI Vision (`extractImageText`) |
| `hybrid` | Heuristic fast-path; LLM on uncertain band / celebrity / invalid C2PA |

Ground truth: `unallow` = positive (should flag). Metrics pool allow + unallow together.

## Commands

From repo root (requires `.env.local` with `OPENAI_API_KEY` and `AWS_*` for live runs):

```bash
npm install
npm run eval -- --dry-run          # validate manifests only
npm run eval -- --limit 5          # smoke test
npm run eval                       # all three approaches
npm run eval -- --approach hybrid
```

Results: `evals/results/<timestamp>-<approach>.json` plus a Markdown table in the terminal.

Cost assumptions: `evals/lib/cost.ts` (override with `EVAL_REKOGNITION_USD_PER_IMAGE`, `EVAL_OPENAI_VISION_USD_PER_IMAGE`).

## Next step: datasets

Replace the demo rows in each manifest with **≥ 100** examples per set. Put files in `allow/images/` and `unallow/images/`, then run `--dry-run` to verify paths before spending on APIs.
