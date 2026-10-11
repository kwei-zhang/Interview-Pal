-- Safe to apply to an existing installation. Preserve the original gate,
-- redemption transaction, permissions, accounts, and outstanding invitations.
-- Only fixed reason labels are added to hook errors (and thus Auth logs).
-- Never include the event, email, code, hash, password, or user metadata.
create or replace function public.before_user_created(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  reason text;
  invitation private.invitations%rowtype;
begin
  if coalesce(event->'user'->>'is_anonymous', 'false') <> 'false'
    or coalesce(event->'user'->'app_metadata'->>'provider', '') <> 'email'
    or not private.invitation_valid(event->'user'->'user_metadata'->>'invite_code', event->'user'->>'email') then
    if coalesce(event->'user'->>'is_anonymous', 'false') <> 'false' then
      reason := 'anonymous_signup';
    elsif nullif(event->'user'->'app_metadata'->>'provider', '') is null then
      reason := 'missing_provider';
    elsif event->'user'->'app_metadata'->>'provider' <> 'email' then
      reason := 'unsupported_provider';
    elsif nullif(btrim(event->'user'->'user_metadata'->>'invite_code'), '') is null then
      reason := 'missing_code';
    elsif nullif(btrim(event->'user'->>'email'), '') is null then
      reason := 'missing_email';
    else
      select i.* into invitation from private.invitations i
        where i.code_hash = private.invite_hash(event->'user'->'user_metadata'->>'invite_code');
      if not found then
        reason := 'code_not_found';
      elsif invitation.email <> lower(btrim(event->'user'->>'email')) then
        reason := 'email_mismatch';
      elsif invitation.revoked_at is not null then
        reason := 'revoked';
      elsif invitation.redeemed_at is not null then
        reason := 'already_redeemed';
      elsif invitation.expires_at <= now() then
        reason := 'expired';
      else
        reason := 'validation_failed';
      end if;
    end if;
    return jsonb_build_object('error', jsonb_build_object('http_code', 400,
      'message', 'Invitation is invalid or no longer available for this email. [invite:' || reason || ']'));
  end if;
  return '{}'::jsonb;
end;
$$;
