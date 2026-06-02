-- Phase 8: uploader AI self-declaration.
--
-- Every upload now requires the author to label whether the image is
-- AI-generated. Stored as a nullable boolean:
--   true  = uploader says AI-generated
--   false = uploader says authentic (not AI-generated)
-- Nullable so posts created before this migration (or via the legacy insert
-- fallback) remain valid.
-- Idempotent: safe to re-run.

alter table public.posts
  add column if not exists self_declared_ai boolean;
