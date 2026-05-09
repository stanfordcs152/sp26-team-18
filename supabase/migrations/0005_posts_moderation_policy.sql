-- Phase 4 follow-up: allow moderator UI (anon key) to update post status.
--
-- Without this policy, supabase-js returns no error but updates 0 rows when
-- RLS blocks the write, so the moderation dashboard reports "Resolved as
-- removed" while the feed keeps showing the post. Mirrors the permissive
-- posture used by `reports_update_all` in migration 0002.

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all" on public.posts
  for select using (true);

drop policy if exists "posts_insert_all" on public.posts;
create policy "posts_insert_all" on public.posts
  for insert with check (true);

drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_all" on public.posts
  for update using (true) with check (true);
