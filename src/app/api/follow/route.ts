import { NextResponse } from "next/server"
import { getModeratorClient, getModeratorProfile } from "@/lib/moderator-auth"

// Follow (POST) / unfollow (DELETE) another user. Both require a signed-in
// session; the follower is always the current user (enforced again by the
// follows RLS in migration 0008). Body: { userId: string }.
async function getTargetId(request: Request): Promise<string | null> {
  const body = (await request.json().catch(() => null)) as
    | { userId?: string }
    | null
  return body?.userId?.trim() || null
}

export async function POST(request: Request) {
  const me = await getModeratorProfile()
  const client = await getModeratorClient()
  if (!me || !client) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const targetId = await getTargetId(request)
  if (!targetId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 })
  }
  if (targetId === me.id) {
    return NextResponse.json(
      { error: "You can't follow yourself." },
      { status: 400 }
    )
  }

  const { error } = await client
    .from("follows")
    .upsert(
      { follower_id: me.id, following_id: targetId },
      { onConflict: "follower_id,following_id", ignoreDuplicates: true }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, following: true })
}

export async function DELETE(request: Request) {
  const me = await getModeratorProfile()
  const client = await getModeratorClient()
  if (!me || !client) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }

  const targetId = await getTargetId(request)
  if (!targetId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 })
  }

  const { error } = await client
    .from("follows")
    .delete()
    .eq("follower_id", me.id)
    .eq("following_id", targetId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, following: false })
}
