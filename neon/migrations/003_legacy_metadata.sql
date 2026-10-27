-- Historical identity metadata for audit/recovery. No passwords, tokens or sessions.
create table private.legacy_auth_users (
  user_id uuid primary key references public.app_accounts(user_id),
  original_email text not null,
  email_confirmed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  user_metadata jsonb not null,
  app_metadata jsonb not null
);
create table private.legacy_auth_identities (
  id uuid primary key,
  user_id uuid not null references public.app_accounts(user_id),
  provider text not null,
  provider_id text,
  identity_data jsonb not null,
  created_at timestamptz,
  updated_at timestamptz,
  last_sign_in_at timestamptz
);
revoke all on private.legacy_auth_users,private.legacy_auth_identities from public,interview_app;
