-- Application schema for Neon. Run as the migration owner, never the runtime role.
-- Provider schemas are managed by Neon and deliberately not modified here.
do $$ begin
  if not exists (select from pg_roles where rolname='interview_app') then
    create role interview_app nologin nosuperuser nobypassrls;
  end if;
end $$;
create schema if not exists private;
revoke all on schema private from public;
revoke create on schema public from public;
grant usage on schema public, private to interview_app;
create table public.app_accounts (
  user_id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  legacy boolean not null default false
);
create table private.auth_identities (
  neon_user_id text primary key,
  user_id uuid not null unique references public.app_accounts(user_id),
  created_at timestamptz not null default now()
);
create function private.current_user_id() returns uuid language sql stable set search_path='' as $$
  select nullif(current_setting('app.user_id',true),'')::uuid;
$$;
create function private.is_active_member() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.app_accounts where user_id=private.current_user_id()
    and status='active' and verified_at is not null);
$$;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select private.is_active_member() and exists(select 1 from public.app_accounts
    where user_id=private.current_user_id() and role='admin');
$$;
create table public.role_tracks (
  id text primary key, name text not null, modules jsonb not null default '[]'
);
create table public.question_collections (
  id text primary key, role_id text not null references public.role_tracks(id), name text not null, source_url text
);
create table public.problems (
  id text primary key, collection_id text not null references public.question_collections(id), data jsonb not null
);
create table public.problem_definitions (
  problem_id text not null references public.problems(id), version integer not null, data jsonb not null,
  primary key (problem_id, version)
);
create table public.behavioral_questions (
  id text primary key, role_id text not null references public.role_tracks(id), data jsonb not null
);
create table public.profiles (
  user_id uuid primary key references public.app_accounts(user_id) on delete cascade, data jsonb not null
);
create table public.problem_progress (
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  problem_id text not null references public.problems(id), data jsonb not null,
  updated_at timestamptz not null default now(), primary key (user_id, problem_id)
);
create table public.code_drafts (
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  problem_id text not null references public.problems(id),
  language text not null check (language in ('python','javascript','typescript')),
  data jsonb not null, updated_at timestamptz not null default now(), primary key (user_id, problem_id, language)
);
create table public.stories (
  id uuid primary key, user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  data jsonb not null, updated_at timestamptz not null default now(), unique (user_id, id)
);
create table public.story_question_links (
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  story_id uuid not null, question_id text not null references public.behavioral_questions(id),
  primary key (user_id, story_id, question_id),
  foreign key (user_id, story_id) references public.stories(user_id, id) on delete cascade
);
create table public.interview_sessions (
  id uuid primary key, user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  data jsonb not null, updated_at timestamptz not null default now(), unique (user_id, id)
);
create table public.interview_events (
  id uuid primary key, user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  session_id uuid not null, data jsonb not null, created_at timestamptz not null,
  position integer not null check (position >= 0),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete cascade
);
create table public.session_feedback (
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  session_id uuid not null, data jsonb not null, primary key (user_id, session_id),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete cascade
);
create table public.attempts (
  id uuid primary key, user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  problem_id text not null references public.problems(id), session_id uuid,
  provider_job_id text, data jsonb not null, created_at timestamptz not null default now(),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete set null (session_id)
);
create table public.execution_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_accounts(user_id) on delete cascade,
  created_at timestamptz not null default now()
);

create index stories_owner on public.stories(user_id, updated_at desc);
create index sessions_owner on public.interview_sessions(user_id, updated_at desc);
create index events_owner on public.interview_events(user_id, session_id, position);
create index attempts_owner on public.attempts(user_id, created_at desc);
create index slots_owner on public.execution_slots(user_id, created_at desc);

create table private.invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  email text not null check (email = lower(btrim(email))),
  created_by uuid not null references public.app_accounts(user_id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references public.app_accounts(user_id) on delete set null deferrable initially deferred
);
create unique index invitation_pending_email on private.invitations(email)
  where revoked_at is null and redeemed_at is null;
create table private.access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid, target_id uuid,
  action text not null, created_at timestamptz not null default now()
);
create table public.agent_request_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null default private.current_user_id() references public.app_accounts(user_id) on delete cascade,
  created_at timestamptz not null default now()
);
create index agent_slots_owner on public.agent_request_slots(user_id, created_at desc);

alter table public.app_accounts enable row level security;
grant select on public.app_accounts to interview_app;
create policy own_account on public.app_accounts for select to interview_app
  using (user_id=private.current_user_id());
do $$ declare t text; begin
  foreach t in array array['role_tracks','question_collections','problems','problem_definitions','behavioral_questions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select on public.%I to interview_app', t);
    execute format('create policy catalog_read on public.%I for select to interview_app using (private.is_active_member())',t);
  end loop;
  foreach t in array array['profiles','problem_progress','code_drafts','stories','story_question_links','interview_sessions','interview_events','session_feedback','attempts','execution_slots','agent_request_slots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select,insert,update,delete on public.%I to interview_app', t);
    execute format('create policy owner_access on public.%I to interview_app using (user_id=private.current_user_id() and private.is_active_member()) with check (user_id=private.current_user_id() and private.is_active_member())',t);
  end loop;
end $$;
grant usage,select on sequence public.execution_slots_id_seq,public.agent_request_slots_id_seq to interview_app;
create function public.save_story(story_id uuid, story_data jsonb, question_ids text[], modified_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if private.current_user_id() is null then raise exception 'Authentication required'; end if;
  insert into public.stories(id, user_id, data, updated_at) values (story_id, private.current_user_id(), story_data, modified_at)
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
    where public.stories.updated_at <= excluded.updated_at;
  if not found then return; end if;
  delete from public.story_question_links where user_id = private.current_user_id() and story_question_links.story_id = save_story.story_id;
  insert into public.story_question_links(user_id, story_id, question_id)
    select private.current_user_id(), save_story.story_id, q from unnest(question_ids) q on conflict do nothing;
end $$;

create function public.save_interview_session(session_id uuid, session_data jsonb, transcript_data jsonb, feedback_data jsonb, modified_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare event jsonb; event_index integer := 0;
begin
  if private.current_user_id() is null then raise exception 'Authentication required'; end if;
  insert into public.interview_sessions(id, user_id, data, updated_at) values (session_id, private.current_user_id(), session_data, modified_at)
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
    where public.interview_sessions.updated_at <= excluded.updated_at
      and (public.interview_sessions.data->>'status' <> 'completed' or excluded.data->>'status' = 'completed');
  if not found then return; end if;
  for event in select value from jsonb_array_elements(transcript_data) loop
    insert into public.interview_events(id, user_id, session_id, data, created_at, position)
      values ((event->>'id')::uuid, private.current_user_id(), save_interview_session.session_id, event, (event->>'timestamp')::timestamptz, event_index)
      on conflict (id) do nothing;
    event_index := event_index + 1;
  end loop;
  if feedback_data is not null then
    insert into public.session_feedback(user_id, session_id, data) values (private.current_user_id(), save_interview_session.session_id, feedback_data)
      on conflict on constraint session_feedback_pkey do update set data = excluded.data;
  end if;
end $$;

create function public.admin_create_invitation(recipient_email text, token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare recipient text := lower(btrim(recipient_email)); result private.invitations;
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if recipient is null or length(recipient) > 254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or token_hash is null or token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid invitation details' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(recipient, 42));
  if exists (select 1 from public.app_accounts where lower(btrim(email)) = recipient) then
    raise exception 'This account already exists. Use verification resend or password recovery.' using errcode = '22023';
  end if;
  with revoked as (
    update private.invitations set revoked_at = now() where email = recipient and revoked_at is null and redeemed_at is null returning id
  ) insert into private.access_audit(actor_id, target_id, action) select private.current_user_id(), id, 'invitation_replaced' from revoked;
  insert into private.invitations(email, code_hash, created_by) values (recipient, token_hash, private.current_user_id()) returning * into result;
  insert into private.access_audit(actor_id, target_id, action) values (private.current_user_id(), result.id, 'invitation_created');
  return to_jsonb(result) - 'code_hash';
end;
$$;
create function public.admin_list_invitations(page_offset integer default 0)
returns table(id uuid, email text, created_at timestamptz, expires_at timestamptz, revoked_at timestamptz, redeemed_at timestamptz, redeemed_by uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select i.id, i.email, i.created_at, i.expires_at, i.revoked_at, i.redeemed_at, i.redeemed_by
    from private.invitations i order by i.created_at desc, i.id limit 50 offset greatest(0, page_offset);
end;
$$;
create function public.admin_revoke_invitation(invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  update private.invitations set revoked_at = now() where id = invitation_id and revoked_at is null and redeemed_at is null;
  if not found then raise exception 'Invitation is already used, revoked, or missing' using errcode = '22023'; end if;
  insert into private.access_audit(actor_id, target_id, action) values (private.current_user_id(), invitation_id, 'invitation_revoked');
end;
$$;
create function public.admin_list_users(page_offset integer default 0)
returns table(user_id uuid, email text, display_name text, role text, status text, created_at timestamptz, verified boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select a.user_id, u.email::text, coalesce(p.data->>'displayName', ''), a.role, a.status,
    a.created_at, u.verified_at is not null
    from public.app_accounts a join public.app_accounts u on u.user_id = a.user_id left join public.profiles p on p.user_id = a.user_id
    order by a.created_at desc, a.user_id limit 50 offset greatest(0, page_offset);
end;
$$;
create function public.admin_set_user_status(target_user_id uuid, new_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if new_status is null or new_status not in ('active', 'suspended') then raise exception 'Invalid access status' using errcode = '22023'; end if;
  update public.app_accounts set status = new_status where user_id = target_user_id and role = 'member';
  if not found then raise exception 'Only existing ordinary members can be changed' using errcode = '22023'; end if;
  insert into private.access_audit(actor_id, target_id, action) values (private.current_user_id(), target_user_id, 'account_' || new_status);
end;
$$;

create or replace function public.claim_execution_slot()
returns boolean language plpgsql security invoker set search_path = '' as $$
declare recent integer; daily integer;
begin
  if not private.is_active_member() then raise exception 'Active membership required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(private.current_user_id()::text, 0));
  delete from public.execution_slots where user_id = private.current_user_id() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into recent, daily from public.execution_slots where user_id = private.current_user_id();
  if recent >= 10 or daily >= 300 then return false; end if;
  insert into public.execution_slots(user_id) values (private.current_user_id()); return true;
end;
$$;
create or replace function public.claim_agent_slot()
returns boolean language plpgsql security invoker set search_path = '' as $$
declare recent integer; daily integer;
begin
  if not private.is_active_member() then raise exception 'Active membership required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(private.current_user_id()::text || ':agent', 0));
  delete from public.agent_request_slots where user_id = private.current_user_id() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into recent, daily from public.agent_request_slots where user_id = private.current_user_id();
  if recent >= 30 or daily >= 1000 then return false; end if;
  insert into public.agent_request_slots(user_id) values (private.current_user_id()); return true;
end;
$$;


revoke all on all tables in schema private from public,interview_app;
revoke all on all functions in schema private from public,interview_app;
grant execute on function private.current_user_id(),private.is_active_member(),private.is_admin() to interview_app;
revoke all on function public.save_story(uuid,jsonb,text[],timestamptz) from public;
grant execute on function public.save_story(uuid,jsonb,text[],timestamptz) to interview_app;
revoke all on function public.save_interview_session(uuid,jsonb,jsonb,jsonb,timestamptz) from public;
grant execute on function public.save_interview_session(uuid,jsonb,jsonb,jsonb,timestamptz) to interview_app;
revoke all on function public.claim_execution_slot() from public;
grant execute on function public.claim_execution_slot() to interview_app;
revoke all on function public.claim_agent_slot() from public;
grant execute on function public.claim_agent_slot() to interview_app;
revoke all on function public.admin_create_invitation(text,text) from public;
grant execute on function public.admin_create_invitation(text,text) to interview_app;
revoke all on function public.admin_list_invitations(integer) from public;
grant execute on function public.admin_list_invitations(integer) to interview_app;
revoke all on function public.admin_revoke_invitation(uuid) from public;
grant execute on function public.admin_revoke_invitation(uuid) to interview_app;
revoke all on function public.admin_list_users(integer) from public;
grant execute on function public.admin_list_users(integer) to interview_app;
revoke all on function public.admin_set_user_status(uuid,text) from public;
grant execute on function public.admin_set_user_status(uuid,text) to interview_app;
