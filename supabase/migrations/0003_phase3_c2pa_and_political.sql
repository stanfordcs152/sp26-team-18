-- Phase 3 (retroactive): C2PA Content Credentials check + is_political flag
-- Adds the columns the spec calls for on `posts`. Safe to run after 0002.

alter table public.posts
  add column if not exists c2pa_status text not null default 'no_image'
    check (c2pa_status in ('verified', 'missing', 'invalid', 'no_image')),
  add column if not exists c2pa_metadata jsonb,
  add column if not exists is_political boolean not null default false;

create index if not exists posts_c2pa_status_idx on public.posts (c2pa_status);
create index if not exists posts_is_political_idx on public.posts (is_political);
