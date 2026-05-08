"use client"

import { useState, type FormEvent } from "react"
import { Flag } from "lucide-react"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { submitReport } from "@/lib/moderation-actions"
import type { ReportReason } from "@/lib/types"

interface ReportModalProps {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  {
    value: "ai_generated_political",
    label: "AI-generated political media",
  },
  { value: "other", label: "Other" },
]

export function ReportModal({ postId, open, onOpenChange }: ReportModalProps) {
  const [reason, setReason] = useState<ReportReason>("ai_generated_political")
  const [details, setDetails] = useState("")
  const [reporter, setReporter] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const reset = () => {
    setReason("ai_generated_political")
    setDetails("")
    setReporter("")
    setSubmitting(false)
    setError(null)
    setSubmitted(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await submitReport({
      postId,
      reporterUsername: reporter,
      reason,
      details,
    })

    setSubmitting(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setSubmitted(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4 text-red-500" />
            Report post
          </DialogTitle>
          <DialogDescription>
            Tell us why this post should be reviewed. Reports go to our
            moderation team.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="space-y-4">
            <p className="text-sm">
              Thanks — your report has been submitted. A moderator will review
              this post.
            </p>
            <DialogFooter>
              <DialogClose render={<Button />}>Close</DialogClose>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="report-reason" className="text-sm font-medium">
                Reason
              </label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="report-reporter" className="text-sm font-medium">
                Your username
              </label>
              <Input
                id="report-reporter"
                value={reporter}
                onChange={(e) => setReporter(e.target.value)}
                placeholder="your_username"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="report-details" className="text-sm font-medium">
                Details (optional)
              </label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Anything else that helps the moderator?"
                rows={4}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <DialogFooter>
              <DialogClose
                render={
                  <Button type="button" variant="outline" disabled={submitting} />
                }
              >
                Cancel
              </DialogClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit report"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
