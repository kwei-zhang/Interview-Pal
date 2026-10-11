-- Install this migration BEFORE enabling email signup. Configure the
-- before_user_created hook afterwards; the triggers also enforce the gate.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

create table public.app_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now()
);
insert into public.app_accounts(user_id, created_at)
  select id, coalesce(created_at, now()) from auth.users;
alter table public.app_accounts enable row level security;
revoke all on public.app_accounts from public, anon, authenticated;
grant select on public.app_accounts to authenticated;
create policy own_account on public.app_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create table private.invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  email text not null check (email = lower(btrim(email))),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null deferrable initially deferred
);
create unique index invitation_pending_email on private.invitations(email)
  where revoked_at is null and redeemed_at is null;
create table private.access_audit (
  id bigint generated always as identity primary key,
  actor_id uuid, target_id uuid,
  action text not null, created_at timestamptz not null default now()
);
revoke all on all tables in schema private from public, anon, authenticated;

create function private.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_accounts a join auth.users u on u.id = a.user_id
    where a.user_id = auth.uid() and a.status = 'active'
      and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, false));
$$;
create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_active_member() and exists
    (select 1 from public.app_accounts where user_id = auth.uid() and role = 'admin');
$$;
create function private.invite_hash(code text)
returns text language sql immutable set search_path = '' as $$
  select encode(sha256(convert_to(upper(regexp_replace(coalesce(code, ''), '[[:space:]-]', '', 'g')), 'UTF8')), 'hex');
$$;
create function private.invitation_valid(code text, recipient text)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from private.invitations
    where code_hash = private.invite_hash(code) and email = lower(btrim(recipient))
      and revoked_at is null and redeemed_at is null and expires_at > now());
$$;

-- This hook only checks. Consuming here would burn a code if Auth later failed.
create function public.before_user_created(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') <> 'false'
    or coalesce(event->'user'->'app_metadata'->>'provider', '') <> 'email'
    or not private.invitation_valid(event->'user'->'user_metadata'->>'invite_code', event->'user'->>'email') then
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'Invitation is invalid or no longer available for this email.'));
  end if;
  return '{}'::jsonb;
end;
$$;

-- UPDATE locks the invitation row. Account insertion, redemption, and membership
-- either all commit or all roll back, including races and email delivery failures.
create function private.redeem_signup_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invitation_id uuid;
begin
  if coalesce(new.is_anonymous, false) or coalesce(new.raw_app_meta_data->>'provider', '') <> 'email' then
    raise exception 'An email invitation is required' using errcode = 'P0001';
  end if;
  update private.invitations set redeemed_by = new.id, redeemed_at = now()
    where code_hash = private.invite_hash(new.raw_user_meta_data->>'invite_code')
      and email = lower(btrim(new.email)) and revoked_at is null
      and redeemed_at is null and expires_at > now()
    returning id into invitation_id;
  if invitation_id is null then
    raise exception 'Invitation is invalid or no longer available for this email.' using errcode = 'P0001';
  end if;
  new.raw_user_meta_data = coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'invite_code';
  insert into private.access_audit(actor_id, target_id, action) values (new.id, invitation_id, 'invitation_redeemed');
  return new;
end;
$$;
create trigger require_signup_invitation before insert on auth.users
  for each row execute function private.redeem_signup_invitation();

create function private.create_invited_member()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_accounts(user_id) values (new.id);
  insert into public.profiles(user_id, data) values (new.id, jsonb_build_object(
    'displayName', left(coalesce(new.raw_user_meta_data->>'display_name', ''), 200),
    'targetRole', 'Software Engineer', 'weeklyGoal', 5));
  return new;
end;
$$;
create trigger create_invited_member after insert on auth.users
  for each row execute function private.create_invited_member();

-- Auth copies signup data into identity_data independently of auth.users.
create function private.strip_invite_metadata()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'identities' then
    new.identity_data = new.identity_data - 'invite_code';
  else
    new.raw_user_meta_data = new.raw_user_meta_data - 'invite_code';
  end if;
  return new;
end;
$$;
create trigger strip_identity_invitation before insert or update on auth.identities
  for each row execute function private.strip_invite_metadata();
create trigger strip_user_invitation before update on auth.users
  for each row execute function private.strip_invite_metadata();

-- A restrictive policy intersects with all existing ownership/catalog policies.
do $$
declare t text;
begin
  foreach t in array array['role_tracks','question_collections','problems','problem_definitions','behavioral_questions',
    'profiles','problem_progress','code_drafts','stories','story_question_links','interview_sessions',
    'interview_events','session_feedback','attempts','execution_slots','agent_request_slots'] loop
    execute format('create policy active_members_only on public.%I as restrictive to authenticated using ((select private.is_active_member())) with check ((select private.is_active_member()))', t);
  end loop;
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
  if exists (select 1 from auth.users where lower(btrim(email)) = recipient) then
    raise exception 'This account already exists. Use verification resend or password recovery.' using errcode = '22023';
  end if;
  with revoked as (
    update private.invitations set revoked_at = now() where email = recipient and revoked_at is null and redeemed_at is null returning id
  ) insert into private.access_audit(actor_id, target_id, action) select auth.uid(), id, 'invitation_replaced' from revoked;
  insert into private.invitations(email, code_hash, created_by) values (recipient, token_hash, auth.uid()) returning * into result;
  insert into private.access_audit(actor_id, target_id, action) values (auth.uid(), result.id, 'invitation_created');
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
  insert into private.access_audit(actor_id, target_id, action) values (auth.uid(), invitation_id, 'invitation_revoked');
end;
$$;
create function public.admin_list_users(page_offset integer default 0)
returns table(user_id uuid, email text, display_name text, role text, status text, created_at timestamptz, verified boolean)
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select a.user_id, u.email::text, coalesce(p.data->>'displayName', ''), a.role, a.status,
    a.created_at, u.email_confirmed_at is not null
    from public.app_accounts a join auth.users u on u.id = a.user_id left join public.profiles p on p.user_id = a.user_id
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
  insert into private.access_audit(actor_id, target_id, action) values (auth.uid(), target_user_id, 'account_' || new_status);
end;
$$;

-- RLS rejects quota inserts as well, but explicitly stop before quota maintenance.
create or replace function public.claim_execution_slot()
returns boolean language plpgsql security invoker set search_path = '' as $$
declare recent integer; daily integer;
begin
  if not private.is_active_member() then raise exception 'Active membership required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  delete from public.execution_slots where user_id = auth.uid() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into recent, daily from public.execution_slots where user_id = auth.uid();
  if recent >= 10 or daily >= 300 then return false; end if;
  insert into public.execution_slots(user_id) values (auth.uid()); return true;
end;
$$;
create or replace function public.claim_agent_slot()
returns boolean language plpgsql security invoker set search_path = '' as $$
declare recent integer; daily integer;
begin
  if not private.is_active_member() then raise exception 'Active membership required' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':agent', 0));
  delete from public.agent_request_slots where user_id = auth.uid() and created_at < now() - interval '24 hours';
  select count(*) filter (where created_at > now() - interval '1 minute'), count(*) into recent, daily from public.agent_request_slots where user_id = auth.uid();
  if recent >= 30 or daily >= 1000 then return false; end if;
  insert into public.agent_request_slots(user_id) values (auth.uid()); return true;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_active_member(), private.is_admin() to authenticated;
grant execute on function private.invite_hash(text), private.invitation_valid(text,text) to supabase_auth_admin;
grant select on private.invitations to supabase_auth_admin;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
revoke all on function public.admin_create_invitation(text,text), public.admin_list_invitations(integer),
  public.admin_revoke_invitation(uuid), public.admin_list_users(integer), public.admin_set_user_status(uuid,text) from public, anon;
grant execute on function public.admin_create_invitation(text,text), public.admin_list_invitations(integer),
  public.admin_revoke_invitation(uuid), public.admin_list_users(integer), public.admin_set_user_status(uuid,text) to authenticated;
