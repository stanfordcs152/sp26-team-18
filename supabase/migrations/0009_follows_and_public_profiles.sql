-- Phase 8: follows + friends system.
--
-- Adds a follows graph (follower_id -> following_id) on top of the profiles
-- table from 0006. "Friends" are derived, not stored: two users are friends
-- when they mutually follow each other (computed in app code).
--
-- Also adds a public_profiles view exposing only non-sensitive columns
-- (id, username, role, created_at) so signed-in users can view other people's
-- profiles and resolve the follow graph WITHOUT widening the "select own"
-- RLS on profiles (which keeps email private). The view is owned by the
-- migration role, so it reads profiles bypassing that table's RLS.
-- Idempotent: safe to re-run.

-- 1. Follows table — one row per (follower -> following) edge.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

-- Reverse-direction lookups (who follows X) hit following_id.
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- Anyone signed in can read the follow graph (needed for counts, follower/
-- following lists, and mutual-friend status across profiles).
drop policy if exists "follows_select_authenticated" on public.follows;
create policy "follows_select_authenticated" on public.follows
  for select using (auth.role() = 'authenticated');

-- You may only create follow edges where you are the follower.
drop policy if exists "follows_insert_own" on public.follows;
create policy "follows_insert_own" on public.follows
  for insert with check (follower_id = auth.uid());

-- You may only remove your own follow edges.
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_delete_own" on public.follows
  for delete using (follower_id = auth.uid());

-- 2. public_profiles view — non-sensitive profile columns, readable by all.
-- Email is intentionally omitted. Owned by the migration role so it bypasses
-- profiles' "select own" RLS.
create or replace view public.public_profiles as
  select id, username, role, created_at
  from public.profiles;

grant select on public.public_profiles to anon, authenticated;
