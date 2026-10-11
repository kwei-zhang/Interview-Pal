import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

export const adminId = "11111111-1111-4111-8111-111111111111";
export const memberId = "22222222-2222-4222-8222-222222222222";
// Minimal Auth schema for exercising the real migrations, hooks, triggers, and RLS.
export const authFixture = `create role anon nologin; create role authenticated nologin; create role supabase_auth_admin nologin;
  create schema auth; grant usage on schema auth to anon, authenticated, supabase_auth_admin;
  create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz,
    is_anonymous boolean default false, created_at timestamptz default now(),
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{"provider":"email"}');
  create table auth.identities(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), identity_data jsonb);
  grant select, insert, update, delete on auth.users, auth.identities to supabase_auth_admin;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  insert into auth.users(id,email,email_confirmed_at) values
    ('${adminId}','zhangkw0622@gmail.com',now()), ('${memberId}','member@example.test',now());`;

export async function setupAuthDatabase(db: PGlite, bootstrap = true, beforeInviteMigration?: () => Promise<void>) {
  await db.exec(authFixture);
  for (const file of ["202610100001_foundation.sql", "202610100002_interview_agent.sql", "202610100003_llm_judging.sql", "202610100004_invite_only_users.sql"]) {
    if (file === "202610100004_invite_only_users.sql") await beforeInviteMigration?.();
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  if (bootstrap) await db.exec(readFileSync("supabase/bootstrap-admin.sql", "utf8"));
}
export async function asUser(db: PGlite, id: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id || ""]);
  await db.exec(`set role ${role}`);
}
