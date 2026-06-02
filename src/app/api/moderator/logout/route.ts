import { NextResponse } from "next/server"
import { MODERATOR_COOKIE } from "@/lib/moderator-cookie"

export async function POST(request: Request) {
  // The Sign Out form posts here; redirect back to login afterwards so the
  // user lands somewhere sensible without needing JS to handle the response.
  const response = NextResponse.redirect(
    new URL("/moderator-login", request.url),
    { status: 303 }
  )
  response.cookies.set({
    name: MODERATOR_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  })
  return response
}
