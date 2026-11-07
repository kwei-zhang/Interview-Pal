import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { agentRequestSchema, callInterviewer } from "../src/lib/server/openai-interviewer";
import { OpenAIInterviewAgent } from "../src/lib/interview/openai-agent";
import { agentSession } from "../src/lib/interview/context";
import type { InterviewAgentEvent } from "../src/lib/interview/agent";
import { sessionSchema } from "../src/lib/validation";
import type { InterviewSession } from "../src/lib/types";
import { loadWorkspace, saveMutation } from "../src/lib/server/workspace";
import { setupNeon, asNeonUser, adminId, memberId } from "./helpers/neon-database";

function session(): InterviewSession {
  const now = new Date().toISOString();
  return {id: crypto.randomUUID(), type: "project", roleId: "software-engineer", questionId: "project-overview", durationMinutes: 30, timed: false, language: "python", status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "private-notes-never-share", transcript: [], adapter: "agent", project: {id: "legacy-name:Checkout service", name: "Checkout service", bullets: ["Built an **idempotent** payment API.", "Reduced payment failures by 30%."]}};
}
const config = {key: "test-key", chatModel: "chat-test", realtimeModel: "voice-test"};
function output(text: string) {return Response.json({status: "completed", output: [{type: "message", content: [{type: "output_text", text}]}]});}

test("Project interviews require bounded material and cannot be mixed with another interview type", () => {
  const current = session();
  assert.ok(sessionSchema.safeParse(current).success);
  for (const invalid of [
    {...current, project: undefined}, {...current, questionId: "two-sum"},
    {...current, project: {...current.project!, bullets: []}},
    {...current, project: {...current.project!, bullets: ["   "]}},
    {...current, project: {...current.project!, bullets: ["x".repeat(4001)]}},
    {...current, project: {...current.project!, bullets: Array(6).fill("x".repeat(4000))}},
    {...current, type: "coding", questionId: "two-sum"},
    {...current, type: "behavioral", questionId: "team-collaboration"},
  ]) assert.equal(sessionSchema.safeParse(invalid).success, false);
  assert.equal(agentRequestSchema.safeParse({action: "verify", session: current, context: {code: "print(1)"}}).success, false);
});

for (const action of ["reply", "voice", "feedback"] as const) {
  test(`Project ${action} uses the real provider integration with selected material and no coding tools`, async () => {
    const current = session();
    const request = agentRequestSchema.parse({action, session: agentSession(current), context: {code: "unrelated-code", testSummary: "unrelated-test"}, ...(action === "voice" ? {sdp: "v=0\r\no=test-offer"} : {})});
    let called = false;
    await callInterviewer(request, config, async (url, init) => {
      called = true;
      const body = action === "voice" ? JSON.parse(String((init!.body as FormData).get("session"))) : JSON.parse(String(init!.body));
      assert.equal(url, action === "voice" ? "https://api.openai.com/v1/realtime/calls" : "https://api.openai.com/v1/responses");
      assert.match(body.instructions, /PROJECT DEEP DIVE/);
      assert.match(body.instructions, /Checkout service/);
      for (const bullet of current.project!.bullets) assert.ok(body.instructions.includes(bullet));
      assert.match(body.instructions, /one focused follow-up at a time/);
      assert.doesNotMatch(body.instructions, /private-notes-never-share|unrelated-code|unrelated-test|SOLUTION REVEAL RULE/);
      assert.equal(body.tools, undefined);
      if (action === "voice") {
        assert.match(body.instructions, /Speak first/);
        return new Response("v=0\r\no=test-answer");
      }
      assert.equal(body.store, false);
      if (action === "feedback") {
        assert.match(body.instructions, /Do not treat resume claims alone as demonstrated competence/);
        assert.equal(body.text.format.name, "interview_feedback");
        return output(JSON.stringify({summary: "Insufficient evidence.", strengths: [], improvements: [], evidence: [], nextActions: [], dimensions: []}));
      }
      return output("How did you ensure retried payments were idempotent?");
    });
    assert.equal(called, true);
  });
}

test("Resumed project voice keeps previous answers and does not repeat the opening", async () => {
  const current = session();
  current.transcript.push({id: crypto.randomUUID(), role: "candidate", text: "I used a unique request key to deduplicate retries.", timestamp: current.startedAt});
  await callInterviewer(agentRequestSchema.parse({action: "voice", session: agentSession(current), sdp: "v=0\r\no=test-offer"}), config, async (_url, init) => {
    const body = JSON.parse(String((init!.body as FormData).get("session")));
    assert.match(body.instructions, /Resume the project interview/);
    assert.match(body.instructions, /unique request key/);
    assert.doesNotMatch(body.instructions, /Speak first/);
    return new Response("v=0\r\no=test-answer");
  });
});

test("Project typed chat opens once, sends the snapshot, and preserves a failed turn for retry", async () => {
  let calls = 0;
  const current = session();
  const events: InterviewAgentEvent[] = [];
  const agent = new OpenAIInterviewAgent(async (_url, init) => {
    const body = JSON.parse(String(init!.body));
    assert.deepEqual(body.session.project, current.project);
    assert.equal(body.session.scratchpad, "");
    assert.equal(body.session.transcript.filter((e: {role: string}) => e.role === "candidate").length, 1);
    if (++calls === 1) return Response.json({error: "Unavailable"}, {status: 503});
    return Response.json({text: "How did you measure the reduction in failures?"});
  });
  agent.subscribe(e => events.push(e));
  await agent.startSession(current);
  await assert.rejects(agent.sendInput({text: "I owned the payment API."}), /Unavailable/);
  await agent.sendInput({text: "I owned the payment API."});
  const transcript = events.filter(e => e.type === "transcript").map(e => e.event);
  assert.match(transcript[0].text, /Checkout service/);
  assert.deepEqual(transcript.map(e => e.role), ["interviewer", "candidate", "interviewer"]);
  agent.dispose();
  const resumed = new OpenAIInterviewAgent(); const resumedEvents: InterviewAgentEvent[] = [];
  resumed.subscribe(e => resumedEvents.push(e));
  await resumed.startSession({...current, transcript});
  assert.equal(resumedEvents.filter(e => e.type === "transcript").length, 0);
  resumed.dispose();
});

test("Project snapshots and reviews persist independently of preparation material and remain private", async () => {
  const db = new PGlite();
  try {
    await setupNeon(db); await asNeonUser(db, adminId);
    const current = session();
    const bullet = {id: crypto.randomUUID(), project: current.project!.name, text: current.project!.bullets[0], updatedAt: current.startedAt};
    await saveMutation(db, adminId, {kind: "resume-bullet", value: bullet});
    await saveMutation(db, adminId, {kind: "session", value: sessionSchema.parse(current)});
    await saveMutation(db, adminId, {kind: "delete-resume-bullet", id: bullet.id});
    let workspace = await loadWorkspace(db, adminId);
    assert.deepEqual(workspace.resumeBullets, []);
    assert.deepEqual(workspace.sessions[0].project, current.project);
    current.transcript.push({id: crypto.randomUUID(), role: "candidate", text: "I designed the payment API.", timestamp: current.startedAt});
    current.status = "completed";
    current.feedback = {source: "agent", summary: "Discussed API ownership.", strengths: [], improvements: [], evidence: ["I designed the payment API."], nextActions: [], dimensions: []};
    await saveMutation(db, adminId, {kind: "session", value: sessionSchema.parse(current)});
    workspace = await loadWorkspace(db, adminId);
    assert.deepEqual(workspace.sessions[0], current);
    await asNeonUser(db, memberId);
    assert.deepEqual((await loadWorkspace(db, memberId)).sessions, []);
    assert.deepEqual((await loadWorkspace(db, adminId)).sessions, []);
    await assert.rejects(saveMutation(db, memberId, {kind: "session", value: current}), /row-level security/);
  } finally {await db.close();}
});
