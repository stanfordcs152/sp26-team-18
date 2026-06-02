import type { PostAnalysis } from "@/lib/types";

/** Same allow/unallow decision as the upload flow and moderation warning. */
export function shouldFlagAnalysis(
  analysis: Pick<PostAnalysis, "risk" | "manipulationSignals">
): boolean {
  return (
    analysis.risk.level === "HIGH" ||
    analysis.risk.level === "CRITICAL" ||
    analysis.manipulationSignals?.possibleKnownManipulation === true
  );
}
