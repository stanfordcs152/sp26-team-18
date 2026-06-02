"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  FileCheck2,
  ImageUp,
  SearchCheck,
  ShieldAlert,
  UserCircle2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ModeSwitch } from "@/components/mode-switch"
import { supabase } from "@/lib/supabase"
import type { PostAnalysis } from "@/lib/types"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// When `accountUsername` is set, the post is attributed to the signed-in user
// and the username field is locked. It's null only in demo mode (no Supabase),
// where posting isn't wired up anyway.
export function UploadForm({
  accountUsername,
}: {
  accountUsername: string | null
}) {
  const router = useRouter()
  const lockedUsername = Boolean(accountUsername)
  const [username, setUsername] = useState(accountUsername ?? "")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isPolitical, setIsPolitical] = useState(false)
  // Uploader's required AI/authentic self-declaration. Null until they pick one.
  const [selfDeclaredAi, setSelfDeclaredAi] = useState<boolean | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModerationWarning, setShowModerationWarning] = useState(false)
  const [pendingModeration, setPendingModeration] = useState<PostAnalysis | null>(
    null
  )
  const [pendingImageUrl, setPendingImageUrl] = useState("")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Select a file and build a preview object URL for it. The effect below
  // revokes the previous URL when it changes or the component unmounts.
  const selectFile = (next: File | null) => {
    setFile(next)
    setPreviewUrl(next ? URL.createObjectURL(next) : null)
  }

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

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
      self_declared_ai: selfDeclaredAi,
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

    if (selfDeclaredAi === null) {
      setError("Please indicate whether this image is AI-generated.")
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
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" size="sm" asChild className="w-fit">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Feed
          </Link>
        </Button>
        <div className="w-full sm:min-w-72 sm:max-w-xs">
          <ModeSwitch compact />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Create Mode
        </p>
        <h1 className="mt-1 text-2xl font-bold">Upload Post</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share an image and caption. TruthGuard analyzes provenance, AI risk,
          OCR, and political context before the post enters the feed.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { label: "Upload", icon: FileCheck2 },
            { label: "Analyze", icon: SearchCheck },
            { label: "Label or Review", icon: ShieldAlert },
          ].map((step) => {
            const Icon = step.icon
            return (
              <div
                key={step.label}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <Icon className="size-4 text-primary" />
                {step.label}
              </div>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="space-y-2">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          {lockedUsername ? (
            <>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium">
                <UserCircle2 className="size-4 text-primary" />
                {username}
              </div>
              <p className="text-xs text-muted-foreground">
                Posting as your account.
              </p>
            </>
          ) : (
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              required
            />
          )}
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
          <input
            ref={fileInputRef}
            id="image"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => selectFile(e.target.files?.[0] ?? null)}
          />
          {file && previewUrl ? (
            <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Selected upload preview"
                className="max-h-72 w-full object-contain"
              />
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => selectFile(null)}
                  >
                    <X className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const dropped = e.dataTransfer.files?.[0]
                if (dropped && dropped.type.startsWith("image/")) {
                  selectFile(dropped)
                }
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-10 text-center transition-colors",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30 hover:bg-muted/50"
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-full bg-foreground text-background">
                <ImageUp className="size-5" />
              </div>
              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">PNG, JPG, or GIF</p>
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            We&apos;ll run an AI image classifier on upload to detect synthetic
            political media.
          </p>
        </div>

        <fieldset className="space-y-2 rounded-md border border-border bg-muted/30 px-3 py-2.5">
          <legend className="text-sm font-medium">
            Is this image AI-generated? <span className="text-destructive">*</span>
          </legend>
          <p className="text-xs text-muted-foreground">
            Required. Label your own content so viewers and moderators have your
            declaration.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {[
              { label: "AI-generated", value: true },
              { label: "Not AI-generated", value: false },
            ].map((option) => {
              const checked = selfDeclaredAi === option.value
              return (
                <label
                  key={option.label}
                  className={cn(
                    "flex flex-1 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-center text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-border bg-card/60 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <input
                    type="radio"
                    name="self-declared-ai"
                    checked={checked}
                    onChange={() => setSelfDeclaredAi(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              )
            })}
          </div>
        </fieldset>

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
