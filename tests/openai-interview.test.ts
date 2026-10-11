import { test } from "node:test";
import assert from "node:assert/strict";
import { agentRequestSchema, callInterviewer, interviewerInstructions, openAIConfig } from "../src/lib/server/openai-interviewer";
import { OpenAIInterviewAgent } from "../src/lib/interview/openai-agent";
import { RealtimeEvents } from "../src/lib/interview/realtime-events";
import { sessionSchema } from "../src/lib/validation";
import { agentSession, codeContext } from "../src/lib/interview/context";
import type { InterviewSession } from "../src/lib/types";
import type { InterviewAgentEvent } from "../src/lib/interview/agent";

function session(): InterviewSession {
  const now = new Date().toISOString();
  return {id: crypto.randomUUID(), type: "coding", roleId: "software-engineer", questionId: "contains-duplicate", durationMinutes: 45, timed: true, language: "python", status: "active", startedAt: now, lastActiveAt: now, elapsedSeconds: 0, scratchpad: "private scratchpad", transcript: [], adapter: "agent"};
}
const config = {key: "test-key", chatModel: "chat-test", realtimeModel: "voice-test"};
function output(text: string) {return Response.json({status: "completed", output: [{type: "message", content: [{type: "output_text", text}]}]});}

test("Real interviewer is anchored to app constraints, conversation, and code without hidden tests or notes", async () => {
  const current = session(); current.transcript.push({id: crypto.randomUUID(), role: "candidate", text: "Can nums be empty?", timestamp: current.startedAt});
  const request = {action: "reply" as const, session: sessionSchema.parse(agentSession(current)), context: codeContext({code: "def containsDuplicate(nums): return False", language: "python"})};
  const instructions = interviewerInstructions(request);
  assert.ok(instructions.includes("0 ≤ number of elements ≤ 100,000")); assert.ok(instructions.includes("input may be empty"));
  assert.ok(!instructions.includes("Negative duplicate")); assert.ok(!instructions.includes("private scratchpad"));
  const result = await callInterviewer(request, config, async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.model, "chat-test");
    assert.equal(body.input.at(-1).content, "Can nums be empty?");
    assert.ok(body.instructions.includes("def containsDuplicate"));
    return output("Yes, an empty input is allowed and should return false.");
  });
  assert.match(result.text!, /empty input/);
});
test("Voice handshake keeps key on server, uses WebRTC SDP and semantic turn detection", async () => {
  const result = await callInterviewer({action: "voice", session: sessionSchema.parse(agentSession(session())), sdp: "v=0\r\no=example-offer"}, config, async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/realtime/calls");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
    const form = init!.body as FormData; assert.match(String(form.get("sdp")), /^v=0/);
    const body = JSON.parse(String(form.get("session")));
    assert.equal(body.model, "voice-test"); assert.equal(body.audio.input.turn_detection.interrupt_response, true);
    assert.equal(body.audio.input.transcription.language, "en");
    assert.match(body.instructions, /Speak first/);
    return new Response("v=0\r\no=example-answer");
  });
  assert.equal(result.sdp, "v=0\r\no=example-answer");
  assert.ok(!JSON.stringify(result).includes("test-key"));
});
test("Feedback accepts evidence and agent-defined dimensions, rejects broken model output", async () => {
  const feedback = {summary: "Insufficient evidence.", strengths: [], improvements: [], evidence: [], nextActions: ["Practice explaining an approach."], dimensions: []};
  const result = await callInterviewer({action: "feedback", session: sessionSchema.parse(agentSession(session()))}, config, async (_url, init) => {
    const body = JSON.parse(String(init?.body)); assert.equal(body.text.format.type, "json_schema");
    return output(JSON.stringify(feedback));
  });
  assert.equal(result.feedback?.source, "agent"); assert.deepEqual(result.feedback?.dimensions, []);
  await assert.rejects(callInterviewer({action: "feedback", session: sessionSchema.parse(agentSession(session()))}, config, async () => output("invalid JSON")), /review could not be read/);
});
test("Provider errors hide sensitive bodies and leave requests recoverable", async () => {
  const request = {action: "reply" as const, session: sessionSchema.parse(agentSession(session()))};
  for (const status of [401, 429, 500]) await assert.rejects(callInterviewer(request, config, async () => new Response("secret provider body", {status})), error => {
    assert.ok(error instanceof Error); assert.ok(!error.message.includes("secret")); return true;
  });
  await assert.rejects(callInterviewer(request, config, async () => {throw new Error("private socket information");}), /connection failed/);
  assert.throws(() => openAIConfig({}), /OPENAI_API_KEY/);
});
test("AI request validation rejects completed sessions, wrong questions, and oversized context", () => {
  const valid = {action: "reply", session: sessionSchema.parse(agentSession(session()))};
  assert.ok(agentRequestSchema.safeParse(valid).success);
  assert.ok(!agentRequestSchema.safeParse({...valid, session: {...valid.session, status: "completed"}}).success);
  assert.ok(!agentRequestSchema.safeParse({...valid, session: {...valid.session, questionId: "missing"}}).success);
  assert.ok(!agentRequestSchema.safeParse({...valid, context: {code: "x".repeat(12001)}}).success);
  assert.ok(!agentRequestSchema.safeParse({...valid, action: "voice", sdp: "bad offer"}).success);
});
test("Test context distinguishes saved attempts from a subsequently edited draft", () => {
  const input = {code: "new draft", language: "python" as const, testedCode: "old draft", testedLanguage: "python" as const, testResults: {status: "passed" as const, tests: [], stdout: ""}};
  assert.equal(JSON.parse(codeContext(input).testSummary!).matchesCurrentDraft, false);
  assert.equal(JSON.parse(codeContext({...input, code: "old draft"}).testSummary!).matchesCurrentDraft, true);
  assert.equal(JSON.parse(codeContext({...input, code: "old draft", language: "typescript"}).testSummary!).matchesCurrentDraft, false);
});
test("Behavioral agent context contains the selected question without preparation notes", () => {
  const current = {...session(), type: "behavioral" as const, questionId: "team-collaboration", scratchpad: "Private preparation: never-send-this-story-to-the-interviewer"};
  const instructions = interviewerInstructions({action: "reply", session: sessionSchema.parse(agentSession(current)), context: {code: "unrelated private code", testSummary: "unrelated execution results"}});
  assert.match(instructions, /collaboration made the difference/);
  assert.ok(!instructions.includes(current.scratchpad)); assert.ok(!instructions.includes("100,000"));
  assert.ok(!instructions.includes("unrelated private code")); assert.ok(!instructions.includes("unrelated execution results"));
  assert.doesNotMatch(instructions, /SOLUTION REVEAL RULE|Contains Duplicate|sliding window|Coding language/);
});

for (const type of ["coding", "behavioral"] as const) {
  for (const action of ["reply", "voice", "feedback"] as const) {
    test(`${type} ${action} sends only its own interview prompt to the provider`, async () => {
      const current = {...session(), type, questionId: type === "coding" ? "contains-duplicate" : "team-collaboration"};
      await callInterviewer({action, session: sessionSchema.parse(agentSession(current)), ...(action === "voice" ? {sdp: "v=0\r\no=test-offer"} : {})}, config, async (_url, init) => {
        const body = action === "voice" ? JSON.parse(String((init!.body as FormData).get("session"))) : JSON.parse(String(init!.body));
        if (type === "coding") {
          assert.match(body.instructions, /SOLUTION REVEAL RULE/);
          assert.match(body.instructions, /Contains Duplicate/);
          assert.doesNotMatch(body.instructions, /FOCUSED FOLLOW-UPS|selected behavioral question/);
        } else {
          assert.match(body.instructions, /FOCUSED FOLLOW-UPS/);
          assert.match(body.instructions, /collaboration made the difference/);
          assert.doesNotMatch(body.instructions, /SOLUTION REVEAL RULE|Contains Duplicate|test results|selected coding problem/);
        }
        if (action === "voice") {
          assert.match(body.instructions, /Speak first/);
          assert.match(body.instructions, /<prior_conversation>\[\]<\/prior_conversation>/);
          return new Response("v=0\r\no=test-answer");
        }
        if (action === "feedback") {
          assert.match(body.instructions, /The interview has ended/);
          assert.match(body.instructions, type === "coding" ? /supplied conversation and test results/ : /candidate's actual story and answers/);
          assert.equal(body.text.format.name, "interview_feedback");
          return output(JSON.stringify({summary: "Insufficient evidence.", strengths: [], improvements: [], evidence: [], nextActions: [], dimensions: []}));
        }
        assert.doesNotMatch(body.instructions, /The interview has ended/);
        return output("Understood.");
      });
    });
  }
}

test("Resumed behavioral voice uses its own resume instructions and saved conversation", async () => {
  const current = {...session(), type: "behavioral" as const, questionId: "team-collaboration"};
  current.transcript.push({id: crypto.randomUUID(), role: "candidate", text: "I coordinated the release.", timestamp: current.startedAt});
  await callInterviewer({action: "voice", session: sessionSchema.parse(agentSession(current)), sdp: "v=0\r\no=test-offer"}, config, async (_url, init) => {
    const body = JSON.parse(String((init!.body as FormData).get("session")));
    assert.match(body.instructions, /Resume the behavioral conversation/);
    assert.match(body.instructions, /I coordinated the release/);
    assert.doesNotMatch(body.instructions, /Speak first|Begin with a brief friendly greeting/);
    return new Response("v=0\r\no=test-answer");
  });
});
test("Retrying a failed typed turn saves a single candidate message and resuming preserves it", async () => {
  let count = 0;
  const agent = new OpenAIInterviewAgent(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.session.scratchpad, "");
    assert.equal(body.session.transcript.filter((e: {role: string}) => e.role === "candidate").length, 1);
    if (++count === 1) return Response.json({error: "Service unavailable"}, {status: 503});
    return Response.json({text: "Yes, nums can be empty."});
  });
  const events: InterviewAgentEvent[] = []; agent.subscribe(e => events.push(e));
  await agent.startSession(session());
  await assert.rejects(agent.sendInput({text: "Can nums be empty?"}), /Service unavailable/);
  await agent.sendInput({text: "Can nums be empty?"});
  const transcript = events.filter(e => e.type === "transcript").map(e => e.event);
  assert.deepEqual(transcript.map(e => e.role), ["interviewer", "candidate", "interviewer"]);
  agent.dispose();
  const resumed = new OpenAIInterviewAgent(); const resumeEvents: InterviewAgentEvent[] = []; resumed.subscribe(e => resumeEvents.push(e));
  await resumed.startSession({...session(), transcript});
  assert.equal(resumeEvents.filter(e => e.type === "transcript").length, 0); resumed.dispose();
});
test("Unavailable feedback preserves a completed review without inventing an assessment", async () => {
  const agent = new OpenAIInterviewAgent(async () => Response.json({error: "Unavailable"}, {status: 503}));
  const events: InterviewAgentEvent[] = []; agent.subscribe(e => events.push(e));
  await agent.startSession(session()); await agent.endSession();
  const feedback = events.find(e => e.type === "feedback"); assert.ok(feedback?.type === "feedback");
  assert.match(feedback.feedback.summary, /no assessment was generated/); assert.deepEqual(feedback.feedback.strengths, []); agent.dispose();
});
test("Live transcription preserves candidate-before-answer ordering despite delayed input captions", () => {
  const events: InterviewAgentEvent[] = []; const stream = new RealtimeEvents(e => events.push(e));
  stream.handle({type: "input_audio_buffer.committed", item_id: "candidate-1"});
  stream.handle({type: "response.output_item.added", item: {id: "answer-1", role: "assistant"}});
  stream.handle({type: "response.output_audio_transcript.delta", item_id: "answer-1", delta: "Yes, empty "});
  stream.handle({type: "response.output_audio_transcript.done", item_id: "answer-1", transcript: "Yes, empty arrays are allowed."});
  assert.equal(events.filter(e => e.type === "transcript").length, 0);
  stream.handle({type: "conversation.item.input_audio_transcription.completed", item_id: "candidate-1", transcript: "Can it be empty?"});
  stream.handle({type: "response.output_item.done", item: {id: "answer-1", role: "assistant", content: [{transcript: "Yes, empty arrays are allowed."}]}});
  const transcript = events.filter(e => e.type === "transcript");
  assert.deepEqual(transcript.map(e => e.event.role), ["candidate", "interviewer"]); assert.equal(transcript.length, 2);
});
test("Disconnects and interrupted answers retain partial transcripts", () => {
  const events: InterviewAgentEvent[] = []; const stream = new RealtimeEvents(e => events.push(e));
  stream.handle({type: "input_audio_buffer.committed", item_id: "candidate-1"});
  stream.handle({type: "response.output_audio_transcript.delta", item_id: "answer-1", delta: "An empty array "});
  stream.finish();
  const transcript = events.filter(e => e.type === "transcript");
  assert.deepEqual(transcript.map(e => e.event.text), ["[Voice response was not transcribed before disconnecting]", "An empty array"]);
});
