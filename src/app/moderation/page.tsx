import Link from "next/link"
import { Shield, AlertTriangle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { mockModerationQueue, mockModerationStats } from "@/lib/mock-data"
import { ModerationStatsBar } from "@/components/moderation-stats"
import { ModerationQueueLive } from "@/components/moderation-queue-live"

export const metadata = {
  title: "Moderation Dashboard - TruthGuard",
  description: "Review and moderate flagged AI-generated content",
}

export default function ModerationPage() {
  const criticalCount = mockModerationQueue.filter(
    (i) => i.priority === "critical"
  ).length

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
        {/* Stats */}
        <section className="mb-8">
          <ModerationStatsBar stats={mockModerationStats} />
        </section>

        {/* Queue */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Review Queue</h2>
          </div>
          <ModerationQueueLive />
        </section>
      </main>
    </div>
  )
}
