-- Apply with `supabase db push`. Public signup must be disabled in Supabase Auth.
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
  user_id uuid primary key references auth.users(id) on delete cascade, data jsonb not null
);
create table public.problem_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null references public.problems(id), data jsonb not null,
  updated_at timestamptz not null default now(), primary key (user_id, problem_id)
);
create table public.code_drafts (
  user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null references public.problems(id),
  language text not null check (language in ('python','javascript','typescript')),
  data jsonb not null, updated_at timestamptz not null default now(), primary key (user_id, problem_id, language)
);
create table public.stories (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null, updated_at timestamptz not null default now(), unique (user_id, id)
);
create table public.story_question_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null, question_id text not null references public.behavioral_questions(id),
  primary key (user_id, story_id, question_id),
  foreign key (user_id, story_id) references public.stories(user_id, id) on delete cascade
);
create table public.interview_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null, updated_at timestamptz not null default now(), unique (user_id, id)
);
create table public.interview_events (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null, data jsonb not null, created_at timestamptz not null,
  position integer not null check (position >= 0),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete cascade
);
create table public.session_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null, data jsonb not null, primary key (user_id, session_id),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete cascade
);
create table public.attempts (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  problem_id text not null references public.problems(id), session_id uuid,
  provider_job_id text, data jsonb not null, created_at timestamptz not null default now(),
  foreign key (user_id, session_id) references public.interview_sessions(user_id, id) on delete set null (session_id)
);
create table public.execution_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index stories_owner on public.stories(user_id, updated_at desc);
create index sessions_owner on public.interview_sessions(user_id, updated_at desc);
create index events_owner on public.interview_events(user_id, session_id, position);
create index attempts_owner on public.attempts(user_id, created_at desc);
create index slots_owner on public.execution_slots(user_id, created_at desc);

-- Every exposed table uses RLS. Shared catalogs are read-only to signed-in users.
do $$
declare t text;
begin
  foreach t in array array['role_tracks','question_collections','problems','problem_definitions','behavioral_questions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy catalog_read on public.%I for select to authenticated using (true)', t);
  end loop;
  foreach t in array array['profiles','problem_progress','code_drafts','stories','story_question_links','interview_sessions','interview_events','session_feedback','attempts','execution_slots'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy owner_access on public.%I to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
grant usage, select on sequence public.execution_slots_id_seq to authenticated;

-- Security-invoker functions preserve the caller's RLS in atomic transactions.
create function public.save_story(story_id uuid, story_data jsonb, question_ids text[], modified_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.stories(id, user_id, data, updated_at) values (story_id, auth.uid(), story_data, modified_at)
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
    where public.stories.updated_at <= excluded.updated_at;
  if not found then return; end if;
  delete from public.story_question_links where user_id = auth.uid() and story_question_links.story_id = save_story.story_id;
  insert into public.story_question_links(user_id, story_id, question_id)
    select auth.uid(), save_story.story_id, q from unnest(question_ids) q on conflict do nothing;
end $$;

create function public.save_interview_session(session_id uuid, session_data jsonb, transcript_data jsonb, feedback_data jsonb, modified_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare event jsonb; event_index integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.interview_sessions(id, user_id, data, updated_at) values (session_id, auth.uid(), session_data, modified_at)
    on conflict (id) do update set data = excluded.data, updated_at = excluded.updated_at
    where public.interview_sessions.updated_at <= excluded.updated_at
      and (public.interview_sessions.data->>'status' <> 'completed' or excluded.data->>'status' = 'completed');
  if not found then return; end if;
  for event in select value from jsonb_array_elements(transcript_data) loop
    insert into public.interview_events(id, user_id, session_id, data, created_at, position)
      values ((event->>'id')::uuid, auth.uid(), save_interview_session.session_id, event, (event->>'timestamp')::timestamptz, event_index)
      on conflict (id) do nothing;
    event_index := event_index + 1;
  end loop;
  if feedback_data is not null then
    insert into public.session_feedback(user_id, session_id, data) values (auth.uid(), save_interview_session.session_id, feedback_data)
      on conflict on constraint session_feedback_pkey do update set data = excluded.data;
  end if;
end $$;

create function public.claim_execution_slot()
returns boolean language plpgsql security invoker set search_path = '' as $$
declare recent integer; daily integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  delete from public.execution_slots where user_id = auth.uid() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*)
    into recent, daily from public.execution_slots where user_id = auth.uid();
  if recent >= 10 or daily >= 300 then return false; end if;
  insert into public.execution_slots(user_id) values (auth.uid());
  return true;
end $$;
revoke all on function public.save_story(uuid,jsonb,text[],timestamptz) from public, anon;
revoke all on function public.save_interview_session(uuid,jsonb,jsonb,jsonb,timestamptz) from public, anon;
revoke all on function public.claim_execution_slot() from public, anon;
grant execute on function public.save_story(uuid,jsonb,text[],timestamptz) to authenticated;
grant execute on function public.save_interview_session(uuid,jsonb,jsonb,jsonb,timestamptz) to authenticated;
grant execute on function public.claim_execution_slot() to authenticated;
