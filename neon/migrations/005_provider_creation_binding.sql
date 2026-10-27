-- Managed Better Auth assigns the provider ID after user.before_create.
create or replace function private.accept_admission(admission_hash text, recipient text, provider_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare admission private.signup_admissions;
begin
  if recipient is null then return false; end if;
  select * into admission from private.signup_admissions where token_hash=admission_hash for update;
  if not found or admission.email<>lower(btrim(recipient)) or admission.expires_at<=now() then return false; end if;
  if admission.invitation_id is not null and not exists(select 1 from private.invitations
    where id=admission.invitation_id and email=admission.email and revoked_at is null and redeemed_at is null and expires_at>now()) then return false; end if;
  if admission.existing_user_id is not null and exists(select 1 from private.auth_identities where user_id=admission.existing_user_id) then return false; end if;
  update private.signup_admissions set accepted_at=coalesce(accepted_at,now()) where id=admission.id;
  return true;
end $$;

create function private.bind_admission(admission_hash text, recipient text, provider_id text)
returns boolean language plpgsql security definer set search_path='' as $$
declare admission private.signup_admissions;
begin
  if recipient is null or provider_id is null or length(provider_id) not between 1 and 200 then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(btrim(recipient)),43));
  select * into admission from private.signup_admissions where token_hash=admission_hash for update;
  if not found or admission.email<>lower(btrim(recipient)) or admission.accepted_at is null
    or (admission.neon_user_id is not null and admission.neon_user_id<>provider_id) then return false; end if;
  update private.signup_admissions set neon_user_id=provider_id where id=admission.id;
  return true;
end $$;
revoke all on function private.bind_admission(text,text,text) from public;
grant execute on function private.bind_admission(text,text,text) to interview_app;

-- If both created delivery and the signup HTTP response were lost, a fresh
-- verified session can recover only an accepted admission for the same email
-- and the provider's trusted creation timestamp within that admission window.
create function private.resolve_verified_identity(provider_id text, recipient text, email_verified boolean, provider_created_at timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare admission private.signup_admissions; result jsonb;
begin
  if provider_id is null or recipient is null or email_verified is null then return null; end if;
  recipient := lower(btrim(recipient));
  perform pg_advisory_xact_lock(hashtextextended(recipient,43));
  result := private.resolve_identity(provider_id,recipient,email_verified);
  if result is not null or not email_verified or provider_created_at is null then return result; end if;
  select * into admission from private.signup_admissions where email=recipient and accepted_at is not null and finalized_at is null
    and neon_user_id is null
    and created_at<=provider_created_at+interval '30 seconds'
    and accepted_at<=provider_created_at+interval '30 seconds'
    and expires_at>=provider_created_at-interval '30 seconds'
    order by accepted_at desc,id limit 1 for update;
  if not found then return null; end if;
  update private.signup_admissions set neon_user_id=provider_id where id=admission.id;
  return private.resolve_identity(provider_id,recipient,true);
end $$;
revoke all on function private.resolve_verified_identity(text,text,boolean,timestamptz) from public;
grant execute on function private.resolve_verified_identity(text,text,boolean,timestamptz) to interview_app;

create or replace function private.process_auth_event(event_id uuid, event_type text, provider_id text, recipient text, admission_hash text, payload_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.auth_webhook_receipts; result jsonb; allowed boolean;
begin
  if event_id is null or recipient is null or payload_hash is null or event_type is null
    or event_type not in ('user.before_create','user.created') or (event_type='user.created' and provider_id is null) then
    raise exception 'Invalid auth event' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(event_id::text,44));
  select * into previous from private.auth_webhook_receipts r where r.event_id=process_auth_event.event_id;
  if found then
    if previous.payload_hash<>payload_hash then raise exception 'Event payload changed' using errcode='42501'; end if;
    return previous.response;
  end if;
  if event_type='user.before_create' then
    allowed := admission_hash is not null and private.accept_admission(admission_hash,recipient,null);
    result := case when allowed then '{"allowed":true}'::jsonb else
      '{"allowed":false,"error_message":"Register through Interview Pal with an invitation, or reconnect your existing account."}'::jsonb end;
  else
    if admission_hash is not null then perform private.bind_admission(admission_hash,recipient,provider_id); end if;
    perform private.resolve_identity(provider_id,recipient,false);
    result := '{"ok":true}'::jsonb;
  end if;
  insert into private.auth_webhook_receipts(event_id,payload_hash,response) values(event_id,payload_hash,result);
  return result;
end $$;
