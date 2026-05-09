import Link from "next/link"
import {
  Shield,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock3,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockModerationQueue, mockModerationStats } from "@/lib/mock-data"
import { ModerationStatsBar } from "@/components/moderation-stats"
import { ModerationQueue } from "@/components/moderation-queue"

export const metadata = {
  title: "Moderation Dashboard - TruthGuard",
  description: "Review and moderate flagged AI-generated content",
}

export default function ModerationPage() {
  const criticalCount = mockModerationQueue.filter(
    (i) => i.priority === "critical"
  ).length

  const highRiskCount = mockModerationQueue.filter(
    (i) => i.priority === "high" || i.priority === "critical"
  ).length

  const pendingReviewCount = mockModerationQueue.length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/">
                  <ArrowLeft className="size-5" />
                  <span className="sr-only">Back to Feed</span>
                </Link>
              </Button>
              <div className="flex items-center gap-3">
                <Shield className="size-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Moderation Dashboard</h1>
                  <p className="text-sm text-muted-foreground">
                    Review flagged content for AI-generated misinformation
                  </p>
                </div>
              </div>
            </div>
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">
                <AlertTriangle className="size-4" />
                <span className="text-sm font-medium">
                  {criticalCount} critical item{criticalCount > 1 ? "s" : ""} pending
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Risk Dashboard */}
        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Posts Under Review</p>
              <Clock3 className="size-5 text-yellow-500" />
            </div>

            <p className="text-3xl font-bold">{pendingReviewCount}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">High Risk Content</p>
              <AlertTriangle className="size-5 text-red-500" />
            </div>

            <p className="text-3xl font-bold">{highRiskCount}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Approved Posts</p>
              <CheckCircle2 className="size-5 text-green-500" />
            </div>

            <p className="text-3xl font-bold">12</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Escalated Cases</p>
              <BarChart3 className="size-5 text-blue-500" />
            </div>

            <p className="text-3xl font-bold">3</p>
          </div>
        </section>

        {/* Stats */}
        <section className="mb-8">
          <ModerationStatsBar stats={mockModerationStats} />
        </section>

        {/* Queue */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Review Queue</h2>
            <span className="text-sm text-muted-foreground">
              {mockModerationQueue.length} items pending review
            </span>
          </div>
          <div className="space-y-4">
            <ModerationQueue items={mockModerationQueue} />

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold">
                    Moderator Actions
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    Reviewers can approve, reject, or escalate suspicious posts.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <Button className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-2 size-4" />
                  Approve Selected
                </Button>

                <Button variant="destructive">
                  <XCircle className="mr-2 size-4" />
                  Reject Content
                </Button>

                <Button variant="outline">
                  <AlertTriangle className="mr-2 size-4" />
                  Escalate for Review
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
