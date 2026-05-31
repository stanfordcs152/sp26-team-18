import { NextRequest, NextResponse } from "next/server";
import { runAnalysisPipeline } from "@/lib/analyzers/pipeline";
import { supabase } from "@/lib/supabase";

// Accounts younger than this many days are throttled; older accounts are
// unlimited. Within the window, an account may complete at most
// NEW_ACCOUNT_DAILY_UPLOAD_CAP uploads per rolling 24h before /api/analyze
// (the chokepoint every upload passes through) starts returning 429.
const NEW_ACCOUNT_WINDOW_DAYS = 7;
const NEW_ACCOUNT_DAILY_UPLOAD_CAP = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

// Returns a 429 response if the named account is new and has already hit its
// daily upload cap; otherwise null (allow). Counts existing `posts` rows for
// the username in the last 24h — each completed upload is one such row, so an
// account with N posts today is blocked on its (N+1)th attempt.
//
// Degrades open: with no Supabase env vars (mock-data mode) or no matching
// profile we can't determine account age, so we don't throttle.
async function uploadRateLimitResponse(
  username: string
): Promise<NextResponse | null> {
  if (!supabase || !username) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", username)
    .maybeSingle();

  if (!profile) return null;

  const ageMs = Date.now() - new Date(profile.created_at).getTime();
  if (ageMs >= NEW_ACCOUNT_WINDOW_DAYS * DAY_MS) return null;

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("username", username)
    .gte("created_at", since);

  if ((count ?? 0) < NEW_ACCOUNT_DAILY_UPLOAD_CAP) return null;

  return NextResponse.json(
    {
      success: false,
      error: `New accounts are limited to ${NEW_ACCOUNT_DAILY_UPLOAD_CAP} uploads per day. Try again later.`,
    },
    { status: 429 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No image uploaded",
        },
        { status: 400 }
      );
    }

    const username = (formData.get("username") as string | null)?.trim() ?? "";

    const rateLimited = await uploadRateLimitResponse(username);
    if (rateLimited) return rateLimited;

    const arrayBuffer = await file.arrayBuffer();

    const imageBuffer = Buffer.from(arrayBuffer);

    const analysis = await runAnalysisPipeline(imageBuffer);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("Analysis pipeline failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Analysis failed",
      },
      { status: 500 }
    );
  }
}