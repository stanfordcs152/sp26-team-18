import { Shield } from "lucide-react"
import { ModerationDashboard } from "@/components/moderation-dashboard"
import { ModeSwitch } from "@/components/mode-switch"
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
  // Demo mode: `/moderation` should load immediately from the product mode
  // switch. If a signed-in moderator session exists, show live RLS-backed data;
  // otherwise fall back to the polished mock console.
  const configured = Boolean(getSupabaseEnv())
  let data: ModerationQueueData | null = null
  let usingDemoData = true

  if (configured) {
    const profile = await getModeratorProfile()
    if (profile && isModeratorRole(profile.role)) {
      data = await loadModerationQueue()
      usingDemoData = !data
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-foreground text-background">
                  <Shield className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Moderator Mode
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight">Trust & Safety Console</h1>
                  <p className="text-sm text-muted-foreground">
                    Review flagged content for AI-generated misinformation
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden min-w-80 sm:block">
                <ModeSwitch compact />
              </div>
            </div>
          </div>
          <div className="mt-3 sm:hidden">
            <ModeSwitch compact />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <ModerationDashboard configured={!usingDemoData} data={data} />
      </main>
    </div>
  )
}
