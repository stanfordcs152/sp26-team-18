import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { SidebarNav } from "@/components/sidebar-nav"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { FollowButton } from "@/components/follow-button"
import { getModeratorProfile, getSupabaseEnv } from "@/lib/moderator-auth"
import {
  getFollowers,
  getFollowing,
  getPublicProfileByUsername,
  getReadClient,
} from "@/lib/follows"

export const dynamic = "force-dynamic"

const TITLES = {
  followers: "Followers",
  following: "Following",
} as const

export default async function FollowListPage({
  params,
}: {
  params: Promise<{ username: string; rel: string }>
}) {
  const { username, rel } = await params
  if (rel !== "followers" && rel !== "following") notFound()
  const handle = decodeURIComponent(username)

  if (!getSupabaseEnv()) notFound()
  const client = await getReadClient()
  if (!client) notFound()

  const profile = await getPublicProfileByUsername(client, handle)
  if (!profile) notFound()

  const people =
    rel === "followers"
      ? await getFollowers(client, profile.id)
      : await getFollowing(client, profile.id)

  // Resolve the viewer's own follow set so each row's button shows the right
  // state, and so we can hide the button on the viewer's own row.
  const me = await getModeratorProfile()
  const myFollowingIds = me
    ? new Set((await getFollowing(client, me.id)).map((p) => p.id))
    : new Set<string>()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 border-r border-border md:block xl:w-[275px]">
          <SidebarNav />
        </aside>

        <main className="max-w-[600px] flex-1 border-r border-border pb-20 md:pb-0">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/u/${profile.username}`}>
                <ArrowLeft className="size-5" />
                <span className="sr-only">Back to profile</span>
              </Link>
            </Button>
            <div>
              <h1 className="text-lg font-bold">{TITLES[rel]}</h1>
              <p className="text-xs text-muted-foreground">
                @{profile.username}
              </p>
            </div>
          </header>

          {people.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {rel === "followers"
                ? "No followers yet."
                : "Not following anyone yet."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <Link
                    href={`/u/${person.username}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <Avatar>
                      <AvatarFallback>
                        {person.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate font-medium">
                      @{person.username}
                    </span>
                  </Link>
                  {me && me.id !== person.id ? (
                    <FollowButton
                      userId={person.id}
                      initialFollowing={myFollowingIds.has(person.id)}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
