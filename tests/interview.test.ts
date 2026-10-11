import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyWorkspace, applyMutation, draftKey, type InterviewSession } from "../src/lib/types";
import { executionSchema, sessionSchema } from "../src/lib/validation";
import { assertSameOrigin, readJson } from "../src/lib/server/http";
function session(): InterviewSession {const time = new Date().toISOString(); return {id: crypto.randomUUID(), roleId: "software-engineer", type: "behavioral", questionId: "team-collaboration", durationMinutes: 30, timed: true, language: "python", status: "active", startedAt: time, lastActiveAt: time, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent"};}
test("Workspace updates preserve separate drafts and detach attempts on session deletion", () => {
  let data = emptyWorkspace(); const time = new Date().toISOString();
  for (const language of ["python", "typescript"] as const) data = applyMutation(data, {kind: "draft", value: {problemId: "two-sum", language, code: `${language} draft`, updatedAt: time}});
  assert.equal(data.drafts[draftKey("two-sum", "python")].code, "python draft"); assert.equal(data.drafts[draftKey("two-sum", "typescript")].code, "typescript draft");
  const s = session(); data = applyMutation(data, {kind: "session", value: s});
  data.attempts = [{id: crypto.randomUUID(), problemId: "two-sum", problemVersion: 1, language: "python", code: "draft", mode: "run", createdAt: time, sessionId: s.id, result: {status: "passed", tests: [], stdout: ""}}];
  data = applyMutation(data, {kind: "delete-session", id: s.id}); assert.equal(data.sessions.length, 0); assert.equal(data.attempts.length, 1); assert.equal(data.attempts[0].sessionId, undefined);
});
test("Validation rejects unknown questions, extra execution options and oversized input", async () => {
  assert.equal(sessionSchema.safeParse({...session(), questionId: "does-not-exist"}).success, false);
  assert.equal(executionSchema.safeParse({problemId: "two-sum", language: "python", code: "a", mode: "run", enable_network: true}).success, false);
  assert.equal(executionSchema.safeParse({problemId: "not-runnable", language: "python", code: "a", mode: "run"}).success, false);
  assert.throws(() => assertSameOrigin(new Request("https://app.example/api/workspace", {headers: {origin: "https://other.example"}})), /must come from/);
  assert.throws(() => assertSameOrigin(new Request("https://app.example/api/workspace")), /must come from/);
  assertSameOrigin(new Request("https://app.example/api/workspace", {headers: {origin: "https://app.example"}}));
  await assert.rejects(readJson(new Request("https://app.example", {method: "POST", body: JSON.stringify({large: "a".repeat(2000)})}), 100), /too large/);
});
