import { problemById } from "../data/catalog";
import { questionById } from "../data/behavioral";
import type { Attempt, InterviewSession, TranscriptEvent } from "../types";
import { feedbackSchema } from "../validation";
import type { CandidateInput, InterviewAgentAdapter, InterviewAgentEvent } from "./agent";
import { agentSession, codeContext } from "./context";
import { RealtimeVoiceTransport } from "./realtime-voice";

export class OpenAIInterviewAgent implements InterviewAgentAdapter {
  readonly name = "OpenAI interviewer";
  readonly voice: RealtimeVoiceTransport;
  get liveVoice() {return this.voice.connected;}
  private listeners = new Set<(event: InterviewAgentEvent) => void>();
  private session?: InterviewSession;
  private context: Partial<CandidateInput> = {};
  private contextTimer?: ReturnType<typeof setTimeout>;
  private disposed = false;
  private busy = false;
  private ending = false;
  private abort?: AbortController;
  private retryText?: string;
  private openingRequested = false;
  private verificationPending?: Promise<unknown>;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.voice = new RealtimeVoiceTransport(async (sdp, signal) => {
      const result = await this.request("voice", signal, sdp);
      if (typeof result.sdp !== "string") throw new Error("Voice connection could not be read.");
      return result.sdp;
    }, event => {
      if (event.type === "error" && this.openingRequested && !this.ending && !this.disposed) this.openTextChat();
      this.emit(event);
    }, () => this.verifyCurrentCode());
  }
  subscribe(listener: (event: InterviewAgentEvent) => void) {this.listeners.add(listener); return () => {this.listeners.delete(listener);};}
  private emit(event: InterviewAgentEvent) {
    if (this.disposed) return;
    if (event.type === "transcript" && this.session) this.session = {...this.session, transcript: [...this.session.transcript, event.event]};
    this.listeners.forEach(listener => listener(event));
  }
  private say(role: TranscriptEvent["role"], text: string) {this.emit({type: "transcript", event: {id: crypto.randomUUID(), role, text, timestamp: new Date().toISOString()}});}
  async startSession(session: InterviewSession) {
    this.session = {...session, transcript: [...session.transcript]};
    this.retryText = session.transcript.at(-1)?.role === "candidate" ? session.transcript.at(-1)?.text : undefined;
    this.emit({type: "interviewer-state", state: "ready"});
    if (!this.voice.available) this.openTextChat();
  }
  private openTextChat() {
    const session = this.session;
    if (session && !session.transcript.length && !this.disposed && !this.ending) this.say("interviewer", session.type === "coding" ? `Let's work on ${problemById(session.questionId)?.title}.` : questionById(session.questionId)!.question);
  }
  connectVoice(onState: (listening: boolean) => void, onError: (message: string) => void) {
    if (this.disposed || this.ending || !this.session) return;
    if (!this.voice.available) {this.openTextChat(); return;}
    this.voice.startListening(() => {}, listening => {
      onState(listening);
      if (listening && !this.session?.transcript.length && !this.openingRequested) {
        this.openingRequested = true;
        this.voice.startConversation();
      }
    }, message => {
      this.openTextChat();
      onError(`${message} You can continue with typed chat or retry with Speak.`);
    });
  }
  updateContext(input: Partial<CandidateInput>) {
    this.context = input;
    clearTimeout(this.contextTimer);
    this.contextTimer = setTimeout(() => {if (!this.disposed) this.voice.updateContext(JSON.stringify(codeContext(this.context)));}, 1200);
  }
  private verifyCurrentCode(): Promise<unknown> {
    if (this.verificationPending) return this.verificationPending;
    if (this.disposed || this.ending) return Promise.resolve({error: "Interview ended; no verification started."});
    const snapshot = {...this.context};
    this.verificationPending = (async () => {
      const result = await this.request("verify", AbortSignal.timeout(120000));
      const attempt: Attempt | undefined = result.attempts?.[0];
      if (!attempt) throw new Error("No verification result was returned.");
      return {scope: "Original problem only; not LeetCode acceptance", language: attempt.language, matchesCurrentDraft: snapshot.code === this.context.code && snapshot.language === this.context.language, ...attempt.result};
    })().finally(() => {this.verificationPending = undefined;});
    return this.verificationPending;
  }
  private acceptAttempt(attempt: Attempt) {
    if (this.disposed) return;
    this.context = {...this.context, testResults: attempt.result, testedCode: attempt.code, testedLanguage: attempt.language};
    this.emit({type: "verification", attempt});
  }
  private async request(action: "reply" | "feedback" | "voice" | "verify", signal: AbortSignal, sdp?: string) {
    if (!this.session) throw new Error("Start an interview before connecting.");
    const response = await this.fetcher("/api/interview-agent", {method: "POST", headers: {"Content-Type": "application/json"}, signal,
      body: JSON.stringify({action, session: agentSession(this.session), context: codeContext(this.context), ...(sdp ? {sdp} : {})})});
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "The AI interviewer could not answer. Your work is saved.");
    for (const attempt of result.attempts || []) this.acceptAttempt(attempt);
    return result;
  }
  async sendInput(input: CandidateInput) {
    if (!this.session || this.disposed || this.busy || this.ending || !input.text.trim()) return;
    this.context = {...this.context, ...input};
    const text = input.text.trim();
    if (this.retryText !== text) this.say("candidate", text);
    this.retryText = text;
    this.emit({type: "interviewer-state", state: "thinking"});
    if (this.liveVoice) {
      try {this.voice.updateContext(JSON.stringify(codeContext(this.context))); this.voice.sendText(text); this.retryText = undefined;}
      catch (error) {this.emit({type: "interviewer-state", state: "ready"}); throw error;}
      return;
    }
    this.busy = true;
    const abort = new AbortController(); this.abort = abort;
    try {
      const result = await this.request("reply", AbortSignal.any([abort.signal, AbortSignal.timeout(220000)]));
      if (this.disposed || this.ending) return;
      if (typeof result.text !== "string" || !result.text.trim() || result.text.length > 10000) throw new Error("The interviewer response could not be read. Please retry.");
      this.say("interviewer", result.text); this.retryText = undefined;
    } finally {
      this.busy = false;
      if (!this.disposed && !this.ending) this.emit({type: "interviewer-state", state: "ready"});
    }
  }
  async endSession() {
    this.ending = true; this.abort?.abort(); clearTimeout(this.contextTimer);
    this.voice.disconnect(); this.voice.stopSpeaking();
    await this.verificationPending?.catch(() => {});
    const abort = new AbortController(); this.abort = abort;
    try {
      const result = await this.request("feedback", AbortSignal.any([abort.signal, AbortSignal.timeout(160000)]));
      if (!this.disposed) this.emit({type: "feedback", feedback: feedbackSchema.parse(result.feedback)});
    } catch {
      this.emit({type: "feedback", feedback: {source: "agent", summary: "AI feedback was unavailable. Your transcript and saved work are preserved; no assessment was generated.", strengths: [], improvements: [], evidence: [], dimensions: [], nextActions: ["Review your saved conversation and code.", "Retry a practice session when the AI connection is available."]}});
    }
    this.emit({type: "interviewer-state", state: "disconnected"});
  }
  dispose() {this.abort?.abort(); clearTimeout(this.contextTimer); this.voice.dispose(); this.disposed = true; this.listeners.clear();}
}
