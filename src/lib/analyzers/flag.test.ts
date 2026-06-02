import { describe, expect, it } from "vitest"
import { shouldFlagAnalysis } from "./flag"
import type { PostAnalysis } from "../types"

function analysis(overrides: Partial<PostAnalysis>): Partial<PostAnalysis> {
  return overrides
}

describe("shouldFlagAnalysis", () => {
  it("flags AI probability at 0.9 with political context", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          ai: { aiProbability: 0.9, model: "test", flagged: false, indicators: [] },
          vision: {
            appearsAIGenerated: false,
            syntheticMediaConfidence: 0.2,
            publicFigures: [],
            publicFigureConfidence: 0,
            politicalContext: true,
            politicalContextConfidence: 0.8,
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

  it("flags appearsAIGenerated true with political context", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          vision: {
            appearsAIGenerated: true,
            syntheticMediaConfidence: 0.2,
            publicFigures: [],
            publicFigureConfidence: 0,
            politicalContext: true,
            politicalContextConfidence: 0.8,
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

  it("flags MEDIUM risk when score is at least 0.60", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          risk: { score: 0.62, level: "MEDIUM", reasons: [] },
        })
      )
    ).toBe(true)
  })

  it("does not flag MEDIUM risk with score 0.40 without AI political signal", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          ai: { aiProbability: 0.4, model: "test", flagged: false, indicators: [] },
          vision: {
            appearsAIGenerated: false,
            syntheticMediaConfidence: 0.4,
            publicFigures: [],
            publicFigureConfidence: 0,
            politicalContext: false,
            politicalContextConfidence: 0,
            possibleKnownManipulation: false,
            misinformationRisk: "LOW",
            reasoning: "",
            visibleText: "",
          },
          risk: { score: 0.4, level: "MEDIUM", reasons: [] },
        })
      )
    ).toBe(false)
  })

  it("flags AI-generated political images", () => {
    expect(
      shouldFlagAnalysis(
        analysis({
          ai: { aiProbability: 0.72, model: "test", flagged: true, indicators: [] },
          vision: {
            appearsAIGenerated: true,
            syntheticMediaConfidence: 0.72,
            publicFigures: ["Candidate Example"],
            publicFigureConfidence: 0.82,
            politicalContext: true,
            politicalContextConfidence: 0.84,
            possibleKnownManipulation: false,
            misinformationRisk: "MEDIUM",
            reasoning: "",
            visibleText: "",
          },
          risk: { score: 0.55, level: "MEDIUM", reasons: [] },
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

  it("does not flag political/public figure content below the AI threshold", () => {
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
    ).toBe(false)
  })
})
