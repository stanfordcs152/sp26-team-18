import { describe, expect, it } from "vitest";
import {
  confusionMatrix,
  f1Score,
  precision,
  recall,
} from "./metrics";

describe("eval metrics", () => {
  it("computes confusion matrix for combined allow/unallow eval", () => {
    const counts = confusionMatrix(
      [false, false, true, true],
      [false, true, true, false]
    );
    expect(counts).toEqual({ tp: 1, fp: 1, tn: 1, fn: 1 });
    expect(precision(counts)).toBe(0.5);
    expect(recall(counts)).toBe(0.5);
    expect(f1Score(counts)).toBe(0.5);
  });
});
