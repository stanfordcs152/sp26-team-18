# sp26-team-18 — CS 152 Spring 2026 Project - TruthGuard(WIP)

##
This project aims at targeting AI-generated political disinformation on online social platforms, mainly in the form of images. Our
approach towards preventing this on our platform includes detection, provenance, and a moderation queue. Users can report images
for political disinformation, where a heauristic AI score and checks for a cryptographic signature provide moderators with more 
data/information before they make their decision. 

## Tech Stack
**Framework:** Next.js 16.2.6 (App Router, Turbopack), Typescript \
**UI:** Tailwind CSS, shadcn/ui, Radix UI, base-ui \
**Backend:** Supabase, OpenAI, AWS \
**Provenance Check:** @trustnxt/c2pa-ts (pure TS) running on Node serverless route \
**Deployment:** Vercel \
**CI:** Github Actions (.github/workflows/ci.yml) \

## Local Development
Required env vars in env.local:
* NEXT_PUBLIC_SUPABASE_URL
* NEXT_PUBLIC_SUPABASE_ANON_KEY 

Then, apply these migrations in the following order:
1. supabase/migrations/0002_phase4_reports_and_status.sql
2. supabase/migrations/0003_phase3_c2pa_and_political.sql
3. supabase/migrations/0004_analysis_and_risk.sql
4. supabase/migrations/0005_posts_moderation_policy.sql
5. supabase/migrations/0006_profiles_and_auth.sql
6. supabase/migrations/0007_account_age_helper.sql
7. supabase/migrations/0008_posts_performance_indexes.sql
8. supabase/migrations/0009_moderation_actions_and_status.sql

Commands:
* npm install
* npm run dev -> http://localhost:3000
* npm run lint
* npm run build
* npm test

## Deployment / CI
CI is located at .github/workflows/ci.yml, which:
* Runs on push/PR to main
* Uses Node 20, npm ci, runs npm test -- --passWithNoTests
* Auto-deploys to Vercel on push-to-main using VERCEL_TOKEN secret

## AI Usage Statement

We used Claude Code & Cursor to generate code for the frontend and backend of the webapp along with the scaffolding of the app. 
AI-generated code was reviewed inside of pull requests along with being tested when possible to prevent errors going into main. 
We also used Claude Code to generate tests.

## Feedback Loop Status

Moderator decisions are stored persistently in Supabase. Each approve, remove,
or escalate action updates the post's `moderation_status`, timestamps the review,
records the reviewer, updates downstream feed visibility, and writes a row to
`moderation_actions`.

The `moderation_actions` table is the feedback dataset for future classifier
work: recent rows can be exported with `exportRecentModerationExamples()` in
`src/lib/moderation-actions.ts` and converted into prompt examples, threshold
tuning records, or retraining labels.

Current limitation: those stored decisions are not yet consumed automatically by
the production classifier, prompt few-shot examples, deterministic rules, or ML
retraining jobs. That closed-loop training/tuning step is future work.

## Links

**PRD:** https://github.com/stanfordcs152/sp26-team-18/blob/cleanupFixes/docs/PRD.md
**Website Deployment:** sp26-team-18-cgdz226op-cs152-project.vercel.app

**Team:** 
    @caeleywoo
    @Jaunyy
    @Luis C
    @Zareef13
    @jlasiota
