"use client"

import { FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"

export default function UploadPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [caption, setCaption] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    const fileExt = file.name.split(".").pop() ?? "jpg"
    const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setSubmitting(false)
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from("post-images")
      .getPublicUrl(filePath)

    const imageUrl = publicUrlData.publicUrl

    const { error: insertError } = await supabase.from("posts").insert({
      image_url: imageUrl,
      caption: caption.trim(),
      username: username.trim(),
      is_flagged: false,
      confidence_score: 0,
    })

    if (insertError) {
      setError(insertError.message)
      setSubmitting(false)
      return
    }

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
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Uploading..." : "Upload Post"}
        </Button>
      </form>
    </main>
  )
}
