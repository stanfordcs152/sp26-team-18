export interface ConfusionCounts {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export function confusionMatrix(
  groundTruthPositive: boolean[],
  predictedPositive: boolean[]
): ConfusionCounts {
  if (groundTruthPositive.length !== predictedPositive.length) {
    throw new Error("groundTruth and predictions must have the same length");
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  for (let i = 0; i < groundTruthPositive.length; i++) {
    const actual = groundTruthPositive[i];
    const pred = predictedPositive[i];

    if (actual && pred) tp++;
    else if (!actual && pred) fp++;
    else if (!actual && !pred) tn++;
    else fn++;
  }

  return { tp, fp, tn, fn };
}

export function precision(counts: ConfusionCounts): number {
  const denom = counts.tp + counts.fp;
  return denom === 0 ? 0 : counts.tp / denom;
}

export function recall(counts: ConfusionCounts): number {
  const denom = counts.tp + counts.fn;
  return denom === 0 ? 0 : counts.tp / denom;
}

export function f1Score(counts: ConfusionCounts): number {
  const p = precision(counts);
  const r = recall(counts);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(
    sortedAsc.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedAsc.length) - 1)
  );
  return sortedAsc[idx];
}

export function latencyStats(latenciesMs: number[]) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    median: percentile(sorted, 50),
    p99: percentile(sorted, 99),
  };
}
