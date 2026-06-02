import Link from "next/link"
import { ArrowLeft, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModeSwitch } from "@/components/mode-switch"
import { UploadForm } from "@/components/upload-form"
import { getModeratorProfile, getSupabaseEnv } from "@/lib/moderator-auth"

// Read fresh per request: posting is gated on the session cookie.
export const dynamic = "force-dynamic"

export default async function UploadPage() {
  const configured = Boolean(getSupabaseEnv())
  const profile = configured ? await getModeratorProfile() : null

  // Only signed-in users can post (when Supabase is configured). Demo mode has
  // no auth, so fall through to the form, which already no-ops without Supabase.
  if (configured && !profile) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" size="sm" asChild className="w-fit">
            <Link href="/">
              <ArrowLeft className="size-4" />
              Feed
            </Link>
          </Button>
          <div className="w-full sm:min-w-72 sm:max-w-xs">
            <ModeSwitch compact />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in to post</CardTitle>
            <CardDescription>
              You need an account to upload and share posts on TruthGuard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login?redirect=/upload">
                <LogIn className="size-4" />
                Sign in or sign up
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return <UploadForm accountUsername={profile?.username ?? null} />
}
