// Server-side helpers for the follow / friends graph (migration 0008).
//
// Reads go through the signed-in user's Supabase client (so follows RLS sees
// auth.uid()) or, for signed-out visitors, a plain anon client — enough to read
// the public_profiles view and the public posts feed. "Friends" are derived:
// two users are friends when they mutually follow each other.

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import {
  MODERATOR_COOKIE,
  type ModeratorRole,
  createAuthedClient,
  getSupabaseEnv,
} from "@/lib/moderator-auth"

export interface PublicProfile {
  id: string
  username: string
  role: ModeratorRole
  created_at: string
}

export interface FollowStats {
  followers: number
  following: number
  friends: number
}

export interface Relationship {
  isFollowing: boolean // viewer -> target
  followsYou: boolean // target -> viewer
  isFriend: boolean
}

// A client for reads: the authed (cookie) client when signed in, else anon.
// Returns null only when Supabase isn't configured.
export async function getReadClient(): Promise<SupabaseClient | null> {
  const env = getSupabaseEnv()
  if (!env) return null
  const token = (await cookies()).get(MODERATOR_COOKIE)?.value
  if (token) return createAuthedClient(token)
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getPublicProfileByUsername(
  client: SupabaseClient,
  username: string
): Promise<PublicProfile | null> {
  const { data } = await client
    .from("public_profiles")
    .select("id, username, role, created_at")
    .eq("username", username)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  return (data as PublicProfile | null) ?? null
}

async function profilesByIds(
  client: SupabaseClient,
  ids: string[]
): Promise<PublicProfile[]> {
  if (ids.length === 0) return []
  const { data } = await client
    .from("public_profiles")
    .select("id, username, role, created_at")
    .in("id", ids)
  return (data ?? []) as PublicProfile[]
}

async function getFollowingIds(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await client
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
  return (data ?? []).map((r) => r.following_id as string)
}

async function getFollowerIds(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await client
    .from("follows")
    .select("follower_id")
    .eq("following_id", userId)
  return (data ?? []).map((r) => r.follower_id as string)
}

export async function getFollowing(
  client: SupabaseClient,
  userId: string
): Promise<PublicProfile[]> {
  return profilesByIds(client, await getFollowingIds(client, userId))
}

export async function getFollowers(
  client: SupabaseClient,
  userId: string
): Promise<PublicProfile[]> {
  return profilesByIds(client, await getFollowerIds(client, userId))
}

export async function getFollowStats(
  client: SupabaseClient,
  userId: string
): Promise<FollowStats> {
  const [followingIds, followerIds] = await Promise.all([
    getFollowingIds(client, userId),
    getFollowerIds(client, userId),
  ])
  const followerSet = new Set(followerIds)
  const friends = followingIds.filter((id) => followerSet.has(id)).length
  return {
    followers: followerIds.length,
    following: followingIds.length,
    friends,
  }
}

// Usernames the given user follows — used to filter the "Following" feed tab.
export async function getFollowingUsernames(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const following = await getFollowing(client, userId)
  return following.map((p) => p.username)
}

export async function getRelationship(
  client: SupabaseClient,
  viewerId: string,
  targetId: string
): Promise<Relationship> {
  const [outgoing, incoming] = await Promise.all([
    client
      .from("follows")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("following_id", targetId)
      .maybeSingle(),
    client
      .from("follows")
      .select("follower_id")
      .eq("follower_id", targetId)
      .eq("following_id", viewerId)
      .maybeSingle(),
  ])
  const isFollowing = Boolean(outgoing.data)
  const followsYou = Boolean(incoming.data)
  return { isFollowing, followsYou, isFriend: isFollowing && followsYou }
}
