# sp26-team-18
CS 152 Spring 2026 project repository for Team 18 — **VeriFeed / TruthGuard**, a Trust & Safety MVP for detecting AI-generated political disinformation.

## Local development

```bash
npm install
npm run dev    # http://localhost:3000
npm test       # vitest
npm run lint
npm run build
```

## Required environment variables

Set these in `.env.local` (never commit). All are required for full functionality.

### Supabase (client + storage)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### AI image classifier (called from `/api/analyze`)
- `OPENAI_API_KEY` — used by the OCR + Vision steps
- `AWS_REGION` — typically `us-east-1`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Moderator access gate
- `MODERATOR_PASSWORD` — shared secret. Anyone with it can access the dashboard.
- `MODERATOR_SESSION_SECRET` — random 32-byte hex (e.g. `openssl rand -hex 32`). Used to HMAC-sign session cookies.

## Database migrations

Apply in order via the Supabase Dashboard SQL Editor:

1. `supabase/migrations/0002_phase4_reports_and_status.sql`
2. `supabase/migrations/0003_phase3_c2pa_political.sql`
3. `supabase/migrations/0004_analysis_and_risk.sql`

The moderation queue gracefully falls back to the legacy column set if 0004 hasn't been applied, so partial migration won't break the demo.

## Moderator access

The `/moderation/*` routes are gated by a single shared password (`MODERATOR_PASSWORD`). On successful login an HMAC-signed cookie is set for 8 hours; the Next.js `proxy.ts` checks it on every request to a moderation route.

This is intentionally a **shared-secret demo gate**, not per-moderator auth. The moderator's free-text username on each resolution is self-attested. A real deployment should switch to Supabase Auth or a similar provider with per-user audit trails.

To sign in:
1. Visit `/moderation` while signed out — you'll be redirected to `/moderator-login`.
2. Enter the shared `MODERATOR_PASSWORD`.
3. Use the **Sign out** button in the dashboard header to clear the cookie.

## Known limitations

- Server-side enforcement of report resolutions still relies on Supabase RLS rather than the moderator session, so the password gate only protects the UI.
- `avgReviewTime` in the dashboard is a placeholder until an audit log table is added.
- The image classifier instantiates its OpenAI client at module load, so `OPENAI_API_KEY` must be present even at build time. Use a non-empty placeholder if you only need to type-check.
