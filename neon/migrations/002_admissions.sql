-- Only the trusted application server calls these functions. No Data API grants.
create table private.signup_admissions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  email text not null,
  display_name text not null,
  invitation_id uuid references private.invitations(id),
  existing_user_id uuid references public.app_accounts(user_id),
  neon_user_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  accepted_at timestamptz,
  finalized_at timestamptz,
  check ((invitation_id is null) <> (existing_user_id is null))
);
create index admissions_identity on private.signup_admissions(neon_user_id);
create index admissions_email on private.signup_admissions(email,created_at);

create function private.create_admission(recipient text, display_name text, invite_hash text, reconnect boolean, admission_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare account_id uuid; invite_id uuid;
begin
  recipient := lower(btrim(recipient));
  if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or display_name is null or length(display_name) not between 1 and 200 then
    raise exception 'Invalid account details' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(recipient,43));
  if (select count(*) from private.signup_admissions where email=recipient and created_at>now()-interval '15 minutes') >= 6 then
    raise exception 'Too many registration attempts. Please try again later.' using errcode='P0429';
  end if;
  if reconnect then
    select user_id into account_id from public.app_accounts a where email=recipient and legacy
      and not exists(select 1 from private.auth_identities i where i.user_id=a.user_id);
    if account_id is null then raise exception 'Unable to reconnect. Check your email or use sign in / password recovery.' using errcode='22023'; end if;
  else
    if exists(select 1 from public.app_accounts where email=recipient) then
      raise exception 'Use sign in, reconnect your existing account, or password recovery.' using errcode='22023';
    end if;
    select id into invite_id from private.invitations where code_hash=invite_hash and email=recipient
      and revoked_at is null and redeemed_at is null and expires_at>now();
    if invite_id is null then raise exception 'Invitation is invalid or no longer available for this email.' using errcode='22023'; end if;
  end if;
  insert into private.signup_admissions(token_hash,email,display_name,invitation_id,existing_user_id)
    values(admission_hash,recipient,display_name,invite_id,account_id);
end $$;

-- The signed before-create webhook binds one admission to exactly one provider identity.
-- No invitation is consumed until account creation is confirmed.
create function private.accept_admission(admission_hash text, recipient text, provider_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare admission private.signup_admissions;
begin
  if provider_id is null or length(provider_id) not between 1 and 200 then return false; end if;
  select * into admission from private.signup_admissions where token_hash=admission_hash for update;
  if not found or admission.email<>lower(btrim(recipient)) or admission.expires_at<=now()
    or (admission.neon_user_id is not null and admission.neon_user_id<>provider_id) then return false; end if;
  if admission.invitation_id is not null and not exists(select 1 from private.invitations
    where id=admission.invitation_id and email=admission.email and revoked_at is null
      and (redeemed_at is null or admission.finalized_at is not null) and expires_at>now()) then return false; end if;
  if admission.existing_user_id is not null and exists(select 1 from private.auth_identities
    where user_id=admission.existing_user_id and neon_user_id<>provider_id) then return false; end if;
  update private.signup_admissions set neon_user_id=provider_id,accepted_at=coalesce(accepted_at,now()) where id=admission.id;
  return true;
end $$;

-- Call only after a signed user.created event or a fresh, authenticated provider session.
-- Retries are safe; reconnecting a legacy account additionally requires verified email.
create function private.resolve_identity(provider_id text, recipient text, email_verified boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare admission private.signup_admissions; account public.app_accounts; invite private.invitations;
begin
  recipient := lower(btrim(recipient));
  perform pg_advisory_xact_lock(hashtextextended(recipient,43));
  select a.* into account from public.app_accounts a join private.auth_identities i on i.user_id=a.user_id
    where i.neon_user_id=provider_id;
  if found then
    if account.email<>recipient then raise exception 'Account identity mismatch' using errcode='42501'; end if;
    if email_verified and account.verified_at is null then
      update public.app_accounts set verified_at=now() where user_id=account.user_id returning * into account;
    end if;
    return to_jsonb(account);
  end if;
  select * into admission from private.signup_admissions where neon_user_id=provider_id and email=recipient
    and accepted_at is not null order by accepted_at desc limit 1 for update;
  if not found then return null; end if;
  if admission.existing_user_id is not null then
    if not email_verified then return null; end if;
    select * into account from public.app_accounts where user_id=admission.existing_user_id and email=recipient and legacy for update;
    if not found or exists(select 1 from private.auth_identities where user_id=account.user_id) then
      raise exception 'Account already linked or unavailable' using errcode='42501';
    end if;
    update public.app_accounts set verified_at=now() where user_id=account.user_id returning * into account;
  else
    select * into invite from private.invitations where id=admission.invitation_id for update;
    if not found or invite.email<>recipient or invite.revoked_at is not null or invite.redeemed_at is not null
      or invite.expires_at<=admission.accepted_at then
      raise exception 'Invitation is no longer available. Contact the administrator.' using errcode='42501';
    end if;
    insert into public.app_accounts(email,verified_at) values(recipient,case when email_verified then now() else null end) returning * into account;
    insert into public.profiles(user_id,data) values(account.user_id,jsonb_build_object(
      'displayName',admission.display_name,'targetRole','Software Engineer','weeklyGoal',5));
    update private.invitations set redeemed_at=now(),redeemed_by=account.user_id where id=invite.id;
    insert into private.access_audit(actor_id,target_id,action) values(account.user_id,invite.id,'invitation_redeemed');
  end if;
  insert into private.auth_identities(neon_user_id,user_id) values(provider_id,account.user_id);
  update private.signup_admissions set finalized_at=now() where id=admission.id;
  insert into private.access_audit(actor_id,target_id,action) values(account.user_id,account.user_id,
    case when admission.existing_user_id is null then 'neon_account_created' else 'neon_account_reconnected' end);
  return to_jsonb(account);
end $$;

revoke all on private.signup_admissions from public,interview_app;
revoke all on function private.create_admission(text,text,text,boolean,text),private.accept_admission(text,text,text),private.resolve_identity(text,text,boolean) from public;
grant execute on function private.create_admission(text,text,text,boolean,text),private.accept_admission(text,text,text),private.resolve_identity(text,text,boolean) to interview_app;
