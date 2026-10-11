import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { authFixture } from "./helpers/auth-database";

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const storyId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const db = new PGlite();
async function signIn(user: string | null, role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user || ""]);
  await db.exec(`set role ${role}`);
}
before(async () => {
  await db.exec(authFixture);
  await db.exec(readFileSync("supabase/migrations/202610100001_foundation.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202610100002_interview_agent.sql", "utf8"));
  await db.exec(readFileSync("supabase/seed.sql", "utf8"));
  await db.exec("update public.problem_definitions set data = data || '{\"tests\":[{\"name\":\"public example\",\"args\":[],\"expected\":0,\"example\":true},{\"name\":\"retired case\",\"args\":[],\"expected\":1}]}'::jsonb where problem_id='contains-duplicate'");
  await db.exec(readFileSync("supabase/migrations/202610100003_llm_judging.sql", "utf8"));
  await db.exec(readFileSync("supabase/migrations/202610100004_invite_only_users.sql", "utf8"));
});
after(async () => {await db.close();});

test("LLM judging migration removes fixed suites and preserves public examples", async () => {
  await db.exec("reset role");
  const result = await db.query<{data: {examples: {name: string}[]; tests?: unknown}}>("select data from public.problem_definitions where problem_id='contains-duplicate'");
  assert.equal(result.rows[0].data.tests, undefined);
  assert.deepEqual(result.rows[0].data.examples.map(e => e.name), ["public example"]);
});

test("Agent requests have separate persistent quotas and owner-only access", async () => {
  await signIn(owner);
  for (let i = 0; i < 30; i++) assert.equal((await db.query<{claim_agent_slot: boolean}>("select public.claim_agent_slot()")).rows[0].claim_agent_slot, true);
  assert.equal((await db.query<{claim_agent_slot: boolean}>("select public.claim_agent_slot()")).rows[0].claim_agent_slot, false);
  await signIn(other);
  assert.equal((await db.query("select * from public.agent_request_slots")).rows.length, 0);
  assert.equal((await db.query<{claim_agent_slot: boolean}>("select public.claim_agent_slot()")).rows[0].claim_agent_slot, true);
  await assert.rejects(db.query("insert into public.agent_request_slots(user_id) values ($1)", [owner]), /row-level security/);
});

test("Anonymous users cannot access any workspace tables", async () => {
  await signIn(null, "anon");
  for (const table of ["profiles", "stories", "code_drafts", "interview_sessions", "interview_events", "session_feedback", "attempts"]) {
    await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
  }
  await assert.rejects(db.query("select public.claim_execution_slot()"), /permission denied/);
  await assert.rejects(db.query("select public.claim_agent_slot()"), /permission denied/);
  await assert.rejects(db.query("select * from public.agent_request_slots"), /permission denied/);
});
test("Owner can save data; another account cannot read, update, or insert it", async () => {
  await signIn(owner);
  await db.query("insert into public.profiles(user_id,data) values($1,$2)", [owner, JSON.stringify({displayName: "Owner"})]);
  await db.query("insert into public.code_drafts(user_id,problem_id,language,data) values($1,'two-sum','python',$2)", [owner, JSON.stringify({code: "private draft"})]);
  await db.query("select public.save_story($1,$2,ARRAY['team-collaboration']::text[],$3)", [storyId, JSON.stringify({title: "Private story"}), "2026-10-10T12:00:00Z"]);
  await signIn(other);
  for (const table of ["profiles", "stories", "code_drafts", "story_question_links"]) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
  assert.equal((await db.query("update public.profiles set data='{}' where user_id=$1 returning *", [owner])).rows.length, 0);
  await assert.rejects(db.query("insert into public.profiles(user_id,data) values($1,'{}')", [owner]), /row-level security/);
  await assert.rejects(db.query("select public.save_story($1,'{}',ARRAY[]::text[],now())", [storyId]), /row-level security/);
  await signIn(owner);
  assert.equal((await db.query<{data: {title: string}}>("select data from public.stories where id=$1", [storyId])).rows[0].data.title, "Private story");
});
test("Story and question links commit atomically, and invalid links roll back", async () => {
  await signIn(owner);
  await assert.rejects(db.query("select public.save_story($1,$2,ARRAY['missing-question']::text[],$3)", [storyId, JSON.stringify({title: "Changed"}), "2026-10-10T13:00:00Z"]), /foreign key/);
  assert.equal((await db.query<{data: {title: string}}>("select data from public.stories where id=$1", [storyId])).rows[0].data.title, "Private story");
  assert.equal((await db.query("select * from public.story_question_links")).rows.length, 1);
});
test("Session events and feedback remain private; deleting a session keeps attempts", async () => {
  await signIn(owner);
  const event = {id: "55555555-5555-4555-8555-555555555555", role: "candidate", text: "private response", timestamp: "2026-10-10T12:00:01Z"};
  await db.query("select public.save_interview_session($1,$2,$3,$4,$5)", [sessionId, JSON.stringify({status: "active"}), JSON.stringify([event]), JSON.stringify({summary: "private feedback"}), "2026-10-10T12:00:02Z"]);
  await db.query("insert into public.attempts(id,user_id,problem_id,session_id,data) values($1,$2,'two-sum',$3,'{}')", ["66666666-6666-4666-8666-666666666666", owner, sessionId]);
  await signIn(other);
  for (const table of ["interview_sessions", "interview_events", "session_feedback", "attempts"]) assert.equal((await db.query(`select * from public.${table}`)).rows.length, 0);
  await assert.rejects(db.query("select public.save_interview_session($1,'{}','[]',null,now())", [sessionId]), /row-level security/);
  await signIn(owner);
  await db.query("delete from public.interview_sessions where id=$1", [sessionId]);
  assert.equal((await db.query("select * from public.interview_events")).rows.length, 0);
  assert.equal((await db.query("select * from public.session_feedback")).rows.length, 0);
  const attempts = await db.query<{session_id: string | null}>("select session_id from public.attempts");
  assert.equal(attempts.rows.length, 1); assert.equal(attempts.rows[0].session_id, null);
});
test("Stale session writes cannot reopen a completed interview", async () => {
  await signIn(owner);
  await db.query("select public.save_interview_session($1,$2,'[]',null,$3)", [sessionId, JSON.stringify({status: "completed"}), "2026-10-10T14:00:00Z"]);
  await db.query("select public.save_interview_session($1,$2,'[]',null,$3)", [sessionId, JSON.stringify({status: "active"}), "2026-10-10T15:00:00Z"]);
  assert.equal((await db.query<{data: {status: string}}>("select data from public.interview_sessions where id=$1", [sessionId])).rows[0].data.status, "completed");
});
test("Transcript order survives equal timestamps and repeated saves", async () => {
  await signIn(owner);
  const id = "77777777-7777-4777-8777-777777777777";
  const transcript = [
    {id: "99999999-9999-4999-8999-999999999999", role: "candidate", text: "first", timestamp: "2026-10-10T16:00:00Z"},
    {id: "88888888-8888-4888-8888-888888888888", role: "interviewer", text: "second", timestamp: "2026-10-10T16:00:00Z"},
  ];
  for (let i = 0; i < 2; i++) await db.query("select public.save_interview_session($1,$2,$3,null,$4)", [id, JSON.stringify({status: "active"}), JSON.stringify(transcript), "2026-10-10T16:00:01Z"]);
  const rows = await db.query<{data: {text: string}}>("select data from public.interview_events where session_id=$1 order by position", [id]);
  assert.deepEqual(rows.rows.map(row => row.data.text), ["first", "second"]);
});
test("Execution quotas are per-account and shared across server requests", async () => {
  await signIn(owner);
  for (let i = 0; i < 10; i++) assert.equal((await db.query<{allowed: boolean}>("select public.claim_execution_slot() as allowed")).rows[0].allowed, true);
  assert.equal((await db.query<{allowed: boolean}>("select public.claim_execution_slot() as allowed")).rows[0].allowed, false);
  await signIn(other);
  assert.equal((await db.query<{allowed: boolean}>("select public.claim_execution_slot() as allowed")).rows[0].allowed, true);
});
