import { SidebarNav } from "@/components/sidebar-nav"
import { Feed } from "@/components/feed"
import { TrendingSidebar } from "@/components/trending-sidebar"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import Link from "next/link"
import { LogIn, ShieldCheck, Upload } from "lucide-react"
import { ModeSwitch } from "@/components/mode-switch"
import { Button } from "@/components/ui/button"
import { getModeratorProfile, getSupabaseEnv } from "@/lib/moderator-auth"

// Read fresh per request: the sign-in prompt depends on the session cookie.
export const dynamic = "force-dynamic"

export default async function HomePage() {
  // Prompt anonymous visitors to sign in/up. Only meaningful when Supabase is
  // configured; in demo mode there's no auth, so the prompt stays hidden.
  const configured = Boolean(getSupabaseEnv())
  const profile = configured ? await getModeratorProfile() : null
  const showAuthPrompt = configured && !profile

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 border-r border-border/70 md:block xl:w-[248px]">
          <SidebarNav />
        </aside>

        <main className="max-w-[660px] flex-1 border-r border-border/70 pb-20 md:pb-0">
          <header className="sticky top-0 z-10 border-b border-border/70 bg-background/85 backdrop-blur-xl">
            <div className="space-y-4 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    User Platform
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight">Home</h1>
                </div>
                <div className="hidden min-w-72 sm:block">
                  <ModeSwitch compact />
                </div>
              </div>
              <div className="sm:hidden">
                <ModeSwitch compact />
              </div>
              <div className="rounded-2xl border border-border/70 bg-card/60 p-3 transition-colors hover:bg-card">
                <Link
                  href="/upload"
                  className="flex items-center gap-3"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                    <Upload className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Create a post</p>
                    <p className="text-xs text-muted-foreground">
                      Upload media and receive AI/provenance status before it reaches the feed.
                    </p>
                  </div>
                  <div className="hidden items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 sm:inline-flex">
                    <ShieldCheck className="size-3.5" />
                    Analyzed on upload
                  </div>
                </Link>
              </div>
              {showAuthPrompt ? (
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/60 p-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                    <LogIn className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Join TruthGuard</p>
                    <p className="text-xs text-muted-foreground">
                      Sign up or log in to post and interact with the feed.
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/login?redirect=/">Sign up / Log in</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </header>

          <Feed />
        </main>

        <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 xl:block">
          <TrendingSidebar />
        </aside>
      </div>
      <MobileBottomNav />
    </div>
  )
}
