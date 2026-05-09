-- Phase 4: Reporting + moderator queue
-- Adds post status/moderator_note columns and a reports table.
-- Note: Auth/profiles are deferred for Phase 4. We use plain text usernames
-- for the reporter and moderator until Supabase Auth is wired up.

-- 1. Extend posts with moderation status fields
alter table public.posts
  add column if not exists status text not null default 'visible'
    check (status in ('visible', 'labeled', 'removed')),
  add column if not exists moderator_note text;

create index if not exists posts_status_idx on public.posts (status);

-- 2. Reports table
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  reporter_username text not null,
  reason text not null
    check (reason in ('ai_generated_political', 'other')),
  details text,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  resolution text
    check (resolution in ('no_action', 'labeled', 'removed')),
  resolved_by text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_post_id_idx on public.reports (post_id);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- 3. RLS policies (permissive for MVP — auth gating comes later)
alter table public.reports enable row level security;

drop policy if exists "reports_select_all" on public.reports;
create policy "reports_select_all" on public.reports
  for select using (true);

drop policy if exists "reports_insert_all" on public.reports;
create policy "reports_insert_all" on public.reports
  for insert with check (true);

drop policy if exists "reports_update_all" on public.reports;
create policy "reports_update_all" on public.reports
  for update using (true) with check (true);
