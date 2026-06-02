-- Adds explicit timestamps for approve/escalate decisions so moderator
-- dashboard metric filters can be backed directly by persisted Supabase state.

alter table public.posts
  add column if not exists approved_at timestamptz,
  add column if not exists escalated_at timestamptz;

update public.posts
set approved_at = reviewed_at
where approved_at is null
  and moderation_status = 'approved'
  and reviewed_at is not null;

update public.posts
set escalated_at = reviewed_at
where escalated_at is null
  and moderation_status = 'escalated'
  and reviewed_at is not null;

create index if not exists posts_approved_at_idx
  on public.posts (approved_at desc);

create index if not exists posts_escalated_at_idx
  on public.posts (escalated_at desc);
