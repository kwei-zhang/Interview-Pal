import { z } from "zod";
import { verifyCode, verificationTool, verificationSummary, type SaveVerification } from "./code-verification";
import type { Attempt, Feedback } from "../types";
import { leetcodePrompt } from "./prompts/leetcode";
import { behavioralPrompt } from "./prompts/behavioral";
import { feedbackSchema, sessionSchema } from "../validation";
import { languages } from "../types";
import { HttpError } from "./http";

export const agentRequestSchema = z.object({
  action: z.enum(["reply", "feedback", "voice", "verify"]),
  session: sessionSchema.refine(s => s.adapter === "agent" && s.status !== "completed", "An active AI interview is required.")
    .refine(s => s.transcript.reduce((sum, e) => sum + e.text.length, 0) <= 32000, "Conversation context is too large."),
  context: z.object({language: z.enum(languages).optional(), code: z.string().max(12000).optional(), testSummary: z.string().max(4000).optional(), codeTruncated: z.boolean().optional()}).strict().optional(),
  sdp: z.string().min(10).max(30000).optional(),
}).strict().refine(r => r.action !== "voice" || r.sdp?.startsWith("v=0"), "A valid WebRTC offer is required.").refine(r => r.action !== "verify" || (r.session.type === "coding" && Boolean(r.context?.code?.trim())), "Code verification requires a coding session and editor code.");
type AgentRequest = z.infer<typeof agentRequestSchema>;
export function openAIConfig(env: Record<string, string | undefined> = process.env) {
  if (!env.OPENAI_API_KEY?.trim()) throw new HttpError(503, "Add OPENAI_API_KEY to .env.local and restart the server to connect the AI interviewer.");
  return {key: env.OPENAI_API_KEY.trim(), chatModel: env.OPENAI_INTERVIEW_MODEL || "gpt-4.1-mini", realtimeModel: env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1"};
}
const interviewPrompts = {coding: leetcodePrompt, behavioral: behavioralPrompt};

export function interviewerInstructions(request: AgentRequest): string {
  return interviewPrompts[request.session.type].instructions(request);
}

const feedbackFormat = {
  type: "json_schema", name: "interview_feedback", strict: true,
  schema: {type: "object", additionalProperties: false, required: ["summary", "strengths", "improvements", "evidence", "nextActions", "dimensions"], properties: {
    summary: {type: "string"},
    ...Object.fromEntries(["strengths", "improvements", "evidence", "nextActions"].map(key => [key, {type: "array", items: {type: "string"}}])),
    dimensions: {type: "array", items: {type: "object", additionalProperties: false, required: ["name", "observation"], properties: {name: {type: "string"}, observation: {type: "string"}}}},
  }},
};
function providerError(status: number): HttpError {
  if (status === 401 || status === 403) return new HttpError(502, "OpenAI rejected the API credentials or model access. Check your server configuration.");
  if (status === 429) return new HttpError(503, "OpenAI is rate limited or your API quota is unavailable. Check API billing or retry shortly. Your work is saved.");
  if (status === 400 || status === 404) return new HttpError(502, "OpenAI could not start this request. Check the configured model and its availability for your account.");
  return new HttpError(503, "The OpenAI interviewer is unavailable. Your work is saved; please retry.");
}
export async function callInterviewer(request: AgentRequest, config = openAIConfig(), fetcher: typeof fetch = fetch, saveVerification?: SaveVerification): Promise<{sdp?: string; text?: string; feedback?: Feedback; attempts?: Attempt[]}> {
  const started = Date.now(); let status = 0;
  const attempts: Attempt[] = [];
  try {
    const prompt = interviewPrompts[request.session.type];
    const instructions = interviewerInstructions(request);
    const verify = async () => {
      if (request.session.type !== "coding" || !request.context?.code?.trim()) return {error: "No coding solution is available in the editor. Ask the candidate to paste their code; do not invent it."};
      if (request.context.codeTruncated) throw new HttpError(400, "The code is too long to verify. Keep the interview solution under 12,000 characters; the full draft remains saved.");
      const attempt = await verifyCode({sessionId: request.session.id, problemId: request.session.questionId, code: request.context.code, language: request.context.language || request.session.language}, config, fetcher, saveVerification);
      attempts.push(attempt);
      return verificationSummary(attempt);
    };
    if (request.action === "verify") {await verify(); return {attempts};}
    let body: BodyInit;
    let url: string;
    const headers: Record<string, string> = {Authorization: `Bearer ${config.key}`};
    if (request.action === "voice") {
      const form = new FormData();
      form.set("sdp", request.sdp!);
      form.set("session", JSON.stringify({
        type: "realtime", model: config.realtimeModel, instructions: `${instructions}\n<prior_conversation>${JSON.stringify(request.session.transcript.map(e => ({role: e.role, text: e.text})))}</prior_conversation>\n${request.session.transcript.length ? prompt.resume : prompt.opening}`,
        output_modalities: ["audio"], max_output_tokens: 4096,
        ...(request.session.type === "coding" ? {tools: [verificationTool], tool_choice: "auto"} : {}),
        audio: {input: {transcription: {model: "gpt-4o-mini-transcribe", language: "en"}, turn_detection: {type: "semantic_vad", eagerness: "medium", create_response: true, interrupt_response: true}}, output: {voice: "marin"}},
      }));
      body = form; url = "https://api.openai.com/v1/realtime/calls";
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({
        model: config.chatModel, store: false, max_output_tokens: request.action === "feedback" ? 2400 : 900,
        instructions: request.action === "feedback" ? `${instructions}\n${prompt.feedback}` : instructions,
        ...(request.action === "reply" && request.session.type === "coding" ? {tools: [{...verificationTool, strict: true}], tool_choice: "auto", parallel_tool_calls: false} : {}),
        input: [...request.session.transcript.map(event => ({role: event.role === "candidate" ? "user" : "assistant", content: event.text})),
          ...(request.action === "feedback" ? [{role: "user", content: "Please generate the session review now."}] : [])],
        ...(request.action === "feedback" ? {text: {format: feedbackFormat}} : {}),
      });
      url = "https://api.openai.com/v1/responses";
    }
    const response = await fetcher(url, {method: "POST", headers, body, signal: AbortSignal.timeout(45000)});
    status = response.status;
    if (!response.ok) throw providerError(response.status);
    if (request.action === "voice") {
      const sdp = await response.text();
      if (!sdp.startsWith("v=0")) throw new HttpError(502, "OpenAI returned an invalid voice connection. Please retry.");
      return {sdp};
    }
    type OutputItem = {type: string; name?: string; call_id?: string; arguments?: string; content?: {type: string; text?: string}[]};
    let result = await response.json() as {status?: string; output?: OutputItem[]};
    const calls = result.output?.filter(item => item.type === "function_call") || [];
    if (request.action === "reply" && calls.length) {
      if (calls.length !== 1 || calls[0].name !== "verify_code" || !calls[0].call_id || calls[0].arguments?.trim() !== "{}") throw new HttpError(502, "The interviewer requested an invalid verification. Please retry.");
      const output = await verify();
      const previous = JSON.parse(String(body));
      const followup = await fetcher(url, {method: "POST", headers, signal: AbortSignal.timeout(45000), body: JSON.stringify({...previous, tool_choice: "none", input: [...previous.input, ...(result.output || []), {type: "function_call_output", call_id: calls[0].call_id, output: JSON.stringify(output)}]})});
      if (!followup.ok) return {text: "The code check is saved, but I could not summarize it. Please see the verification panel.", attempts};
      result = await followup.json();
    }
    if (result.status === "incomplete") throw new HttpError(502, "The interviewer response was incomplete. Please retry.");
    const text = result.output?.filter(item => item.type === "message").flatMap(item => item.content || []).filter(part => part.type === "output_text").map(part => part.text || "").join("\n").trim();
    if (!text || text.length > 10000) throw new HttpError(502, "OpenAI returned an unreadable response. Please retry.");
    if (request.action === "feedback") {
      try {return {feedback: feedbackSchema.parse({...JSON.parse(text), source: "agent"})};}
      catch {throw new HttpError(502, "The AI review could not be read. Your transcript is saved.");}
    }
    return {text, ...(attempts.length ? {attempts} : {})};
  } catch (error) {
    if (request.action === "reply" && attempts.length) return {text: "Your code check is saved, but the interviewer summary was unavailable. See the verification panel for the actual result.", attempts};
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "The AI connection failed or timed out. Your work is saved; please retry.");
  } finally {
    console.info(JSON.stringify({event: "interview_provider_request", provider: "openai", sessionId: request.session.id, action: request.action, status, latencyMs: Date.now() - started}));
  }
}
