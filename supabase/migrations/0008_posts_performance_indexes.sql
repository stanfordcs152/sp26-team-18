-- Speed up feed and moderation queue reads.
--
-- Feed:
--   latest visible posts ordered by created_at desc.
-- Moderator queue:
--   flagged/high-risk posts ordered by risk_score desc, then created_at desc.
-- Idempotent: safe to re-run.

create index if not exists posts_created_at_idx
  on public.posts (created_at desc);

create index if not exists posts_flagged_idx
  on public.posts (is_flagged, risk_score desc, created_at desc);

create index if not exists posts_risk_level_idx
  on public.posts (risk_level);
