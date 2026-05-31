/**
 * Milestone 3 classifier evaluation runner.
 *
 *   npm run eval -- --dry-run
 *   npm run eval -- --limit 5
 *   npm run eval -- --approach hybrid
 *   npm run eval:free              # $0 eval (rules + heuristic; optional Gemini for LLM row)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_CONFIG, isFreeEvalMode } from "./config";
import { describeFreeLlmProvider } from "./lib/free-llm";
import { estimateCostUsdPer1000 } from "./lib/cost";
import { resolveImagePath, validateManifests } from "./lib/manifest";
import {
  confusionMatrix,
  f1Score,
  latencyStats,
  precision,
  recall,
} from "./lib/metrics";
import type {
  ApproachId,
  ApproachRunStats,
  ExampleResult,
  ManifestRow,
} from "./lib/types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALLOW_MANIFEST = path.join(REPO_ROOT, "evals/allow/manifest.jsonl");
const UNALLOW_MANIFEST = path.join(REPO_ROOT, "evals/unallow/manifest.jsonl");

function parseArgs(argv: string[]) {
  const opts = {
    dryRun: false,
    free: false,
    limit: Infinity,
    approach: "all" as ApproachId | "all",
    concurrency: 2,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--free") opts.free = true;
    else if (arg === "--limit") opts.limit = Number(argv[++i]);
    else if (arg === "--approach") opts.approach = argv[++i] as ApproachId | "all";
    else if (arg === "--concurrency") opts.concurrency = Number(argv[++i]);
  }

  return opts;
}

type ClassifyFn = (
  buf: Buffer,
  filename: string,
  manifestNotes?: string
) => Promise<{
  flagged: boolean;
  latencyMs: number;
  usedLlm: boolean;
  meta?: Record<string, unknown>;
}>;

async function loadApproaches(free: boolean): Promise<Record<ApproachId, ClassifyFn>> {
  if (free) {
    const { classifyHeuristicFree, classifyHybridFree, classifyLlmFree } =
      await import("./lib/classifiers-free");
    return {
      heuristic: classifyHeuristicFree,
      llm: classifyLlmFree,
      hybrid: classifyHybridFree,
    };
  }

  const { classifyHeuristic, classifyHybrid, classifyLlm } = await import(
    "./lib/classifiers"
  );
  return {
    heuristic: classifyHeuristic,
    llm: (buf, _name, _notes) => classifyLlm(buf),
    hybrid: classifyHybrid,
  };
}

async function runApproach(
  approach: ApproachId,
  examples: ManifestRow[],
  manifestPathByLabel: Record<"allow" | "unallow", string>,
  concurrency: number,
  approaches: Record<ApproachId, ClassifyFn>,
  freeMode: boolean
): Promise<{ results: ExampleResult[]; stats: ApproachRunStats }> {
  const classify = approaches[approach];
  const results: ExampleResult[] = [];
  let index = 0;

  async function worker() {
    while (index < examples.length) {
      const i = index++;
      const row = examples[i];
      const manifestPath = manifestPathByLabel[row.label];
      const absPath = resolveImagePath(REPO_ROOT, manifestPath, row.path);
      const buf = await readFile(absPath);
      const filename = path.basename(absPath);
      const prediction = await classify(buf, filename, row.notes);
      results.push({ id: row.id, label: row.label, path: row.path, prediction });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, examples.length) }, () =>
      worker()
    )
  );

  const groundTruth = results.map((r) => r.label === "unallow");
  const predicted = results.map((r) => r.prediction.flagged);
  const confusion = confusionMatrix(groundTruth, predicted);
  const latencies = results.map((r) => r.prediction.latencyMs);

  const allowCount = results.filter((r) => r.label === "allow").length;
  const unallowCount = results.filter((r) => r.label === "unallow").length;
  const llmCalls = results.filter((r) => r.prediction.usedLlm).length;

  const stats: ApproachRunStats = {
    approach,
    allowCount,
    unallowCount,
    precision: precision(confusion),
    recall: recall(confusion),
    f1: f1Score(confusion),
    confusion,
    latencyMs: latencyStats(latencies),
    costUsdPer1000: estimateCostUsdPer1000(
      approach,
      {
        totalExamples: results.length,
        llmCalls,
      },
      freeMode
    ),
    llmCalls,
  };

  return { results, stats };
}

function printSummaryTable(rows: ApproachRunStats[]) {
  console.log("\n## Combined allow + unallow metrics\n");
  console.log(
    "| Approach | Precision | Recall | F1 | TP | FP | TN | FN | Median ms | P99 ms | USD / 1k | LLM calls |"
  );
  console.log(
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"
  );
  for (const r of rows) {
    const c = r.confusion;
    console.log(
      `| ${r.approach} | ${r.precision.toFixed(3)} | ${r.recall.toFixed(3)} | ${r.f1.toFixed(3)} | ${c.tp} | ${c.fp} | ${c.tn} | ${c.fn} | ${r.latencyMs.median.toFixed(0)} | ${r.latencyMs.p99.toFixed(0)} | ${r.costUsdPer1000.toFixed(2)} | ${r.llmCalls} |`
    );
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const validation = await validateManifests(
    REPO_ROOT,
    ALLOW_MANIFEST,
    UNALLOW_MANIFEST
  );

  if (validation.errors.length > 0) {
    console.error("Manifest validation failed:\n");
    for (const e of validation.errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const allow = validation.allow.slice(0, opts.limit);
  const unallow = validation.unallow.slice(0, opts.limit);
  const all = [...allow, ...unallow];

  console.log(`Allow examples: ${allow.length}`);
  console.log(`Unallow examples: ${unallow.length}`);

  if (allow.length < 100 || unallow.length < 100) {
    console.warn(
      "\nWarning: milestone requires >= 100 examples per set. Add rows to evals/allow/manifest.jsonl and evals/unallow/manifest.jsonl.\n"
    );
  }

  const freeMode = opts.free || isFreeEvalMode();

  if (opts.dryRun) {
    console.log("\nDry run — manifests valid, no API calls.");
  }

  if (!opts.dryRun && freeMode) {
    console.log("\n*** FREE eval mode — no OpenAI or AWS charges ***");
    console.log(`    LLM: ${describeFreeLlmProvider()}`);
    console.log("    Heuristic: C2PA + filename + prompt keywords only\n");

    if (
      EVAL_CONFIG.freeLlmProvider === "gemini" &&
      !process.env.GEMINI_API_KEY &&
      (opts.approach === "all" || opts.approach === "llm" || opts.approach === "hybrid")
    ) {
      console.error(
        "GEMINI_API_KEY is required for EVAL_LLM_PROVIDER=gemini.\n" +
          "Get a free key at https://aistudio.google.com/apikey\n" +
          "Or use default rules provider: npm run eval:free (no key needed)"
      );
      process.exit(1);
    }

    if (
      EVAL_CONFIG.freeLlmProvider === "rules" &&
      (opts.approach === "llm" || opts.approach === "all")
    ) {
      console.warn(
        "Note: EVAL_LLM_PROVIDER=rules is a metadata text classifier, not a hosted LLM.\n" +
          "      For the milestone LLM row, set GEMINI_API_KEY and EVAL_LLM_PROVIDER=gemini.\n"
      );
    }
  } else if (!opts.dryRun && !process.env.OPENAI_API_KEY) {
    console.warn(
      "OPENAI_API_KEY is not set; LLM and hybrid will fail. Use: npm run eval:free"
    );
  }

  if (opts.dryRun) {
    return;
  }

  const selected: ApproachId[] =
    opts.approach === "all"
      ? ["heuristic", "llm", "hybrid"]
      : [opts.approach];

  const approaches = await loadApproaches(freeMode);

  const manifestPathByLabel = {
    allow: ALLOW_MANIFEST,
    unallow: UNALLOW_MANIFEST,
  } as const;

  const summary: ApproachRunStats[] = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  for (const approach of selected) {
    console.log(`\nRunning approach: ${approach} (${all.length} images)...`);
    const { results, stats } = await runApproach(
      approach,
      all,
      manifestPathByLabel,
      opts.concurrency,
      approaches,
      freeMode
    );
    summary.push(stats);

    const outDir = path.join(REPO_ROOT, "evals/results");
    const outFile = path.join(outDir, `${timestamp}-${approach}.json`);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      outFile,
      JSON.stringify(
        { generatedAt: new Date().toISOString(), stats, results },
        null,
        2
      ),
      "utf8"
    );
    console.log(`Wrote ${path.relative(REPO_ROOT, outFile)}`);
  }

  printSummaryTable(summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
