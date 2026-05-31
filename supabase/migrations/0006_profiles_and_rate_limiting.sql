-- Phase 6: Account-age-based upload rate limiting.
--
-- Introduces the long-deferred `profiles` table (see migration 0002, which
-- noted auth/profiles were postponed and that plain-text usernames are the
-- de-facto identity). Until Supabase Auth is wired up, a profile is keyed by
-- that same username, so `id` holds the username string rather than an
-- auth.users uuid.
--
-- `created_at` is what the /api/analyze route reads to decide whether an
-- account is "new" (younger than the configured window) and therefore subject
-- to a daily upload cap.
--
-- Idempotent: safe to re-run.

create table if not exists public.profiles (
  id text primary key,
  role text not null default 'user',
  created_at timestamptz not null default now()
);

-- RLS: permissive for MVP, mirroring the posture used by `posts`/`reports`
-- (the app reads/writes through the anon key; real auth gating comes later).
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

drop policy if exists "profiles_insert_all" on public.profiles;
create policy "profiles_insert_all" on public.profiles
  for insert with check (true);
