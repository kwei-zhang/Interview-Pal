-- Run AFTER migration 004 in the Supabase SQL Editor for your project.
-- Resolves this explicitly designated existing account once, then binds the role
-- to its immutable UUID. Never promote the first signup or trust user metadata.
do $$
declare admin_id uuid;
begin
  select id into strict admin_id from auth.users
    where lower(btrim(email)) = 'zhangkw0622@gmail.com'
      and email_confirmed_at is not null and not coalesce(is_anonymous, false);
  update public.app_accounts set role = 'admin', status = 'active' where user_id = admin_id;
  if not found then raise exception 'Apply the invite-only migration first'; end if;
  insert into private.access_audit(actor_id, target_id, action) values (admin_id, admin_id, 'admin_bootstrapped');
exception
  when no_data_found then raise exception 'The designated verified account zhangkw0622@gmail.com does not exist. No admin was granted.';
  when too_many_rows then raise exception 'More than one account matches. Select an explicit user ID before granting admin.';
end $$;
