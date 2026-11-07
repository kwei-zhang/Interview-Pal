-- Resume material for project interviews, private to each workspace owner.
create table public.resume_bullets (
  id uuid primary key,
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index resume_bullets_owner on public.resume_bullets(user_id, updated_at desc, id);
alter table public.resume_bullets enable row level security;
grant select, insert, update, delete on public.resume_bullets to interview_app;
create policy owner_access on public.resume_bullets to interview_app
  using (user_id=private.current_user_id() and private.is_active_member())
  with check (user_id=private.current_user_id() and private.is_active_member());

update public.role_tracks set modules = '["coding","behavioral","project"]'::jsonb where id = 'software-engineer';
