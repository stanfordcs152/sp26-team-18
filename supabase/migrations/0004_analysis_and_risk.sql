-- Phase 5: Persist AI image-classifier output on posts.
--
-- The /api/analyze pipeline (OpenAI Vision + AWS Rekognition) produces a
-- structured analysis at upload time, but until now the result was discarded
-- before the post hit the database. This migration stores the full pipeline
-- output alongside the existing flags so the moderator dashboard can surface
-- risk score, reasons, public-figure matches, and OCR keywords.
--
-- Idempotent: safe to re-run.

alter table public.posts
  add column if not exists analysis jsonb,
  add column if not exists risk_score numeric(4,3),
  add column if not exists risk_level text
    check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

create index if not exists posts_risk_level_idx on public.posts (risk_level);
create index if not exists posts_risk_score_idx on public.posts (risk_score desc);
