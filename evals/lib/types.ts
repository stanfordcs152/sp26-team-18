export type GroundTruthLabel = "allow" | "unallow";

export type ApproachId = "heuristic" | "llm" | "hybrid";

export interface ManifestRow {
  id: string;
  path: string;
  label: GroundTruthLabel;
  notes?: string;
  source?: string;
}

export interface ClassifierPrediction {
  flagged: boolean;
  latencyMs: number;
  usedLlm: boolean;
  meta?: Record<string, unknown>;
}

export interface ExampleResult {
  id: string;
  label: GroundTruthLabel;
  path: string;
  prediction: ClassifierPrediction;
}

export interface ApproachRunStats {
  approach: ApproachId;
  allowCount: number;
  unallowCount: number;
  precision: number;
  recall: number;
  f1: number;
  confusion: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  latencyMs: {
    median: number;
    p99: number;
  };
  costUsdPer1000: number;
  llmCalls: number;
}
