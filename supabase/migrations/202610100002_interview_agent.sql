-- API requests have a separate quota from code execution. All sessions and
-- transcripts continue to use the owner policies in the foundation migration.
create table public.agent_request_slots (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index agent_slots_owner on public.agent_request_slots(user_id, created_at desc);
alter table public.agent_request_slots enable row level security;
create policy agent_slots_owner on public.agent_request_slots for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.agent_request_slots to authenticated;
grant usage, select on sequence public.agent_request_slots_id_seq to authenticated;
create function public.claim_agent_slot()
returns boolean language plpgsql security invoker set search_path = public as $$
declare recent integer; daily integer;
begin
  if auth.uid() is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':agent', 0));
  delete from public.agent_request_slots where user_id = auth.uid() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*)
    into recent, daily from public.agent_request_slots where user_id = auth.uid();
  if recent >= 30 or daily >= 1000 then return false; end if;
  insert into public.agent_request_slots(user_id) values (auth.uid());
  return true;
end;
$$;
revoke all on function public.claim_agent_slot() from public, anon;
grant execute on function public.claim_agent_slot() to authenticated;
