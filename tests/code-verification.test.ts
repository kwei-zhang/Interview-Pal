import { test } from "node:test";
import assert from "node:assert/strict";
import { EXECUTION_MARKER, readVerification, verificationDriver, verifyCode } from "../src/lib/server/code-verification";
import { definitions } from "../src/lib/problems/definitions";
import { RESULT_MARKER } from "../src/lib/problems/harness";
import { callInterviewer, agentRequestSchema } from "../src/lib/server/openai-interviewer";
import type { Attempt, InterviewSession } from "../src/lib/types";

const config = {key: "fixture-key", chatModel: "fixture-model", realtimeModel: "fixture-voice"};
const problem = definitions["contains-duplicate"];
const driver = verificationDriver("a".repeat(64));
function execution(code = driver, stdout = RESULT_MARKER + JSON.stringify(problem.tests.map(t => ({actual: t.expected}))), overrides = {}) {
 return {status: "completed", output: [{type: "code_interpreter_call", status: "completed", code, outputs: [{type: "logs", logs: EXECUTION_MARKER + JSON.stringify({status: "completed", returncode: 0, stdout, stderr: "", runtimeMs: 12, ...overrides})}]}]};
}
function session(): InterviewSession & {roleId: "software-engineer"} {
 const now = new Date().toISOString();
 return {id: crypto.randomUUID(), type: "coding", roleId: "software-engineer", questionId: problem.id, language: "python", durationMinutes: 45, timed: false, status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent"};
}
test("Verification requires actual outputs from exactly the unchanged driver, never model claims", () => {
 assert.equal(readVerification(execution(), driver, problem.id).status, "passed");
 assert.equal(readVerification(execution(driver, RESULT_MARKER + JSON.stringify(problem.tests.map(() => ({actual: false})))), driver, problem.id).status, "failed");
 assert.throws(() => readVerification({status: "completed", output: [{type: "message", content: [{text: "All tests passed"}]}]}, driver, problem.id));
 assert.throws(() => readVerification(execution(driver + "\n# repaired candidate"), driver, problem.id));
 assert.throws(() => readVerification({...execution(), status: "incomplete"}, driver, problem.id));
 assert.throws(() => readVerification(execution(driver, "missing results"), driver, problem.id));
 const duplicate = execution(); duplicate.output.push(duplicate.output[0]);
 assert.throws(() => readVerification(duplicate, driver, problem.id));
});
test("Verification distinguishes Python errors and timeouts from successful tests", () => {
 assert.equal(readVerification(execution(driver, "", {returncode: 1, stderr: "SyntaxError: invalid syntax"}), driver, problem.id).error, "SyntaxError: invalid syntax");
 assert.equal(readVerification(execution(driver, "", {status: "timeout", returncode: -1}), driver, problem.id).status, "timeout");
 assert.equal(readVerification(execution(driver, "", {returncode: -24}), driver, problem.id).status, "timeout");
});
test("Upload preserves source, execution is isolated, snapshots save first, and files are deleted", async () => {
 const saves: Attempt[] = [], methods: string[] = [];
 const code = "class Solution:\n    def containsDuplicate(self, nums):\n        return len(nums) != len(set(nums))";
 const attempt = await verifyCode({sessionId: crypto.randomUUID(), problemId: problem.id, language: "python", code}, config, async (url, init) => {
  methods.push(init?.method || "GET");
  if (String(url).endsWith("/files") && init?.method === "POST") {
   assert.equal(saves[0].result.status, "queued"); assert.equal(saves[0].code, code);
   const form = init.body as FormData;
   assert.ok((await (form.get("file") as Blob).text()).includes(code));
   assert.equal(form.get("expires_after[seconds]"), "3600");
   return Response.json({id: "file-fixture"});
  }
  if (init?.method === "DELETE") return Response.json({deleted: true});
  const body = JSON.parse(String(init?.body));
  assert.equal(body.tools[0].type, "code_interpreter"); assert.deepEqual(body.tools[0].container.network_policy, {type: "disabled"});
  assert.equal(body.store, false); assert.equal(body.max_tool_calls, 1);
  const actualDriver = body.instructions.slice(body.instructions.indexOf("import hashlib"));
  const result = execution(actualDriver);
  return Response.json({...result, id: "resp-fixture", output: result.output.map(item => ({...item, container_id: "cntr_fixture"}))});
 }, async attempt => {saves.push(structuredClone(attempt));});
 assert.equal(attempt.result.status, "passed"); assert.equal(attempt.code, code);
 assert.deepEqual(saves.map(a => a.result.status), ["queued", "passed"]);
 assert.deepEqual(methods, ["POST", "POST", "DELETE", "DELETE"]);
});
test("Unsupported languages and provider failures retain code without fabricated passes", async () => {
 for (const language of ["javascript", "typescript", "python"] as const) {
  let requests = 0;
  const attempt = await verifyCode({sessionId: crypto.randomUUID(), problemId: problem.id, language, code: "candidate source"}, config, async () => {requests++; return new Response("secret failure", {status: 500});});
  assert.equal(attempt.code, "candidate source"); assert.equal(attempt.result.status, "error"); assert.deepEqual(attempt.result.tests, []);
  assert.doesNotMatch(attempt.result.error!, /secret/);
  assert.equal(requests, language === "python" ? 1 : 0);
 }
});
test("Saving failure prevents any execution, and truncated code cannot be verified", async () => {
 let requests = 0;
 await assert.rejects(verifyCode({sessionId: crypto.randomUUID(), problemId: problem.id, code: "pass", language: "python"}, config, async () => {requests++; return Response.json({});}, async () => {throw new Error("save failed");}), /save failed/);
 assert.equal(requests, 0);
 await assert.rejects(callInterviewer({action: "verify", session: session(), context: {code: "partial", codeTruncated: true}}, config, async () => {requests++; return Response.json({});}), /too long/);
 assert.equal(requests, 0);
 assert.equal(agentRequestSchema.safeParse({action: "verify", session: {...session(), type: "behavioral", questionId: "team-collaboration"}, context: {code: "pass"}}).success, false);
});
test("Typed interviewer calls verification and consumes tool output before answering", async () => {
 const current = session();
 current.transcript.push({id: crypto.randomUUID(), role: "candidate", text: "Please test my code.", timestamp: current.startedAt});
 let round = 0;
 const result = await callInterviewer({action: "reply", session: current, context: {code: "function containsDuplicate(nums) {}", language: "javascript"}}, config, async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  if (round++ === 0) {
   assert.equal(body.tools[0].name, "verify_code");
   return Response.json({status: "completed", output: [{type: "function_call", name: "verify_code", call_id: "call_1", arguments: "{}"}]});
  }
  assert.equal(body.tool_choice, "none");
  assert.equal(body.input.at(-1).type, "function_call_output");
  assert.match(body.input.at(-1).output, /Not executed/);
  return Response.json({status: "completed", output: [{type: "message", content: [{type: "output_text", text: "Use LeetCode to execute JavaScript."}]}]});
 });
 assert.equal(result.attempts?.length, 1); assert.equal(result.attempts?.[0].result.status, "error"); assert.match(result.text!, /LeetCode/);
});
