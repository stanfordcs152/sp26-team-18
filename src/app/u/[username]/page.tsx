import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { SidebarNav } from "@/components/sidebar-nav"
import { MobileBottomNav } from "@/components/mobile-bottom-nav"
import { FollowButton } from "@/components/follow-button"
import {
  getModeratorProfile,
  getSupabaseEnv,
  isModeratorRole,
} from "@/lib/moderator-auth"
import {
  getFollowStats,
  getPublicProfileByUsername,
  getReadClient,
  getRelationship,
} from "@/lib/follows"

export const dynamic = "force-dynamic"

type PostRow = {
  id: string
  created_at: string
  image_url: string
  caption: string | null
  is_flagged: boolean | null
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const handle = decodeURIComponent(username)

  // Profiles need Supabase; in demo mode there's no follow graph.
  if (!getSupabaseEnv()) notFound()
  const client = await getReadClient()
  if (!client) notFound()

  const profile = await getPublicProfileByUsername(client, handle)
  if (!profile) notFound()

  const me = await getModeratorProfile()
  const isSelf = me?.id === profile.id
  const stats = await getFollowStats(client, profile.id)
  const relationship =
    me && !isSelf ? await getRelationship(client, me.id, profile.id) : null

  const { data } = await client
    .from("posts")
    .select("id, created_at, image_url, caption, is_flagged")
    .eq("username", profile.username)
    .order("created_at", { ascending: false })
  const posts = (data ?? []) as PostRow[]

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 hidden h-screen w-[72px] shrink-0 border-r border-border md:block xl:w-[275px]">
          <SidebarNav />
        </aside>

        <main className="max-w-[600px] flex-1 border-r border-border pb-20 md:pb-0">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/">
                <ArrowLeft className="size-5" />
                <span className="sr-only">Back to feed</span>
              </Link>
            </Button>
            <h1 className="text-xl font-bold">@{profile.username}</h1>
          </header>

          <div className="p-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar size="lg">
                      <AvatarFallback>
                        {profile.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">
                          {profile.username}
                        </span>
                        {relationship?.isFriend ? (
                          <Badge>
                            <Users className="size-3.5" />
                            Friends
                          </Badge>
                        ) : relationship?.followsYou ? (
                          <Badge variant="outline">Follows you</Badge>
                        ) : null}
                      </div>
                      {isModeratorRole(profile.role) ? (
                        <Badge variant="outline" className="w-fit">
                          {profile.role}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {isSelf ? null : me ? (
                    <FollowButton
                      userId={profile.id}
                      initialFollowing={relationship?.isFollowing ?? false}
                    />
                  ) : (
                    <Button size="sm" asChild>
                      <Link href={`/login?redirect=/u/${profile.username}`}>
                        Follow
                      </Link>
                    </Button>
                  )}
                </div>

                <div className="mt-4 flex gap-5 text-sm">
                  <Link
                    href={`/u/${profile.username}/following`}
                    className="hover:underline"
                  >
                    <span className="font-bold">{stats.following}</span>{" "}
                    <span className="text-muted-foreground">Following</span>
                  </Link>
                  <Link
                    href={`/u/${profile.username}/followers`}
                    className="hover:underline"
                  >
                    <span className="font-bold">{stats.followers}</span>{" "}
                    <span className="text-muted-foreground">Followers</span>
                  </Link>
                  <span>
                    <span className="font-bold">{stats.friends}</span>{" "}
                    <span className="text-muted-foreground">Friends</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            <h2 className="mt-6 px-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Posts
            </h2>
            {posts.length === 0 ? (
              <p className="mt-3 px-1 text-sm text-muted-foreground">
                No posts yet.
              </p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="overflow-hidden rounded-lg border border-border bg-muted/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt={post.caption ?? "Post image"}
                      className="aspect-square w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  )
}
