-- Phase 6: User profiles + role-based moderator auth.
--
-- Replaces the shared-password moderator gate with Supabase Auth. Adds a
-- profiles table linked 1:1 to auth.users, an is_moderator() helper, a trigger
-- that provisions a profile for every new auth user, and tightens the
-- previously permissive RLS (0002 reports / 0005 posts) so only authenticated
-- moderators can read the report queue and change post moderation status.
--
-- What stays open: the public feed keeps anonymous SELECT on posts, uploads
-- keep anonymous INSERT on posts, and readers keep anonymous INSERT on reports.
-- Idempotent: safe to re-run.

-- 1. Role enum (admin | moderator | user)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'moderator', 'user');
  end if;
end$$;

-- 2. Profiles table — one row per auth user.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  email text,
  role user_role not null default 'user',
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

-- A signed-in user can read their own profile (needed to resolve their role).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

-- 3. is_moderator(): true when the current request is by a moderator/admin.
-- SECURITY DEFINER so the lookup bypasses profiles' own RLS (avoids recursion)
-- and can be reused inside other tables' policies.
create or replace function public.is_moderator()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('moderator', 'admin')
  );
$$;

-- 4. Provision a profile whenever a new auth user is created. Username falls
-- back to the email local-part; role defaults to 'user'. Promote a moderator
-- manually after signup, e.g.:
--   update public.profiles set role = 'moderator' where email = 'mod@example.com';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Tighten reports RLS (was permissive in 0002). Readers keep anonymous
-- INSERT; only moderators can read the queue and resolve reports.
drop policy if exists "reports_select_all" on public.reports;
create policy "reports_select_moderator" on public.reports
  for select using (public.is_moderator());

drop policy if exists "reports_update_all" on public.reports;
create policy "reports_update_moderator" on public.reports
  for update using (public.is_moderator()) with check (public.is_moderator());

-- 6. Tighten posts UPDATE (was permissive in 0005). The public feed keeps
-- SELECT and uploads keep INSERT; only moderators can change post status.
drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_moderator" on public.posts
  for update using (public.is_moderator()) with check (public.is_moderator());
