import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { EXECUTION_MARKER, RESULT_MARKER, readVerification, verificationDriver, verifyCode, judgeProgram, parseJudgePlan, type JudgePlan } from "../src/lib/server/code-verification";
import { callInterviewer, agentRequestSchema } from "../src/lib/server/openai-interviewer";
import { interviewQuestion } from "../src/lib/problems/interview-questions";
import type { Attempt, InterviewSession } from "../src/lib/types";

const config = {key: "fixture-key", chatModel: "fixture-model", realtimeModel: "fixture-voice"};
const driver = verificationDriver("a".repeat(64));
const plan: JudgePlan = {verdict: "inconclusive", summary: "Cases selected independently.", testCode: "def sample(): return candidate['solve']([1, 2])", cases: [{name: "sample", entrypoint: "sample", input: "[1,2]", expected: 3, comparison: "exact"}]};
function planResponse(selected = plan) {
 return {status: "completed", id: "resp-plan", output: [{type: "message", content: [{type: "output_text", text: JSON.stringify({...selected, cases: selected.cases.map(c => ({...c, expected: JSON.stringify(c.expected)}))})}]}]};
}
function execution(code = driver, stdout = RESULT_MARKER + JSON.stringify([{name: "sample", actual: 3}]), overrides = {}) {
 return {status: "completed", output: [{type: "code_interpreter_call", status: "completed", code, outputs: [{type: "logs", logs: EXECUTION_MARKER + JSON.stringify({status: "completed", returncode: 0, stdout, stderr: "", runtimeMs: 12, ...overrides})}]}]};
}
function session(): InterviewSession & {roleId: "software-engineer"} {
 const now = new Date().toISOString();
 return {id: crypto.randomUUID(), type: "coding", roleId: "software-engineer", questionId: "lru-cache", language: "python", durationMinutes: 45, timed: false, status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "", transcript: [], adapter: "agent"};
}
test("LLM plans require complete modes, JSON expectations, and unique case names", () => {
 assert.deepEqual(parseJudgePlan(planResponse(), "python"), plan);
 assert.throws(() => parseJudgePlan(planResponse({...plan, cases: []}), "python"));
 assert.throws(() => parseJudgePlan(planResponse({...plan, cases: [plan.cases[0], plan.cases[0]]}), "python"));
 assert.throws(() => parseJudgePlan(planResponse(), "javascript"));
 assert.throws(() => parseJudgePlan({...planResponse(), status: "incomplete"}, "python"));
});
test("Execution requires real outputs from the unchanged driver, never model claims", () => {
 assert.equal(readVerification(execution(), driver, plan).status, "passed");
 assert.equal(readVerification(execution(driver, RESULT_MARKER + JSON.stringify([{name: "sample", actual: 4}])), driver, plan).status, "failed");
 assert.throws(() => readVerification({status: "completed", output: [{type: "message", content: [{text: "All tests passed"}]}]}, driver, plan));
 assert.throws(() => readVerification(execution(driver + "\n# repair"), driver, plan));
 assert.throws(() => readVerification(execution(driver, "no case results"), driver, plan));
 const duplicate = execution(); duplicate.output.push(duplicate.output[0]);
 assert.throws(() => readVerification(duplicate, driver, plan));
 const wrongNames = RESULT_MARKER + JSON.stringify([{name: "invented", actual: 3}]);
 assert.throws(() => readVerification(execution(driver, wrongNames), driver, plan));
});
test("AI comparisons preserve unordered multiplicity and errors/timeouts are honest", () => {
 const unordered: JudgePlan = {...plan, cases: [{...plan.cases[0], expected: [[1,2],[3]], comparison: "unordered-groups"}]};
 const run = (actual: number[][]) => readVerification(execution(driver, RESULT_MARKER + JSON.stringify([{name: "sample", actual}])), driver, unordered);
 assert.equal(run([[3],[2,1]]).status, "passed"); assert.equal(run([[3],[2,1],[3]]).status, "failed");
 assert.match(readVerification(execution(driver, "", {returncode: 1, stderr: "bad runner"}), driver, plan).error!, /does not establish/);
 assert.equal(readVerification(execution(driver, "", {status: "timeout", returncode: -1}), driver, plan).status, "timeout");
});
test("Generated runners execute unchanged standalone functions, Solution classes, and stateful APIs", () => {
 for (const [code, testCode] of [
  ["def solve(values):\n    return sum(values)", "def sample(): return candidate['solve']([1, 2])"],
  ["def solve(values):\n    return sum(values)", "def sample(): return solve([1, 2])"],
  ["def solve(values):\n    return sum(values)", "__ip_results = []\ndef check(*args): pass\ndef sample(): return candidate['solve']([1, 2])"],
  ["class Solution:\n    def solve(self, values):\n        return sum(values)", "def sample(): return candidate['Solution']().solve([1, 2])"],
  ["class Counter:\n    def __init__(self, value): self.value = value\n    def add(self, value): self.value += value\n    def get(self): return self.value", "def sample():\n    obj = candidate['Counter'](1)\n    obj.add(2)\n    return obj.get()"],
 ]) {
  const result = spawnSync("python3", ["-c", judgeProgram(code, "", testCode, plan.cases)], {encoding: "utf8"});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"actual": 3/);
 }
 const prelude = interviewQuestion("copy-list-with-random-pointer")!.pythonPrelude;
 const result = spawnSync("python3", ["-c", judgeProgram("def solve(): return Node(3).val", prelude, "def sample(): return candidate['solve']()", plan.cases)], {encoding: "utf8"});
 assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /"actual": 3/);
 const replacement = spawnSync("python3", ["-c", judgeProgram("def solve(values): return 3", "", "def solve(values): return 42\ndef sample(): return solve([1,2])", plan.cases)], {encoding: "utf8"});
 assert.notEqual(replacement.status, 0); assert.match(replacement.stderr, /Runner replaced a candidate declaration/);
});
test("All questions reach LLM judgment; source saves before selection, bounded execution, cleanup", async () => {
 const saves: Attempt[] = [], methods: string[] = [];
 const code = "class LRUCache: pass";
 const attempt = await verifyCode({sessionId: crypto.randomUUID(), problemId: "lru-cache", language: "python", code}, config, async (url, init) => {
  methods.push(init?.method || "GET");
  assert.equal(saves[0].code, code); assert.equal(saves[0].result.status, "queued");
  if (init?.method === "DELETE") return Response.json({deleted: true});
  if (String(url).endsWith("/files")) {
   const form = init!.body as FormData;
   const uploaded = await (form.get("file") as Blob).text();
   assert.ok(uploaded.includes(Buffer.from(code).toString("base64"))); assert.ok(uploaded.includes("runpy.run_path"));
   return Response.json({id: "file-fixture"});
  }
  const body = JSON.parse(String(init?.body));
  if (!body.tools) {assert.match(body.instructions, /no predefined or hidden tests/); assert.ok(JSON.parse(body.input).code === code); return Response.json(planResponse());}
  assert.equal(body.tools[0].type, "code_interpreter"); assert.deepEqual(body.tools[0].container.network_policy, {type: "disabled"}); assert.equal(body.max_tool_calls, 1);
  const actualDriver = body.instructions.slice(body.instructions.indexOf("import hashlib"));
  const result = execution(actualDriver);
  return Response.json({...result, id: "resp-exec", output: result.output.map(item => ({...item, container_id: "cntr_fixture"}))});
 }, async attempt => {saves.push(structuredClone(attempt));});
 assert.equal(attempt.result.status, "passed"); assert.equal(attempt.code, code); assert.equal(attempt.result.assessment?.method, "llm-generated-execution");
 assert.deepEqual(saves.map(a => a.result.status), ["queued", "passed"]); assert.deepEqual(methods, ["POST", "POST", "POST", "DELETE", "DELETE"]);
});
test("JavaScript/TypeScript get reasoning reviews without invented execution or provider errors", async () => {
 for (const language of ["javascript", "typescript"] as const) {
  let requests = 0;
  const attempt = await verifyCode({sessionId: crypto.randomUUID(), problemId: "alien-dictionary", language, code: "candidate source"}, config, async () => {requests++; return Response.json(planResponse({...plan, testCode: "", cases: [], summary: "Incomplete implementation.", verdict: "inconclusive"}));});
  assert.equal(requests, 1); assert.equal(attempt.result.status, "reviewed"); assert.equal(attempt.result.assessment?.method, "llm-review"); assert.deepEqual(attempt.result.tests, []);
 }
 const unavailable = await verifyCode({sessionId: crypto.randomUUID(), problemId: "lru-cache", language: "python", code: "pass"}, config, async () => new Response("secret body", {status: 500}));
 assert.equal(unavailable.result.status, "error"); assert.doesNotMatch(unavailable.result.error!, /secret/);
});
test("Save failure prevents provider calls and truncated or behavioral input cannot be judged", async () => {
 let requests = 0;
 await assert.rejects(verifyCode({sessionId: crypto.randomUUID(), problemId: "lru-cache", code: "pass", language: "python"}, config, async () => {requests++; return Response.json({});}, async () => {throw new Error("save failed");}), /save failed/);
 assert.equal(requests, 0);
 await assert.rejects(callInterviewer({action: "verify", session: session(), context: {code: "partial", codeTruncated: true}}, config), /too long/);
 assert.equal(agentRequestSchema.safeParse({action: "verify", session: {...session(), type: "behavioral", questionId: "team-collaboration"}, context: {code: "pass"}}).success, false);
});
test("Typed and voice interviews expose judging for previously uncheckable problems", async () => {
 let round = 0;
 const result = await callInterviewer({action: "reply", session: session(), context: {code: "class LRUCache {}", language: "javascript"}}, config, async (_url, init) => {
  const body = JSON.parse(String(init?.body));
  if (round++ === 0) {assert.equal(body.tools[0].name, "verify_code"); return Response.json({status: "completed", output: [{type: "function_call", name: "verify_code", call_id: "call_1", arguments: "{}"}]});}
  if (body.text) return Response.json(planResponse({...plan, cases: [], testCode: "", summary: "Missing methods.", verdict: "inconclusive"}));
  assert.match(body.input.at(-1).output, /llm-review/);
  return Response.json({status: "completed", output: [{type: "message", content: [{type: "output_text", text: "My reasoning assessment is inconclusive; this code was not executed."}]}]});
 });
 assert.equal(result.attempts?.[0].result.status, "reviewed"); assert.match(result.text!, /not executed/);
 await callInterviewer({action: "voice", session: session(), sdp: "v=0\r\no=test"}, config, async (_url, init) => {
  const payload = JSON.parse(String((init!.body as FormData).get("session")));
  assert.equal(payload.tools[0].name, "verify_code"); return new Response("v=0\r\no=answer");
 });
});
