import { describe, expect, it } from "vitest"
import {
  countModerationFilter,
  isHighRiskItem,
  matchesModerationFilter,
} from "./moderation-metrics"
import type { LiveQueueItem } from "./types"

const now = Date.parse("2026-06-02T12:00:00.000Z")

function item(overrides: Partial<LiveQueueItem>): LiveQueueItem {
  return {
    groupKey: "post-1",
    post: {
      id: "post-1",
      author: {
        id: "alice",
        username: "alice",
        displayName: "alice",
        avatarUrl: "",
        verified: false,
      },
      content: "caption",
      media: [],
      createdAt: "2026-06-02T10:00:00.000Z",
      likes: 0,
      comments: 0,
      shares: 0,
      isLiked: false,
      isBookmarked: false,
      status: "visible",
    },
    postStatus: "visible",
    reports: [],
    newestReportAt: "2026-06-02T10:00:00.000Z",
    oldestReportAt: "2026-06-02T10:00:00.000Z",
    analysis: null,
    riskScore: null,
    riskLevel: null,
    isFlagged: false,
    selfDeclaredAi: null,
    confidenceScore: null,
    moderationStatus: null,
    reviewedAt: null,
    reviewedBy: null,
    removedAt: null,
    escalatedAt: null,
    approvedAt: null,
    userHistory: null,
    ...overrides,
  }
}

describe("moderation metric filters", () => {
  it("treats risk_score >= 0.60 as high risk", () => {
    expect(isHighRiskItem(item({ riskLevel: "MEDIUM", riskScore: 0.62 }))).toBe(true)
    expect(isHighRiskItem(item({ riskLevel: "MEDIUM", riskScore: 0.4 }))).toBe(false)
  })

  it("filters pending review by flagged or pending/escalated status", () => {
    expect(matchesModerationFilter(item({ isFlagged: true }), "pending", now)).toBe(true)
    expect(
      matchesModerationFilter(item({ moderationStatus: "pending_review" }), "pending", now)
    ).toBe(true)
    expect(matchesModerationFilter(item({ moderationStatus: "approved" }), "pending", now)).toBe(
      false
    )
  })

  it("filters flags today from stored analysis signals", () => {
    expect(
      matchesModerationFilter(
        item({
          analysis: {
            provenance: { verified: false, present: false },
            vision: {
              visibleText: "",
              publicFigures: [],
              publicFigureConfidence: 0,
              appearsAIGenerated: true,
              syntheticMediaConfidence: 0.7,
              politicalContext: true,
              politicalContextConfidence: 0.8,
              possibleKnownManipulation: false,
              misinformationRisk: "MEDIUM",
              reasoning: "",
            },
            ocr: { text: "", hasText: false, matchedKeywords: [] },
            ai: { aiProbability: 0.7, model: "test", flagged: true, indicators: [] },
            politicians: { detected: [], confidence: 0 },
            manipulationSignals: {
              possibleKnownManipulation: false,
              politicalContext: true,
              politicalContextConfidence: 0.8,
            },
            risk: { score: 0.55, level: "MEDIUM", reasons: [] },
          },
        }),
        "flagsToday",
        now
      )
    ).toBe(true)
  })

  it("filters reviewed and decision outcomes by timestamps", () => {
    const reviewedAt = "2026-06-02T11:00:00.000Z"
    expect(matchesModerationFilter(item({ reviewedAt }), "reviewedToday", now)).toBe(true)
    expect(
      matchesModerationFilter(
        item({ moderationStatus: "approved", reviewedAt, approvedAt: reviewedAt }),
        "approvalsToday",
        now
      )
    ).toBe(true)
    expect(
      matchesModerationFilter(
        item({ moderationStatus: "escalated", reviewedAt, escalatedAt: reviewedAt }),
        "escalationsToday",
        now
      )
    ).toBe(true)
  })

  it("counts matching items", () => {
    const items = [
      item({ groupKey: "a", riskScore: 0.7 }),
      item({ groupKey: "b", riskScore: 0.4 }),
      item({ groupKey: "c", riskLevel: "CRITICAL" }),
    ]

    expect(countModerationFilter(items, "highRisk", now)).toBe(2)
  })
})
