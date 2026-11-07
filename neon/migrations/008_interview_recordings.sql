-- Audio stays in private object storage; only metadata is stored in Postgres.
create table public.interview_recordings (
  id uuid primary key,
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  session_id uuid not null,
  object_key text not null unique,
  mime_type text not null check (mime_type in ('audio/webm','audio/ogg','audio/mp4')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 134217728),
  duration_ms integer not null check (duration_ms >= 0 and duration_ms <= 86400000),
  status text not null default 'pending' check (status in ('pending','ready')),
  created_at timestamptz not null default now(),
  foreign key (user_id,session_id) references public.interview_sessions(user_id,id) on delete restrict
);
create index recordings_owner_session on public.interview_recordings(user_id,session_id,created_at);
alter table public.interview_recordings enable row level security;
grant select,insert,update,delete on public.interview_recordings to interview_app;
create policy owner_access on public.interview_recordings to interview_app
  using (user_id=private.current_user_id() and private.is_active_member())
  with check (user_id=private.current_user_id() and private.is_active_member());
