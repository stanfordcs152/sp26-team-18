// Heuristic AI-image detector for Phase 3.
//
// We don't have a real model in the MVP, so this combines the strongest
// signal we DO have (C2PA Content Credentials status) with a few weak
// filename hints. The output is a confidence score in [0, 100] representing
// the *likelihood the image is AI-generated*, plus a boolean `isFlagged`
// for posts that cross our review threshold and a list of human-readable
// flags surfaced in the UI.
//
// This is intentionally deterministic and dependency-free so it runs the
// same way on Vercel, in tests, and locally.

import type { C2paStatus } from "./types"

export interface AiDetectionInput {
  filename?: string | null
  c2paStatus: C2paStatus
  isPolitical?: boolean
}

export interface AiDetectionResult {
  isFlagged: boolean
  confidenceScore: number // 0-100, higher = more likely AI
  flags: string[]
}

const FLAG_THRESHOLD = 60

// Filename tokens that strongly hint at generative-AI tooling.
const AI_FILENAME_TOKENS = [
  "midjourney",
  "dalle",
  "dall-e",
  "stable-diffusion",
  "stablediffusion",
  "sdxl",
  "ai-generated",
  "ai_generated",
  "generated-by-ai",
  "synthid",
] as const

// Filename tokens that loosely suggest camera-origin (DCIM defaults, etc.).
const CAMERA_FILENAME_TOKENS = ["dscf", "dsc_", "img_", "p10", "_mg_"] as const

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n))
}

export function detectAi({
  filename,
  c2paStatus,
  isPolitical,
}: AiDetectionInput): AiDetectionResult {
  const flags: string[] = []

  // Base score is anchored to C2PA, our most defensible signal.
  let score: number
  switch (c2paStatus) {
    case "verified":
      score = 8
      flags.push("Content Credentials verified")
      break
    case "invalid":
      score = 92
      flags.push("Content Credentials manifest failed validation")
      break
    case "missing":
      score = 45
      break
    case "no_image":
    default:
      score = 30
      break
  }

  // Filename hints (cheap, sometimes useful).
  const lower = (filename ?? "").toLowerCase()
  const hasAiToken = AI_FILENAME_TOKENS.some((t) => lower.includes(t))
  const hasCameraToken = CAMERA_FILENAME_TOKENS.some((t) => lower.includes(t))

  if (hasAiToken) {
    score += 30
    flags.push("Filename suggests generative-AI tooling")
  }
  if (hasCameraToken && c2paStatus !== "invalid") {
    score -= 10
  }

  score = clamp(score)
  const isFlagged = score >= FLAG_THRESHOLD

  if (isPolitical && isFlagged) {
    flags.push("Political content flagged for review")
  }

  return { isFlagged, confidenceScore: Math.round(score), flags }
}
