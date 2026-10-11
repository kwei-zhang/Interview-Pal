import type { Attempt, ExecutionResult, Feedback, InterviewSession, Language, TranscriptEvent } from "../types";

export type InterviewAgentEvent =
  | {type: "transcript"; event: TranscriptEvent}
  | {type: "interviewer-state"; state: "connecting" | "ready" | "listening" | "thinking" | "speaking" | "disconnected"}
  | {type: "verification"; attempt: Attempt}
  | {type: "feedback"; feedback: Feedback}
  | {type: "caption"; role: "candidate" | "interviewer"; text: string}
  | {type: "voice-connection"; connected: boolean}
  | {type: "error"; message: string};
export interface CandidateInput {text: string; code?: string; language?: Language; testResults?: ExecutionResult; testedCode?: string; testedLanguage?: Language}
export interface VoiceTransport {
  available: boolean;
  checkMicrophone(): Promise<void>;
  startListening(onText: (text: string) => void, onState: (listening: boolean) => void, onError: (message: string) => void): void;
  stopListening(): void;
  speak(text: string): void;
  stopSpeaking(): void;
  setMuted?(muted: boolean): void;
  disconnect?(): void;
  dispose(): void;
}
export interface InterviewAgentAdapter {
  readonly name: string;
  readonly voice: VoiceTransport;
  readonly liveVoice?: boolean;
  updateContext?(input: Partial<CandidateInput>): void;
  subscribe(listener: (event: InterviewAgentEvent) => void): () => void;
  startSession(session: InterviewSession): Promise<void>;
  connectVoice(onState: (listening: boolean) => void, onError: (message: string) => void): void;
  sendInput(input: CandidateInput): Promise<void>;
  endSession(): Promise<void>;
  dispose(): void;
}
