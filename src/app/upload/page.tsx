"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import type { C2paStatus } from "@/lib/types"

export default function UploadPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isPolitical, setIsPolitical] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)

  const runC2paCheck = async (
    f: File
  ): Promise<{ status: C2paStatus; metadata: unknown }> => {
    const buf = await f.arrayBuffer()
    const res = await fetch("/api/c2pa-check", {
      method: "POST",
      headers: { "content-type": f.type || "application/octet-stream" },
      body: buf,
    })
    if (!res.ok) {
      // Treat any failure as missing — we don't want to block uploads on a
      // c2pa-ts crash.
      return { status: "missing", metadata: null }
    }
    return (await res.json()) as { status: C2paStatus; metadata: unknown }
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

    setStatusMsg("Checking Content Credentials...")
    const c2pa = await runC2paCheck(file)

    setStatusMsg("Uploading image...")
    const fileExt = file.name.split(".").pop() ?? "jpg"
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setSubmitting(false)
      setStatusMsg(null)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData.publicUrl

    setStatusMsg("Saving post...")
    // Try with the Phase 3 columns first; if they don't exist yet the legacy
    // insert still goes through.
    const phase3Insert = await supabase.from("posts").insert({
      image_url: imageUrl,
      caption: caption.trim(),
      username: username.trim(),
      is_flagged: false,
      confidence_score: 0,
      c2pa_status: c2pa.status,
      c2pa_metadata: c2pa.metadata,
      is_political: isPolitical,
    })

    if (phase3Insert.error) {
      const legacy = await supabase.from("posts").insert({
        image_url: imageUrl,
        caption: caption.trim(),
        username: username.trim(),
        is_flagged: false,
        confidence_score: 0,
      })
      if (legacy.error) {
        setError(legacy.error.message)
        setSubmitting(false)
        setStatusMsg(null)
        return
      }
    }

    setStatusMsg(null)
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
            We&apos;ll check this image for Content Credentials (C2PA) on upload.
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

        {statusMsg ? (
          <p className="text-sm text-muted-foreground">{statusMsg}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload Post"}
        </Button>
      </form>
    </main>
  )
}
