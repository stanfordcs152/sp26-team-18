import Link from "next/link"
import { redirect } from "next/navigation"
import { Shield, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModerationDashboard } from "@/components/moderation-dashboard"
import {
  getModeratorProfile,
  getSupabaseEnv,
  isModeratorRole,
} from "@/lib/moderator-auth"
import { loadModerationQueue } from "@/lib/moderation-queue-data"
import type { ModerationQueueData } from "@/lib/types"

export const metadata = {
  title: "Moderation Dashboard - TruthGuard",
  description: "Review and moderate flagged AI-generated content",
}

// Read fresh per request: the queue depends on the moderator's session cookie.
export const dynamic = "force-dynamic"

export default async function ModerationPage() {
  // The proxy already bounced anonymous requests to login (when Supabase is
  // configured). Here we verify the moderator role for real — the Edge proxy
  // can't do a DB lookup — and RLS is the final enforcement on the data.
  const configured = Boolean(getSupabaseEnv())
  let data: ModerationQueueData | null = null

  if (configured) {
    const profile = await getModeratorProfile()
    if (!profile || !isModeratorRole(profile.role)) {
      redirect("/moderator-login")
    }
    data = await loadModerationQueue()
  }

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
            <form action="/api/moderator/logout" method="post">
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <ModerationDashboard configured={configured} data={data} />
      </main>
    </div>
  )
}
