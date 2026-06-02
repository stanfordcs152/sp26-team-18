import { describe, expect, it } from "vitest"
import { shouldFlagAnalysis } from "./flag"
import type { PostAnalysis } from "../types"

function analysis(overrides: Partial<PostAnalysis>): Partial<PostAnalysis> {
  return overrides
}

describe("shouldFlagAnalysis", () => {
  it("flags AI probability at 0.9", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          ai: { aiProbability: 0.9, model: "test", flagged: false, indicators: [] },
          risk: { score: 0.2, level: "LOW", reasons: [] },
        })
      )
    ).toBe(true)
  })

  it("flags appearsAIGenerated true", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          vision: {
            appearsAIGenerated: true,
            syntheticMediaConfidence: 0.2,
            publicFigures: [],
            publicFigureConfidence: 0,
            politicalContext: false,
            politicalContextConfidence: 0,
            possibleKnownManipulation: false,
            misinformationRisk: "LOW",
            reasoning: "",
            visibleText: "",
          },
          risk: { score: 0.2, level: "LOW", reasons: [] },
        })
      )
    ).toBe(true)
  })

  it("flags HIGH risk", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          risk: { score: 0.7, level: "HIGH", reasons: [] },
        })
      )
    ).toBe(true)
  })

  it("does not flag missing analysis", () => {
    expect(shouldFlagAnalysis(null)).toBe(false)
    expect(shouldFlagAnalysis(undefined)).toBe(false)
  })

  it("flags political/public figure content with nontrivial AI likelihood", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          ai: { aiProbability: 0.45, model: "test", flagged: false, indicators: [] },
          vision: {
            appearsAIGenerated: false,
            syntheticMediaConfidence: 0.45,
            publicFigures: ["Candidate Example"],
            publicFigureConfidence: 0.8,
            politicalContext: true,
            politicalContextConfidence: 0.8,
            possibleKnownManipulation: false,
            misinformationRisk: "LOW",
            reasoning: "",
            visibleText: "",
          },
          risk: { score: 0.3, level: "LOW", reasons: [] },
        })
      )
    ).toBe(true)
  })
})
