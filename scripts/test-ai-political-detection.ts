import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { analyzeImageBuffer } from "../src/lib/analyze-image"
import { getAnalysisAiLikelihood } from "../src/lib/analyzers/flag"
import type { PostAnalysis } from "../src/lib/types"

type ManifestRow = {
  id: string
  path: string
  label: "allow" | "unallow"
  source?: string
  notes?: string
}

type DetectionResult = {
  id: string
  filename: string
  appearsAIGenerated: boolean
  aiLikelihood: number | null
  publicFigures: string[]
  politicalContext: boolean
  riskScore: number
  riskLevel: string
  shouldFlag: boolean
  feedLabel: string
  moderatorQueueEligible: boolean
  stored?: boolean
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const UNALLOW_MANIFEST = path.join(REPO_ROOT, "evals/unallow/manifest.jsonl")
const DEFAULT_IDS = [
  "openfake-core-validation-unallow-0011",
  "openfake-core-validation-unallow-0023",
  "openfake-core-validation-unallow-0027",
  "openfake-core-validation-unallow-0034",
  "openfake-core-validation-unallow-0037",
  "openfake-core-validation-unallow-0043",
  "openfake-core-validation-unallow-0068",
  "openfake-core-validation-unallow-0092",
  "openfake-core-validation-unallow-0095",
  "openfake-core-validation-unallow-0099",
]

function parseArgs(argv: string[]) {
  const opts = {
    ids: DEFAULT_IDS,
    insert: false,
    limit: DEFAULT_IDS.length,
  }

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--ids") {
      opts.ids = argv[++index].split(",").map((id) => id.trim()).filter(Boolean)
    } else if (arg === "--insert") {
      opts.insert = true
    } else if (arg === "--limit") {
      opts.limit = Number(argv[++index])
    }
  }

  return opts
}

async function loadManifest() {
  const raw = await readFile(UNALLOW_MANIFEST, "utf8")
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ManifestRow)
}

function moderatorQueueEligible(result: {
  shouldFlag: boolean
  analysis: PostAnalysis
}) {
  return (
    result.shouldFlag ||
    result.analysis.risk.level === "HIGH" ||
    result.analysis.risk.level === "CRITICAL" ||
    result.analysis.vision.appearsAIGenerated ||
    (getAnalysisAiLikelihood(result.analysis) ?? 0) >= 0.6
  )
}

function assertResult(result: DetectionResult) {
  const errors: string[] = []

  if (result.feedLabel === "authentic") {
    errors.push("feed label was Verified Authentic")
  }
  if (result.aiLikelihood !== null && result.aiLikelihood >= 0.6 && !result.shouldFlag) {
    errors.push("AI likelihood >= 0.6 but shouldFlagAnalysis returned false")
  }
  if (
    (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") &&
    !result.moderatorQueueEligible
  ) {
    errors.push("high-risk result was not moderator-queue eligible")
  }

  return errors
}

async function maybeInsertPost(
  row: ManifestRow,
  absPath: string,
  imageBuffer: Buffer,
  analysis: PostAnalysis,
  shouldFlag: boolean
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required for --insert")
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const storagePath = `pipeline-tests/${Date.now()}-${path.basename(absPath)}`
  const { error: uploadError } = await supabase.storage
    .from("post-images")
    .upload(storagePath, imageBuffer, {
      contentType: "image/jpeg",
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Supabase storage upload failed for ${row.id}: ${uploadError.message}`)
  }

  const { data: publicUrlData } = supabase.storage
    .from("post-images")
    .getPublicUrl(storagePath)

  const fullRow = {
    image_url: publicUrlData.publicUrl,
    caption: `Pipeline test: ${row.id}`,
    username: "pipeline-test",
    is_political: true,
    is_flagged: shouldFlag,
    moderation_status: shouldFlag ? "pending_review" : "approved",
    confidence_score: Math.round(analysis.risk.score * 100),
    analysis,
    risk_score: analysis.risk.score,
    risk_level: analysis.risk.level,
  }

  const { moderation_status: _moderationStatus, ...withoutModerationStatus } = fullRow
  const fullInsert = await supabase.from("posts").insert(fullRow)
  const insertResult = fullInsert.error
    ? await supabase.from("posts").insert(withoutModerationStatus)
    : fullInsert

  if (insertResult.error) {
    throw new Error(`Supabase insert failed for ${row.id}: ${insertResult.error.message}`)
  }

  const { data: stored, error: selectError } = await supabase
    .from("posts")
    .select("id, is_flagged, risk_score, risk_level, analysis")
    .eq("username", "pipeline-test")
    .eq("caption", `Pipeline test: ${row.id}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (selectError || !stored) {
    throw new Error(
      `Supabase verification query failed for ${row.id}: ${selectError?.message ?? "no row returned"}`
    )
  }

  if (stored.is_flagged !== shouldFlag || !stored.analysis) {
    throw new Error(`Supabase stored row did not preserve analysis/flag for ${row.id}`)
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required. Load .env.local, but do not print the key.")
  }

  const opts = parseArgs(process.argv.slice(2))
  const manifest = await loadManifest()
  const byId = new Map(manifest.map((row) => [row.id, row]))
  const selected = opts.ids
    .slice(0, opts.limit)
    .map((id) => byId.get(id))
    .filter((row): row is ManifestRow => Boolean(row))

  if (selected.length === 0) {
    throw new Error("No matching unallow manifest rows selected.")
  }

  const results: DetectionResult[] = []
  const failures: string[] = []

  for (const row of selected) {
    const absPath = path.join(path.dirname(UNALLOW_MANIFEST), row.path)
    const imageBuffer = await readFile(absPath)
    const analysisResult = await analyzeImageBuffer(imageBuffer)
    const aiLikelihood = getAnalysisAiLikelihood(analysisResult.analysis)
    const result: DetectionResult = {
      id: row.id,
      filename: path.basename(absPath),
      appearsAIGenerated: analysisResult.analysis.vision.appearsAIGenerated,
      aiLikelihood,
      publicFigures: analysisResult.analysis.vision.publicFigures,
      politicalContext: analysisResult.analysis.vision.politicalContext,
      riskScore: analysisResult.analysis.risk.score,
      riskLevel: analysisResult.analysis.risk.level,
      shouldFlag: analysisResult.shouldFlag,
      feedLabel: analysisResult.feedLabel.status,
      moderatorQueueEligible: moderatorQueueEligible(analysisResult),
    }

    if (opts.insert) {
      await maybeInsertPost(
        row,
        absPath,
        imageBuffer,
        analysisResult.analysis,
        analysisResult.shouldFlag
      )
      result.stored = true
    }

    const errors = assertResult(result)
    if (errors.length > 0) {
      failures.push(`${row.id}: ${errors.join("; ")}`)
    }

    results.push(result)
  }

  console.table(
    results.map((result) => ({
      filename: result.filename,
      appearsAIGenerated: result.appearsAIGenerated,
      aiLikelihood: result.aiLikelihood?.toFixed(2) ?? "n/a",
      publicFigures: result.publicFigures.join(", ") || "-",
      politicalContext: result.politicalContext,
      risk_score: result.riskScore.toFixed(2),
      risk_level: result.riskLevel,
      shouldFlag: result.shouldFlag,
      feedLabel: result.feedLabel,
      moderatorQueue: result.moderatorQueueEligible,
      stored: result.stored ?? false,
    }))
  )

  if (failures.length > 0) {
    throw new Error(`Detection assertions failed:\n${failures.join("\n")}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
