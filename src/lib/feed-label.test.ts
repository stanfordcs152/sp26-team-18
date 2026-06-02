import { describe, expect, it } from "vitest"
import { deriveFeedLabel } from "./feed-label"

describe("deriveFeedLabel", () => {
  it("returns AI-Generated status for high AI likelihood", () => {
    const label = deriveFeedLabel({
      analysis: {
        ai: { aiProbability: 0.9, model: "test", flagged: true, indicators: [] },
        risk: { score: 0.7, level: "HIGH", reasons: [] },
      },
    })

    expect(label.status).toBe("confirmed_ai")
    expect(label.flags).toContain("High AI-generation likelihood")
  })

  it("does not display Verified Authentic for missing analysis", () => {
    const label = deriveFeedLabel({
      isFlagged: false,
      riskLevel: null,
      confidenceScore: 0,
      analysis: null,
    })

    expect(label.status).toBe("unverified")
  })

  it("returns Verified Authentic only for verified provenance", () => {
    const label = deriveFeedLabel({
      analysis: {
        provenance: { verified: true, present: true },
        risk: { score: 0, level: "LOW", reasons: [] },
      },
    })

    expect(label.status).toBe("authentic")
  })

  it("returns Under Review for pending review state", () => {
    const label = deriveFeedLabel({
      moderationStatus: "pending_review",
      analysis: {
        ai: { aiProbability: 0.9, model: "test", flagged: true, indicators: [] },
      },
    })

    expect(label.status).toBe("under_review")
  })
})
