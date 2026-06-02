import { runAnalysisPipeline } from "@/lib/analyzers/pipeline"
import { shouldFlagAnalysis } from "@/lib/analyzers/flag"
import { deriveFeedLabel } from "@/lib/feed-label"

export async function analyzeImageBuffer(imageBuffer: Buffer) {
  const analysis = await runAnalysisPipeline(imageBuffer)
  const shouldFlag = shouldFlagAnalysis(analysis)
  const feedLabel = deriveFeedLabel({
    isFlagged: shouldFlag,
    riskLevel: analysis.risk.level,
    confidenceScore: Math.round(analysis.risk.score * 100),
    moderationStatus: shouldFlag ? "pending_review" : "approved",
    analysis,
  })

  return {
    analysis,
    shouldFlag,
    feedLabel,
  }
}
