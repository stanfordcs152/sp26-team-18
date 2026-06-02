// Next.js renamed `middleware` to `proxy`.
//
// CS152 poster demo mode intentionally leaves `/moderation` open so judges can
// switch between User Mode and Moderator Mode without a login step. The
// moderator login route and API still exist for future authenticated flows, but
// the main product-mode switch should behave like a UI toggle during demo.

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export const config = {
  matcher: ["/moderation/:path*"],
}

export function proxy(request: NextRequest) {
  void request
  return NextResponse.next()
}
