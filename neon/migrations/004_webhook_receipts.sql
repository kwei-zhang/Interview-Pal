create table private.auth_webhook_receipts (
  event_id uuid primary key,
  payload_hash text not null,
  response jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on private.auth_webhook_receipts from public,interview_app;
create function private.process_auth_event(event_id uuid, event_type text, provider_id text, recipient text, admission_hash text, payload_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous private.auth_webhook_receipts; result jsonb; allowed boolean;
begin
  if event_id is null or provider_id is null or recipient is null or payload_hash is null
    or event_type not in ('user.before_create','user.created') then
    raise exception 'Invalid auth event' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(event_id::text,44));
  select * into previous from private.auth_webhook_receipts r where r.event_id=process_auth_event.event_id;
  if found then
    if previous.payload_hash<>payload_hash then raise exception 'Event payload changed' using errcode='42501'; end if;
    return previous.response;
  end if;
  if event_type='user.before_create' then
    allowed := admission_hash is not null and private.accept_admission(admission_hash,recipient,provider_id);
    result := case when allowed then '{"allowed":true}'::jsonb else
      '{"allowed":false,"error_message":"Register through Interview Pal with an invitation, or reconnect your existing account."}'::jsonb end;
  else
    perform private.resolve_identity(provider_id,recipient,false);
    result := '{"ok":true}'::jsonb;
  end if;
  insert into private.auth_webhook_receipts(event_id,payload_hash,response) values(event_id,payload_hash,result);
  return result;
end $$;
revoke all on function private.process_auth_event(uuid,text,text,text,text,text) from public;
grant execute on function private.process_auth_event(uuid,text,text,text,text,text) to interview_app;
