-- Phase 7: support account-age-based upload rate limiting.
--
-- The upload analyzer (src/app/api/analyze) throttles uploads from new accounts
-- using profiles.created_at. Uploads are anonymous (not a signed-in flow), so
-- the request can't read the uploader's profile under the "select own" RLS from
-- migration 0006. This SECURITY DEFINER helper — modelled on is_moderator() in
-- 0006 — exposes ONLY an account's creation time, looked up by username, so the
-- limiter can compute account age without widening profile visibility (email,
-- role, etc. stay hidden).
-- Idempotent: safe to re-run.

create or replace function public.account_created_at(p_username text)
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select created_at
  from public.profiles
  where username = p_username
  order by created_at asc
  limit 1;
$$;

grant execute on function public.account_created_at(text) to anon, authenticated;
