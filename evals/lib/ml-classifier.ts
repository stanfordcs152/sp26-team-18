import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EVAL_CONFIG } from "../config";
import type { ClassifierPrediction, ManifestRow } from "./types";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL_DIR = path.join(REPO_ROOT, "evals/models/image-resnet18");
const MODEL_PATH = path.join(MODEL_DIR, "model.pt");
const SPLIT_PATH = path.join(MODEL_DIR, "split.json");
const PREDICT_SCRIPT = path.join(REPO_ROOT, "evals/scripts/ml_image_batch_predict.py");

export interface MlSplit {
  seed: number;
  testSize: number;
  trainCount: number;
  testCount: number;
  trainIds: string[];
  testIds: string[];
}

/** Held-out test IDs from the last `npm run eval:train-ml` run. */
export async function loadMlTestSplit(): Promise<MlSplit> {
  const raw = await readFile(SPLIT_PATH, "utf8");
  return JSON.parse(raw) as MlSplit;
}

function pythonCommand() {
  return process.env.EVAL_PYTHON ?? "python";
}

async function runBatchPredict(
  imagePathById: Map<string, string>
): Promise<
  Map<
    string,
    { flagged: boolean; probaUnallow: number; probaAllow: number }
  >
> {
  const items = [...imagePathById.entries()].map(([id, imagePath]) => ({
    id,
    path: imagePath,
  }));

  const py = pythonCommand();

  return new Promise((resolve, reject) => {
    const child = spawn(py, [PREDICT_SCRIPT], {
      cwd: REPO_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim() ||
              `ml_image_batch_predict.py exited with code ${code}. Run: npm run eval:train-ml`
          )
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          predictions: Array<{
            id: string;
            flagged: boolean;
            probaUnallow: number;
            probaAllow: number;
          }>;
        };
        const map = new Map<
          string,
          { flagged: boolean; probaUnallow: number; probaAllow: number }
        >();
        for (const p of parsed.predictions) {
          map.set(p.id, {
            flagged: p.flagged,
            probaUnallow: p.probaUnallow,
            probaAllow: p.probaAllow,
          });
        }
        resolve(map);
      } catch (err) {
        reject(err);
      }
    });

    child.stdin.write(JSON.stringify(items));
    child.stdin.end();
  });
}

/** Build a classify fn using fine-tuned ResNet18 on image pixels. */
export async function buildMlClassifyFn(
  examples: ManifestRow[],
  imagePathById: Map<string, string>
): Promise<
  (
    _buf: Buffer,
    _filename: string,
    _notes: string | undefined,
    rowId?: string
  ) => Promise<ClassifierPrediction>
> {
  const batchStart = performance.now();
  const predictions = await runBatchPredict(imagePathById);
  const batchMs = performance.now() - batchStart;
  const perItemMs = examples.length > 0 ? batchMs / examples.length : 0;

  return async (_buf, _filename, _notes, rowId) => {
    if (!rowId) {
      throw new Error("ML classifyFn missing rowId");
    }
    const pred = predictions.get(rowId);
    if (!pred) {
      throw new Error(`ML classifier missing prediction for ${rowId}`);
    }

    return {
      flagged: pred.flagged,
      latencyMs: perItemMs,
      usedLlm: false,
      meta: {
        model: "resnet18-transfer-learning",
        probaUnallow: pred.probaUnallow,
        probaAllow: pred.probaAllow,
      },
    };
  };
}

export type LlmClassifyFn = (
  buf: Buffer,
  filename: string,
  manifestNotes?: string
) => Promise<ClassifierPrediction>;

/**
 * ML-first cascade:
 * - ML decides confidently → no LLM call
 * - ML is uncertain (probaUnallow in a band) → escalate to the provided LLM function
 *
 * Note: This intentionally does *not* reuse production's risk-based flagging logic.
 */
export async function buildMlHybridClassifyFn(
  examples: ManifestRow[],
  imagePathById: Map<string, string>,
  llmClassifyFn: LlmClassifyFn,
  opts?: {
    uncertainLow?: number;
    uncertainHigh?: number;
    decisionThreshold?: number;
  }
): Promise<
  (
    buf: Buffer,
    filename: string,
    manifestNotes?: string,
    rowId?: string
  ) => Promise<ClassifierPrediction>
> {
  const uncertainLow = opts?.uncertainLow ?? EVAL_CONFIG.mlUncertainLow;
  const uncertainHigh = opts?.uncertainHigh ?? EVAL_CONFIG.mlUncertainHigh;
  const decisionThreshold =
    opts?.decisionThreshold ?? EVAL_CONFIG.mlDecisionThreshold;

  const batchStart = performance.now();
  const predictions = await runBatchPredict(imagePathById);
  const batchMs = performance.now() - batchStart;
  const perItemMs = examples.length > 0 ? batchMs / examples.length : 0;

  return async (buf, filename, manifestNotes, rowId) => {
    if (!rowId) {
      throw new Error("ML hybrid classifyFn missing rowId");
    }

    const pred = predictions.get(rowId);
    if (!pred) {
      throw new Error(`ML hybrid missing prediction for ${rowId}`);
    }

    const uncertain =
      pred.probaUnallow >= uncertainLow && pred.probaUnallow <= uncertainHigh;

    if (!uncertain) {
      return {
        flagged: pred.probaUnallow >= decisionThreshold,
        latencyMs: perItemMs,
        usedLlm: false,
        meta: {
          route: "ml-final",
          model: "resnet18-transfer-learning",
          probaUnallow: pred.probaUnallow,
          probaAllow: pred.probaAllow,
        },
      };
    }

    const llmStart = performance.now();
    const llmRes = await llmClassifyFn(buf, filename, manifestNotes);
    const totalLatency = perItemMs + (performance.now() - llmStart);

    return {
      flagged: llmRes.flagged,
      latencyMs: totalLatency,
      usedLlm: true,
      meta: {
        route: "llm-adjudication",
        mlProbaUnallow: pred.probaUnallow,
        mlProbaAllow: pred.probaAllow,
        ...llmRes.meta,
      },
    };
  };
}

export function mlModelPath() {
  return MODEL_PATH;
}

export function mlSplitPath() {
  return SPLIT_PATH;
}
