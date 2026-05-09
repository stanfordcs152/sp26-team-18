import { describe, it, expect } from "vitest"
import { detectAi } from "./ai-detection"

describe("detectAi — C2PA-anchored base score", () => {
  it("treats verified C2PA as low-risk and not flagged", () => {
    const result = detectAi({ filename: "photo.jpg", c2paStatus: "verified" })
    expect(result.confidenceScore).toBe(8)
    expect(result.isFlagged).toBe(false)
    expect(result.flags).toContain("Content Credentials verified")
  })

  it("treats invalid C2PA as high-risk and flags it", () => {
    const result = detectAi({ filename: "photo.jpg", c2paStatus: "invalid" })
    expect(result.confidenceScore).toBe(92)
    expect(result.isFlagged).toBe(true)
    expect(result.flags).toContain(
      "Content Credentials manifest failed validation"
    )
  })

  it("treats missing C2PA as moderate risk under the flag threshold", () => {
    const result = detectAi({ filename: "photo.jpg", c2paStatus: "missing" })
    expect(result.confidenceScore).toBe(45)
    expect(result.isFlagged).toBe(false)
  })

  it("treats no_image (non-image upload) as low-moderate risk", () => {
    const result = detectAi({ filename: "doc.pdf", c2paStatus: "no_image" })
    expect(result.confidenceScore).toBe(30)
    expect(result.isFlagged).toBe(false)
  })
})

describe("detectAi — filename heuristics", () => {
  it("boosts the score and adds a flag for AI tooling tokens", () => {
    const result = detectAi({
      filename: "midjourney-v6-output.png",
      c2paStatus: "missing",
    })
    // 45 (missing) + 30 (ai token) = 75 → flagged
    expect(result.confidenceScore).toBe(75)
    expect(result.isFlagged).toBe(true)
    expect(result.flags).toContain("Filename suggests generative-AI tooling")
  })

  it("recognises a variety of AI-tool filename tokens", () => {
    const tokens = [
      "dalle-3.png",
      "dall-e_run.jpg",
      "stable-diffusion.png",
      "stablediffusion-out.png",
      "sdxl-final.jpg",
      "ai-generated-portrait.png",
      "ai_generated_scene.jpg",
      "generated-by-ai-cover.png",
      "synthid-test.jpg",
    ]
    for (const filename of tokens) {
      const result = detectAi({ filename, c2paStatus: "missing" })
      expect(result.flags).toContain(
        "Filename suggests generative-AI tooling"
      )
      expect(result.isFlagged).toBe(true)
    }
  })

  it("dampens the score for camera-style filenames when C2PA is not invalid", () => {
    const result = detectAi({ filename: "DSCF1234.JPG", c2paStatus: "missing" })
    // 45 (missing) - 10 (camera) = 35 → not flagged
    expect(result.confidenceScore).toBe(35)
    expect(result.isFlagged).toBe(false)
  })

  it("does NOT dampen camera-style filenames when C2PA is invalid", () => {
    const result = detectAi({
      filename: "IMG_0001.jpg",
      c2paStatus: "invalid",
    })
    // invalid is decisive: stays at 92, no -10
    expect(result.confidenceScore).toBe(92)
    expect(result.isFlagged).toBe(true)
  })

  it("is case-insensitive on filename tokens", () => {
    const lower = detectAi({ filename: "midjourney.png", c2paStatus: "missing" })
    const upper = detectAi({ filename: "MIDJOURNEY.PNG", c2paStatus: "missing" })
    expect(upper.confidenceScore).toBe(lower.confidenceScore)
    expect(upper.isFlagged).toBe(lower.isFlagged)
  })

  it("handles missing/empty filenames without throwing", () => {
    const undefResult = detectAi({ c2paStatus: "missing" })
    const nullResult = detectAi({ filename: null, c2paStatus: "missing" })
    const emptyResult = detectAi({ filename: "", c2paStatus: "missing" })
    expect(undefResult.confidenceScore).toBe(45)
    expect(nullResult.confidenceScore).toBe(45)
    expect(emptyResult.confidenceScore).toBe(45)
  })
})

describe("detectAi — political enrichment", () => {
  it("adds the political-review flag when post is political AND flagged", () => {
    const result = detectAi({
      filename: "campaign-midjourney.png",
      c2paStatus: "missing",
      isPolitical: true,
    })
    expect(result.isFlagged).toBe(true)
    expect(result.flags).toContain("Political content flagged for review")
  })

  it("does NOT add the political-review flag when below threshold", () => {
    const result = detectAi({
      filename: "vacation.jpg",
      c2paStatus: "verified",
      isPolitical: true,
    })
    expect(result.isFlagged).toBe(false)
    expect(result.flags).not.toContain("Political content flagged for review")
  })

  it("does NOT add the political-review flag when not political", () => {
    const result = detectAi({
      filename: "midjourney.png",
      c2paStatus: "missing",
      isPolitical: false,
    })
    expect(result.isFlagged).toBe(true)
    expect(result.flags).not.toContain("Political content flagged for review")
  })
})

describe("detectAi — score bounds", () => {
  it("clamps the score to [0, 100]", () => {
    // invalid (92) + ai token (30) would be 122 without clamp
    const high = detectAi({
      filename: "midjourney-fake.png",
      c2paStatus: "invalid",
    })
    expect(high.confidenceScore).toBe(100)
    expect(high.isFlagged).toBe(true)

    // verified (8) + camera dampening (-10) would be -2 without clamp
    const low = detectAi({
      filename: "DSCF0001.JPG",
      c2paStatus: "verified",
    })
    expect(low.confidenceScore).toBe(0)
    expect(low.isFlagged).toBe(false)
  })

  it("returns integer scores", () => {
    const result = detectAi({ filename: "any.png", c2paStatus: "missing" })
    expect(Number.isInteger(result.confidenceScore)).toBe(true)
  })
})
