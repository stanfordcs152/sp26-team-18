-- Phase 6: Image-hash deduplication cache.
--
-- The /api/analyze pipeline (OpenAI Vision + AWS Rekognition) is expensive and
-- was re-run on every upload, even for byte-identical images. We now store a
-- SHA-256 of the image bytes on each post so the analyze flow can look up an
-- existing post by hash and reuse its stored analysis/risk_score/risk_level
-- instead of re-calling the upstream APIs.
--
-- Idempotent: safe to re-run.

alter table public.posts
  add column if not exists image_hash text;

create index if not exists posts_image_hash_idx on public.posts (image_hash);
