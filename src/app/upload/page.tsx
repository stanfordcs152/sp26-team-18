"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import type { PostAnalysis } from "@/lib/types"

export default function UploadPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isPolitical, setIsPolitical] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModerationWarning, setShowModerationWarning] = useState(false)
  const [pendingModeration, setPendingModeration] = useState<PostAnalysis | null>(
    null
  )
  const [pendingImageUrl, setPendingImageUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Build the row payload that gets inserted into `posts`. Used by both the
  // direct (no-warning) path and the "Submit for Review" path so they stay
  // in sync.
  const buildPostRow = (
    imageUrl: string,
    analysis: PostAnalysis | null
  ) => {
    const isFlagged = analysis
      ? analysis.risk.level === "HIGH" ||
        analysis.risk.level === "CRITICAL" ||
        analysis.manipulationSignals?.possibleKnownManipulation === true
      : false

    return {
      image_url: imageUrl,
      caption: caption.trim(),
      username: username.trim(),
      is_political: isPolitical,
      is_flagged: isFlagged,
      confidence_score: analysis ? Math.round(analysis.risk.score * 100) : 0,
      analysis,
      risk_score: analysis ? analysis.risk.score : null,
      risk_level: analysis ? analysis.risk.level : null,
    }
  }

  // Insert with graceful degradation: if the DB hasn't had migration 0004
  // applied yet, drop the new columns and retry. Keeps the demo working
  // against partially-migrated databases.
  const insertPost = async (row: ReturnType<typeof buildPostRow>) => {
    if (!supabase) return { error: { message: "Supabase not configured" } }
    const full = await supabase.from("posts").insert(row)
    if (!full.error) return full

    const legacy = await supabase.from("posts").insert({
      image_url: row.image_url,
      caption: row.caption,
      username: row.username,
      is_flagged: row.is_flagged,
      confidence_score: row.confidence_score,
    })
    return legacy
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      setError("Supabase environment variables are missing.")
      return
    }

    if (!username.trim() || !caption.trim() || !file) {
      setError("Username, caption, and image are required.")
      return
    }

    setSubmitting(true)
    setError(null)
    setIsAnalyzing(true)

    const fileExt = file.name.split(".").pop() ?? "jpg"
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData.publicUrl

    const analysisFormData = new FormData()
    analysisFormData.append("image", file)
    analysisFormData.append("username", username.trim())

    const analysisResponse = await fetch("/api/analyze", {
      method: "POST",
      body: analysisFormData,
    })

    const analysisData = await analysisResponse.json()

    // Account-age upload throttle (HTTP 429). Surface the server's message.
    if (analysisResponse.status === 429) {
      setError(
        analysisData.error ?? "Upload limit reached. Please try again later."
      )
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    if (!analysisResponse.ok || !analysisData.success) {
      setError("Failed to analyze uploaded image.")
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    const moderationAnalysis = analysisData.analysis as PostAnalysis

    const shouldWarn =
      moderationAnalysis.risk.level === "HIGH" ||
      moderationAnalysis.risk.level === "CRITICAL" ||
      moderationAnalysis.manipulationSignals?.possibleKnownManipulation === true

    if (shouldWarn) {
      setPendingModeration(moderationAnalysis)
      setPendingImageUrl(imageUrl)
      setShowModerationWarning(true)
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    const { error: insertError } = await insertPost(
      buildPostRow(imageUrl, moderationAnalysis)
    )

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    setIsAnalyzing(false)
    router.push("/")
    router.refresh()
  }

  const handleSubmitForReview = async () => {
    if (!supabase || !pendingModeration) return

    const { error: insertError } = await insertPost(
      buildPostRow(pendingImageUrl, pendingModeration)
    )

    if (insertError) {
      setError(insertError.message)
      return
    }

    setShowModerationWarning(false)
    setIsAnalyzing(false)

    router.push("/")
    router.refresh()
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-6">
      <h1 className="text-2xl font-bold">Upload Post</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Share an image and caption to add a new post.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-border p-4 sm:p-6">
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your_username"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="caption" className="text-sm font-medium">
            Caption
          </label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            rows={4}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="image" className="text-sm font-medium">
            Image
          </label>
          <Input
            id="image"
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll run an AI image classifier on upload to detect synthetic
            political media.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <input
            id="is-political"
            type="checkbox"
            checked={isPolitical}
            onChange={(e) => setIsPolitical(e.target.checked)}
            className="mt-0.5 size-4 rounded border-input accent-primary"
          />
          <label htmlFor="is-political" className="text-sm">
            <span className="font-medium">This post is about politics</span>
            <span className="block text-xs text-muted-foreground">
              Helps moderators prioritize review of political AI content.
            </span>
          </label>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting || isAnalyzing}>
          {isAnalyzing
            ? "Analyzing content..."
            : submitting
              ? "Uploading..."
              : "Upload Post"}
        </Button>
      </form>

      {showModerationWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="w-full max-w-lg rounded-xl border border-red-500 bg-black p-6 text-white shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-red-400">
              Post Requires Additional Review
            </h2>

            <p className="mb-4 text-gray-300">
              Our integrity systems detected signals commonly associated with
              manipulated political or public-figure content.
            </p>

            <div className="mb-4 rounded-lg bg-red-950/40 p-4 text-red-200">
              This post may contain misleading, synthetic, or reputationally harmful
              media involving an influential individual. To help protect platform
              authenticity and public trust, this upload may require additional
              moderation review before becoming publicly visible.
            </div>

            <p className="mb-6 text-gray-400">
              You can still continue with the upload, but the content may be flagged,
              limited in distribution, or held for manual review.
            </p>

            {pendingImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingImageUrl}
                alt="Upload preview"
                className="mb-4 max-h-64 w-full rounded-lg object-cover"
              />
            )}

            {pendingModeration && (
              <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-950/20 p-4 text-sm text-yellow-100">
                <p className="font-semibold text-yellow-300">Moderation Confidence</p>
                <p className="mt-1">Risk Level: {pendingModeration.risk.level}</p>
                <p>
                  Confidence Score: {(pendingModeration.risk.score * 100).toFixed(0)}%
                </p>
                <p className="mt-3 font-semibold text-yellow-300">
                  Detection Reasoning
                </p>
                <p className="mt-1 text-yellow-100/90">
                  {pendingModeration.vision?.reasoning}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowModerationWarning(false)
                }}
              >
                Cancel Upload
              </Button>

              <Button
                type="button"
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleSubmitForReview}
              >
                Submit for Review
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
