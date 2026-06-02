"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  UploadCloud,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ModeSwitch } from "@/components/mode-switch"
import { supabase } from "@/lib/supabase"
import type { PostAnalysis } from "@/lib/types"
import { shouldFlagAnalysis } from "@/lib/analyzers/flag"

export default function UploadPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModerationWarning, setShowModerationWarning] = useState(false)
  const [pendingModeration, setPendingModeration] = useState<PostAnalysis | null>(
    null
  )
  const [pendingImageUrl, setPendingImageUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Build the row payload that gets inserted into `posts`. Used by both
  // direct and flagged-upload paths so they stay in sync.
  const buildPostRow = (
    imageUrl: string,
    analysis: PostAnalysis | null
  ) => {
    const isFlagged = analysis ? shouldFlagAnalysis(analysis) : false

    return {
      image_url: imageUrl,
      caption: caption.trim(),
      username: username.trim(),
      is_political: false,
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
    setIsAnalyzing(false)

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

    setIsAnalyzing(true)

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
      setError("Failed to check uploaded image.")
      setSubmitting(false)
      setIsAnalyzing(false)
      return
    }

    const moderationAnalysis = analysisData.analysis as PostAnalysis

    const shouldWarn = shouldFlagAnalysis(moderationAnalysis)

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
    <main className="mx-auto min-h-screen w-full max-w-[720px] px-4 py-4 sm:py-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Feed
          </Link>
        </Button>
        <div className="w-full sm:max-w-[300px]">
          <ModeSwitch compact />
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Upload Post</h1>
        <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
          Share an image with your community. We may check posts for
          authenticity before they appear in the feed.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="relative mt-4 overflow-hidden rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm"
      >
        <fieldset disabled={submitting || isAnalyzing} className="space-y-3">
          <div className="space-y-1.5">
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

          <div className="space-y-1.5">
            <label htmlFor="caption" className="text-sm font-medium">
              Caption
            </label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write a caption..."
              rows={3}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="image" className="text-sm font-medium">
              Image
            </label>
            <p className="text-xs text-muted-foreground">
              Choose a photo to include with your post.
            </p>
            <label
              htmlFor="image"
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-3 transition-colors hover:border-primary/50 hover:bg-muted/35"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background">
                  {file ? (
                    <ImagePlus className="size-4 text-emerald-500" />
                  ) : (
                    <UploadCloud className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {file ? file.name : "Choose an image"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    JPG, PNG, or WebP.
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-md border border-border/70 bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Browse
              </span>
            </label>
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
              className="sr-only"
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </fieldset>

        <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Posts may take a moment to appear after upload.
          </p>
          <Button
            type="submit"
            size="lg"
            className="w-full bg-emerald-500 px-4 font-semibold text-emerald-950 shadow-sm hover:bg-emerald-400 sm:w-auto"
            disabled={submitting || isAnalyzing}
          >
            {submitting || isAnalyzing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            {isAnalyzing ? "Checking..." : submitting ? "Uploading..." : "Upload Post"}
          </Button>
        </div>

        {submitting || isAnalyzing ? (
          <div className="pointer-events-none absolute inset-0 rounded-xl bg-background/10" />
        ) : null}
      </form>

      {showModerationWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-2xl">
            <h2 className="text-xl font-semibold tracking-tight">
              This post may need another check
            </h2>

            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              We may need a little more time before this post appears in the feed.
              You can continue with the upload or go back and choose another image.
            </p>

            {pendingImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pendingImageUrl}
                alt="Upload preview"
                className="mt-4 max-h-64 w-full rounded-lg border border-border/70 object-cover"
              />
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => {
                  setShowModerationWarning(false)
                }}
              >
                Cancel Upload
              </Button>

              <Button
                type="button"
                className="bg-emerald-500 font-semibold text-emerald-950 hover:bg-emerald-400 sm:w-auto"
                onClick={handleSubmitForReview}
              >
                Continue Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
