import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SidebarNav } from "@/components/sidebar-nav"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import {
  getModeratorProfile,
  getSupabaseEnv,
  isModeratorRole,
} from "@/lib/moderator-auth"

export const metadata = {
  title: "Profile - TruthGuard",
  description: "Your TruthGuard account profile",
}

// Read fresh per request: the profile depends on the session cookie.
export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const configured = Boolean(getSupabaseEnv())
  const profile = configured ? await getModeratorProfile() : null

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 border-r border-border md:block xl:w-[275px]">
          <SidebarNav />
        </aside>

        <main className="max-w-[600px] flex-1 border-r border-border pb-20 md:pb-0">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border">
            <h1 className="px-4 py-3 text-xl font-bold">Profile</h1>
          </header>

          <div className="p-4">
            {profile ? (
              <Card>
                <CardHeader className="flex-row items-center gap-4">
                  <Avatar size="lg">
                    <AvatarFallback>
                      {profile.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid gap-1">
                    <CardTitle>{profile.username}</CardTitle>
                    {profile.email ? (
                      <CardDescription>{profile.email}</CardDescription>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4">
                  <Badge
                    variant={
                      isModeratorRole(profile.role) ? "default" : "outline"
                    }
                  >
                    {profile.role}
                  </Badge>
                  <form action="/api/auth/logout" method="post">
                    <Button variant="outline" size="sm" type="submit">
                      Sign out
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>You&apos;re not signed in</CardTitle>
                  <CardDescription>
                    {configured
                      ? "Sign in to view your profile."
                      : "Profiles are unavailable in demo mode."}
                  </CardDescription>
                </CardHeader>
                {configured ? (
                  <CardContent>
                    <Button asChild>
                      <Link href="/login?redirect=/profile">
                        Sign in or sign up
                      </Link>
                    </Button>
                  </CardContent>
                ) : null}
              </Card>
            )}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
