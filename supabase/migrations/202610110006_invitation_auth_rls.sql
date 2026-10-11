-- Auth hooks run as supabase_auth_admin, not the table owner. A SELECT grant
-- alone cannot expose rows when RLS is enabled (for example by project setup).
-- Keep RLS enabled and let only the internal Auth role validate invitations.
begin;
alter table private.invitations enable row level security;
drop policy if exists invitations_auth_lookup on private.invitations;
create policy invitations_auth_lookup on private.invitations
  for select to supabase_auth_admin using (true);
commit;
