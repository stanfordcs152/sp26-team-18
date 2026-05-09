import { describe, expect, it } from "vitest"
import { calculateRisk } from "./risk"

describe("calculateRisk — scoring branches", () => {
  it("returns LOW with no reasons for a benign empty input", () => {
    const res = calculateRisk({})
    expect(res.score).toBe(0)
    expect(res.level).toBe("LOW")
    expect(res.reasons).toEqual([])
  })

  it("scales score by AI probability via the 0.4 weight", () => {
    const res = calculateRisk({ ai: { aiProbability: 0.5 } })
    // 0.4 * 0.5 = 0.2 + moderate-likelihood reason
    expect(res.score).toBeCloseTo(0.2, 5)
    expect(res.level).toBe("LOW")
    expect(res.reasons).toContain("Moderate AI-generation likelihood: 50%")
  })

  it("adds 0.25 for missing provenance and notes the reason", () => {
    const res = calculateRisk({ provenance: { verified: false } })
    expect(res.score).toBeCloseTo(0.25, 5)
    expect(res.reasons).toContain(
      "Missing or unverifiable provenance metadata"
    )
  })

  it("adds 0.2 for politician detection and lists names", () => {
    const res = calculateRisk({
      politicians: { detected: ["Joe Biden"], confidence: 0.9 },
    })
    expect(res.score).toBeCloseTo(0.2, 5)
    expect(res.reasons.some((r) => r.includes("Joe Biden"))).toBe(true)
  })

  it("caps election-keyword bonus at 0.1 regardless of match count", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h"]
    const res = calculateRisk({ ocr: { matchedKeywords: many } })
    // 8 * 0.03 = 0.24 → capped to 0.1
    expect(res.score).toBeCloseTo(0.1, 5)
  })

  it("caps report-count bonus at 0.05", () => {
    const res = calculateRisk({ reportCount: 100 })
    expect(res.score).toBeCloseTo(0.05, 5)
    expect(res.reasons[0]).toMatch(/100 user reports/)
  })
})

describe("calculateRisk — risk-level boundaries", () => {
  it("returns CRITICAL when combined signals push past 0.85", () => {
    const res = calculateRisk({
      ai: { aiProbability: 1 }, // +0.4
      provenance: { verified: false }, // +0.25
      politicians: { detected: ["X"] }, // +0.2
      manipulationSignals: { possibleKnownManipulation: true }, // +0.15
    })
    expect(res.score).toBe(1)
    expect(res.level).toBe("CRITICAL")
  })

  it("returns HIGH for AI=0.9 + missing provenance (≈0.61) and bumps with one report to land in HIGH band", () => {
    const res = calculateRisk({
      ai: { aiProbability: 0.9 },
      provenance: { present: false },
      reportCount: 5,
    })
    // 0.36 + 0.25 + 0.05 = 0.66
    expect(res.score).toBeCloseTo(0.66, 5)
    expect(res.level).toBe("HIGH")
  })

  it("returns MEDIUM for moderate signals around 0.4–0.5", () => {
    const res = calculateRisk({
      ai: { aiProbability: 0.5 },
      politicians: { detected: ["Y"] },
    })
    expect(res.score).toBeCloseTo(0.4, 5)
    expect(res.level).toBe("MEDIUM")
  })
})

describe("calculateRisk — clamping", () => {
  it("clamps negative AI probabilities to 0", () => {
    const res = calculateRisk({ ai: { aiProbability: -1 } })
    expect(res.score).toBe(0)
    expect(res.level).toBe("LOW")
  })

  it("never returns a score above 1", () => {
    const res = calculateRisk({
      ai: { aiProbability: 5 },
      provenance: { verified: false },
      politicians: { detected: ["A", "B"] },
      manipulationSignals: {
        possibleKnownManipulation: true,
        politicalContext: true,
        politicalContextConfidence: 1,
      },
      ocr: { matchedKeywords: ["x", "y", "z", "w"] },
      reportCount: 50,
    })
    expect(res.score).toBe(1)
    expect(res.level).toBe("CRITICAL")
  })
})
