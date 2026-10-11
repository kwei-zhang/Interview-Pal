// Test-only Supabase HTTP fixture. Uses the real SQL migrations/RLS in PGlite;
// substitutes Auth email delivery and password handling, never contacts Supabase.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { asUser, setupAuthDatabase, adminId, memberId } from "./auth-database";

const db = new PGlite();
const passwords = new Map([[adminId, "Admin-password-2026"], [memberId, "Member-password-2026"]]);
const sessions = new Map<string, string>();
const mail = new Map<string, {email: string; userId: string; type: string; token: string; redirectTo: string | null}>();
type UserRow = {id: string; email: string; email_confirmed_at: string | null; raw_user_meta_data: Record<string, unknown>; created_at: string};
async function userBy(field: "email" | "id", value: string): Promise<UserRow | undefined> {
  await db.exec("reset role");
  return (await db.query<UserRow>(`select * from auth.users where ${field}=$1`, [value])).rows[0];
}
function authUser(user: UserRow) {return {id: user.id, email: user.email, email_confirmed_at: user.email_confirmed_at, is_anonymous: false,
  aud: "authenticated", role: "authenticated", created_at: user.created_at, app_metadata: {provider: "email", providers: ["email"]}, user_metadata: user.raw_user_meta_data, identities: []};}
function session(user: UserRow) {
  const encode = (input: unknown) => Buffer.from(JSON.stringify(input)).toString("base64url");
  const token = `${encode({alg: "HS256", typ: "JWT"})}.${encode({sub: user.id, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now()/1000)+3600, jti: randomUUID()})}.${encode("test-signature")}`;
  sessions.set(token, user.id);
  return {access_token: token, refresh_token: randomUUID(), expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, token_type: "bearer", user: authUser(user)};
}
function sendMail(user: UserRow, type: string, redirectTo: string | null) {
  mail.set(user.email, {email: user.email, userId: user.id, type, token: randomUUID(), redirectTo});
}
async function handle(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || "/", "http://127.0.0.1:54329");
  const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
  const reply = (data: unknown, status = 200) => {response.writeHead(status, {"Content-Type": "application/json", "Cache-Control": "no-store", "X-Supabase-Api-Version": "2024-01-01"}); response.end(JSON.stringify(data));};
  const fail = (message: string, status = 400, code = "validation_failed") => reply({msg: message, message, code}, status);
  const token = request.headers.authorization?.replace(/^Bearer /i, "") || "";
  const id = sessions.get(token);
  if (url.pathname === "/health") return reply({ok: true});
  if (url.pathname === "/__test/mailbox") return reply(mail.get(url.searchParams.get("email") || "") || null);
  if (url.pathname === "/auth/v1/token") {
    const user = await userBy("email", String(body.email).trim().toLowerCase());
    if (!user || passwords.get(user.id) !== body.password) return fail("Invalid credentials", 400, "invalid_credentials");
    if (!user.email_confirmed_at) return fail("Email not confirmed", 400, "email_not_confirmed");
    return reply(session(user));
  }
  if (url.pathname === "/auth/v1/signup") {
    const email = String(body.email).trim().toLowerCase();
    const existing = await userBy("email", email);
    if (existing) {if (!existing.email_confirmed_at) sendMail(existing, "email", url.searchParams.get("redirect_to")); return reply({user: authUser(existing), session: null});}
    await asUser(db, null, "supabase_auth_admin");
    const check = (await db.query<{result: {error?: {message: string}}}>("select public.before_user_created($1) as result", [{user: {email, app_metadata: {provider: "email"}, user_metadata: body.data}}])).rows[0].result;
    if (check.error) return fail(check.error.message);
    const userId = randomUUID();
    await db.transaction(async tx => {
      await tx.query("insert into auth.users(id,email,raw_user_meta_data) values ($1,$2,$3)", [userId, email, body.data]);
      await tx.query("insert into auth.identities(user_id,identity_data) values ($1,$2)", [userId, {...body.data, email}]);
    });
    passwords.set(userId, body.password);
    const user = (await userBy("id", userId))!;
    sendMail(user, "email", url.searchParams.get("redirect_to")); return reply({user: authUser(user), session: null});
  }
  if (url.pathname === "/auth/v1/resend" || url.pathname === "/auth/v1/recover") {
    const user = await userBy("email", String(body.email).trim().toLowerCase());
    if (user && (url.pathname.endsWith("recover") || !user.email_confirmed_at)) sendMail(user, url.pathname.endsWith("recover") ? "recovery" : "email", url.searchParams.get("redirect_to"));
    return reply({});
  }
  if (url.pathname === "/auth/v1/verify") {
    const message = [...mail.values()].find(item => item.token === body.token_hash && item.type === body.type);
    if (!message) return fail("Link expired", 403, "otp_expired");
    mail.delete(message.email);
    await db.exec("reset role");
    await db.query("update auth.users set email_confirmed_at=coalesce(email_confirmed_at,now()) where id=$1", [message.userId]);
    return reply(session((await userBy("id", message.userId))!));
  }
  if (url.pathname === "/auth/v1/logout") {
    if (url.searchParams.get("scope") === "global") {for (const [key, userId] of sessions) if (userId === id) sessions.delete(key);}
    else sessions.delete(token);
    return reply({});
  }
  if (url.pathname === "/auth/v1/user") {
    const user = id ? await userBy("id", id) : undefined;
    if (!user) return fail("Not authenticated", 401, "bad_jwt");
    if (request.method === "PUT" && body.password) passwords.set(user.id, body.password);
    return reply(authUser(user));
  }
  if (!url.pathname.startsWith("/rest/v1/") || !id) return fail("Not authenticated", 401);
  await asUser(db, id);
  const path = url.pathname.slice("/rest/v1/".length);
  if (path.startsWith("rpc/")) {
    const name = path.slice(4);
    const calls: Record<string, {sql: string; args: unknown[]; rows?: boolean}> = {
      admin_create_invitation: {sql: "select public.admin_create_invitation($1,$2) as value", args: [body.recipient_email, body.token_hash]},
      admin_list_invitations: {sql: "select * from public.admin_list_invitations($1)", args: [body.page_offset || 0], rows: true},
      admin_revoke_invitation: {sql: "select public.admin_revoke_invitation($1) as value", args: [body.invitation_id]},
      admin_list_users: {sql: "select * from public.admin_list_users($1)", args: [body.page_offset || 0], rows: true},
      admin_set_user_status: {sql: "select public.admin_set_user_status($1,$2) as value", args: [body.target_user_id, body.new_status]},
      claim_agent_slot: {sql: "select public.claim_agent_slot() as value", args: []},
      claim_execution_slot: {sql: "select public.claim_execution_slot() as value", args: []},
      save_story: {sql: "select public.save_story($1,$2,$3,$4) as value", args: [body.story_id, body.story_data, body.question_ids, body.modified_at]},
      save_interview_session: {sql: "select public.save_interview_session($1,$2,$3,$4,$5) as value", args: [body.session_id, body.session_data, body.transcript_data, body.feedback_data, body.modified_at]},
    };
    const call = calls[name]; if (!call) return fail("Unsupported test RPC", 404);
    const result = await db.query<{value: unknown}>(call.sql, call.args);
    return reply(call.rows ? result.rows : result.rows[0]?.value ?? null);
  }
  const tables = ["app_accounts", "profiles", "problem_progress", "code_drafts", "stories", "story_question_links", "interview_sessions", "interview_events", "session_feedback", "attempts"];
  if (!tables.includes(path)) return fail("Unsupported test table", 404);
  if (request.method === "POST" && path === "profiles") {
    await db.query("insert into public.profiles(user_id,data) values ($1,$2) on conflict(user_id) do update set data=excluded.data", [body.user_id, body.data]); return reply(null, 201);
  }
  if (request.method === "POST" && path === "code_drafts") {
    await db.query("insert into public.code_drafts(user_id,problem_id,language,data,updated_at) values ($1,$2,$3,$4,$5) on conflict(user_id,problem_id,language) do update set data=excluded.data,updated_at=excluded.updated_at", [body.user_id, body.problem_id, body.language, body.data, body.updated_at]); return reply(null, 201);
  }
  if (request.method === "POST" && path === "problem_progress") {
    await db.query("insert into public.problem_progress(user_id,problem_id,data,updated_at) values ($1,$2,$3,$4) on conflict(user_id,problem_id) do update set data=excluded.data,updated_at=excluded.updated_at", [body.user_id, body.problem_id, body.data, body.updated_at]); return reply(null, 201);
  }
  if (request.method !== "GET") return fail("Unsupported test operation", 405);
  let rows = (await db.query<Record<string, unknown>>(`select * from public.${path}`)).rows;
  for (const field of ["id", "user_id"]) {
    const filter = url.searchParams.get(field); if (filter?.startsWith("eq.")) rows = rows.filter(row => row[field] === filter.slice(3));
  }
  return reply(rows);
}
let work = Promise.resolve();
const server = createServer((request, response) => {
  work = work.then(async () => {
    try {await handle(request, response);}
    catch (error) {
      const issue = error as {message?: string; code?: string};
      response.writeHead(400, {"Content-Type": "application/json"}); response.end(JSON.stringify({message: issue.message || "Test provider failure", code: issue.code}));
    }
  });
});
void setupAuthDatabase(db).then(() => server.listen(54329, "127.0.0.1", () => console.log("Auth test fixture ready on 54329"))).catch(error => {console.error(error); process.exit(1);});
process.on("SIGTERM", () => {server.close(); void db.close().then(() => process.exit(0));});
