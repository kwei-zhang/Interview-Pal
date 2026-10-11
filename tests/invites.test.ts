import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { asUser, setupAuthDatabase, adminId, memberId } from "./helpers/auth-database";

const db = new PGlite();
before(async () => {await setupAuthDatabase(db);});
after(async () => {await db.close();});
async function invite(email: string) {
  await asUser(db, adminId);
  const code = randomBytes(16).toString("hex").toUpperCase();
  const result = await db.query<{invitation: {id: string}}>("select public.admin_create_invitation($1,$2) as invitation", [email, createHash("sha256").update(code).digest("hex")]);
  return {code, id: result.rows[0].invitation.id};
}
async function hook(email: string, code?: string) {
  await asUser(db, null, "supabase_auth_admin");
  const result = await db.query<{result: {error?: {message: string}}}>("select public.before_user_created($1) as result", [{user: {email, app_metadata: {provider: "email"}, user_metadata: {invite_code: code}}}]);
  return result.rows[0].result;
}
async function signup(email: string, code?: string, id = randomUUID()) {
  await asUser(db, null, "supabase_auth_admin");
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)", [id, email, {invite_code: code, display_name: "New member", role: "admin"}]);
  return id;
}

test("Only the explicitly designated verified account becomes admin", async () => {
  await asUser(db, adminId);
  assert.equal((await db.query<{role: string}>("select role from public.app_accounts")).rows[0].role, "admin");
  await asUser(db, memberId);
  assert.equal((await db.query<{role: string}>("select role from public.app_accounts")).rows[0].role, "member");
  await assert.rejects(db.query("update public.app_accounts set role='admin'"), /permission denied/);
  await assert.rejects(db.query("select public.admin_list_users()"), /Admin access required/);
  await assert.rejects(db.query("select public.admin_create_invitation('x@example.test',repeat('a',64))"), /Admin access required/);
  await asUser(db, null, "anon");
  await assert.rejects(db.query("select public.admin_list_invitations()"), /permission denied/);
  await assert.rejects(db.query("select public.before_user_created('{}')"), /permission denied/);
});

test("Valid code is email-bound, consumed once, hashed, and removed from all Auth metadata", async () => {
  const email = "new@example.test", invitation = await invite("  NEW@example.test ");
  assert.deepEqual(await hook(email, invitation.code.toLowerCase().match(/.{8}/g)!.join("-")), {});
  assert.ok((await hook("wrong@example.test", invitation.code)).error);
  assert.ok((await hook(email)).error);
  assert.ok((await hook(email, "INVALID")).error);
  const id = await signup(email, invitation.code);
  await db.query("insert into auth.identities(user_id,identity_data) values ($1,$2)", [id, {email, invite_code: invitation.code}]);
  const user = (await db.query<{raw_user_meta_data: Record<string, unknown>}>("select raw_user_meta_data from auth.users where id=$1", [id])).rows[0];
  assert.equal(user.raw_user_meta_data.invite_code, undefined);
  assert.equal((await db.query<{identity_data: Record<string, unknown>}>("select identity_data from auth.identities where user_id=$1", [id])).rows[0].identity_data.invite_code, undefined);
  assert.ok((await hook(email, invitation.code)).error);
  await assert.rejects(signup(email, invitation.code), /Invitation is invalid/);
  await asUser(db, id);
  assert.equal((await db.query<{role: string}>("select role from public.app_accounts")).rows[0].role, "member");
  assert.equal((await db.query("select * from public.profiles")).rows.length, 0); // unverified
  await assert.rejects(db.query("select public.claim_agent_slot()"), /Active membership required/);
  await assert.rejects(db.query("select * from private.invitations"), /permission denied/);
  await asUser(db, null, "supabase_auth_admin");
  await db.query("update auth.users set email_confirmed_at=now(), raw_user_meta_data=raw_user_meta_data || $2 where id=$1", [id, {invite_code: invitation.code}]);
  await asUser(db, id);
  assert.equal((await db.query("select * from public.profiles")).rows.length, 1);
  assert.equal((await db.query<{ok: boolean}>("select private.is_active_member() as ok")).rows[0].ok, true);
});

test("Revocation, expiry, replacement, and direct Auth insertion cannot bypass invitations", async () => {
  const revoked = await invite("revoked@example.test");
  await db.query("select public.admin_revoke_invitation($1)", [revoked.id]);
  assert.ok((await hook("revoked@example.test", revoked.code)).error);
  await assert.rejects(signup("revoked@example.test", revoked.code), /Invitation is invalid/);
  const expired = await invite("expired@example.test");
  await db.exec("reset role");
  await db.query("update private.invitations set expires_at=now()-interval '1 second' where id=$1", [expired.id]);
  assert.ok((await hook("expired@example.test", expired.code)).error);
  await assert.rejects(signup("expired@example.test", expired.code), /Invitation is invalid/);
  const first = await invite("replace@example.test"), replacement = await invite("replace@example.test");
  assert.ok((await hook("replace@example.test", first.code)).error);
  assert.deepEqual(await hook("replace@example.test", replacement.code), {});
  await assert.rejects(signup("no-invite@example.test"), /Invitation is invalid/);
  await assert.rejects(signup("different@example.test", replacement.code), /Invitation is invalid/);
});

test("Failed account creation rolls back redemption and leaves the code usable", async () => {
  const invitation = await invite("rollback@example.test");
  await assert.rejects(signup("rollback@example.test", invitation.code, memberId), /duplicate key/);
  assert.deepEqual(await hook("rollback@example.test", invitation.code), {});
  const id = randomUUID();
  await asUser(db, null, "supabase_auth_admin");
  await assert.rejects(db.transaction(async tx => {
    await tx.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)", [id, "rollback@example.test", {invite_code: invitation.code}]);
    throw new Error("Simulated email service failure before commit");
  }), /Simulated email/);
  assert.deepEqual(await hook("rollback@example.test", invitation.code), {});
  await signup("rollback@example.test", invitation.code);
});

test("Suspension blocks existing JWT identities, data, and quotas; restoration preserves work", async () => {
  await asUser(db, memberId);
  await db.query("insert into public.profiles(user_id,data) values ($1,$2)", [memberId, {displayName: "Private member", reflection: "Never shown to admins"}]);
  await asUser(db, adminId);
  assert.equal((await db.query("select * from public.profiles where user_id=$1", [memberId])).rows.length, 0);
  const listed = (await db.query<Record<string, unknown>>("select * from public.admin_list_users()")).rows.find(row => row.user_id === memberId)!;
  assert.equal(listed.display_name, "Private member");
  assert.equal(listed.reflection, undefined);
  await db.query("select public.admin_set_user_status($1,'suspended')", [memberId]);
  await assert.rejects(db.query("select public.admin_set_user_status($1,'suspended')", [adminId]), /Only existing ordinary members/);
  await asUser(db, memberId);
  assert.equal((await db.query("select * from public.profiles")).rows.length, 0);
  assert.equal((await db.query("select * from public.problems")).rows.length, 0);
  await assert.rejects(db.query("insert into public.profiles(user_id,data) values ($1,'{}')", [memberId]), /row-level security/);
  await assert.rejects(db.query("select public.claim_agent_slot()"), /Active membership required/);
  await assert.rejects(db.query("select public.claim_execution_slot()"), /Active membership required/);
  await asUser(db, adminId);
  await db.query("select public.admin_set_user_status($1,'active')", [memberId]);
  await asUser(db, memberId);
  assert.equal((await db.query<{data: {reflection: string}}>("select data from public.profiles")).rows[0].data.reflection, "Never shown to admins");
});

test("Migration preserves existing personal records and never automatically selects an admin", async () => {
  const existing = new PGlite();
  try {
    await setupAuthDatabase(existing, false, async () => {
      await existing.exec(readFileSync("supabase/seed.sql", "utf8"));
      await existing.query("insert into public.profiles(user_id,data) values ($1,$2)", [adminId, {displayName: "Existing owner"}]);
      await existing.query("insert into public.stories(id,user_id,data) values ($1,$2,$3)", [randomUUID(), adminId, {title: "Saved story"}]);
      await existing.query("insert into public.interview_sessions(id,user_id,data) values ($1,$2,$3)", [randomUUID(), adminId, {status: "completed", scratchpad: "Saved notes"}]);
      await existing.query("insert into public.code_drafts(user_id,problem_id,language,data) values ($1,'two-sum','python',$2)", [adminId, {code: "# existing work"}]);
    });
    const roles = (await existing.query<{role: string}>("select role from public.app_accounts")).rows;
    assert.deepEqual(roles.map(row => row.role), ["member", "member"]);
    await asUser(existing, adminId);
    assert.equal((await existing.query<{data: {code: string}}>("select data from public.code_drafts")).rows[0].data.code, "# existing work");
    assert.equal((await existing.query<{data: {title: string}}>("select data from public.stories")).rows[0].data.title, "Saved story");
    assert.equal((await existing.query<{data: {scratchpad: string}}>("select data from public.interview_sessions")).rows[0].data.scratchpad, "Saved notes");
    assert.equal((await existing.query<{data: {displayName: string}}>("select data from public.profiles")).rows[0].data.displayName, "Existing owner");
  } finally {await existing.close();}
});
