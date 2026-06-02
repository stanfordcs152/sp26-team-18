-- Milestone 3: durable moderation decisions + feedback-loop audit trail.
--
-- Adds explicit moderation status/timestamps to posts and records every
-- moderator decision in moderation_actions. Policies are intentionally
-- permissive enough for the demo/judge flow, where Moderator Mode does not
-- require sign-in.

alter table public.posts
  add column if not exists moderation_status text not null default 'approved'
    check (moderation_status in ('pending_review', 'approved', 'removed', 'escalated')),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by text,
  add column if not exists removed_at timestamptz;

update public.posts
set moderation_status = case
  when status = 'removed' then 'removed'
  when is_flagged = true then 'pending_review'
  when risk_level in ('HIGH', 'CRITICAL') and moderator_note is null then 'pending_review'
  else moderation_status
end;

create index if not exists posts_moderation_status_idx
  on public.posts (moderation_status, risk_score desc, created_at desc);
create index if not exists posts_reviewed_at_idx
  on public.posts (reviewed_at desc);
create index if not exists posts_username_moderation_idx
  on public.posts (username, moderation_status, created_at desc);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  username text not null,
  action text not null check (action in ('approved', 'removed', 'escalated')),
  moderator text not null default 'demo-moderator',
  note text,
  post_caption text,
  previous_status text,
  new_status text not null,
  risk_level text,
  risk_score numeric(4,3),
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_post_id_idx
  on public.moderation_actions (post_id, created_at desc);
create index if not exists moderation_actions_username_idx
  on public.moderation_actions (username, created_at desc);
create index if not exists moderation_actions_created_at_idx
  on public.moderation_actions (created_at desc);
create index if not exists moderation_actions_action_created_at_idx
  on public.moderation_actions (action, created_at desc);

alter table public.moderation_actions enable row level security;

drop policy if exists "moderation_actions_select_all" on public.moderation_actions;
create policy "moderation_actions_select_all" on public.moderation_actions
  for select using (true);

drop policy if exists "moderation_actions_insert_all" on public.moderation_actions;
create policy "moderation_actions_insert_all" on public.moderation_actions
  for insert with check (true);

-- Keep the judge/demo moderator flow usable without sign-in. This supersedes
-- the stricter migration 0006 update policy for posts.
drop policy if exists "posts_update_moderator" on public.posts;
drop policy if exists "posts_update_all" on public.posts;
create policy "posts_update_demo_or_moderator" on public.posts
  for update using (true) with check (true);
