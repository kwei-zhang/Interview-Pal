export const languages = ["python", "javascript", "typescript"] as const;
export type Language = typeof languages[number];
export type Difficulty = "Easy" | "Medium" | "Hard";
export type ProgressStatus = "not-started" | "practicing" | "solved";
export type InterviewType = "coding" | "behavioral";
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export interface Problem {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  sourceUrl: string;
  collectionId: string;
  runnable: boolean;
}
export interface ProblemExample { name: string; args: Json[]; expected: Json }
export interface ProblemDefinition {
  id: string;
  version: number;
  prompt: string;
  constraints: string[];
  functionName: string;
  parameters: {name: string; py: string; ts: string}[];
  returnType: {py: string; ts: string};
  inputKind?: "linked-list" | "binary-tree";
  examples: ProblemExample[];
}
export interface ProblemProgress {
  problemId: string;
  status: ProgressStatus;
  reviewLater: boolean;
  notes: string;
  updatedAt: string;
}
export interface CodeDraft {problemId: string; language: Language; code: string; updatedAt: string}
export const competencies = ["Teamwork", "Ownership", "Conflict", "Leadership", "Learning", "Communication", "Ambiguity", "Impact"] as const;
export type Competency = typeof competencies[number];
export interface BehavioralQuestion {id: string; question: string; competency: Competency; followUp: string}
export interface Story {
  id: string; title: string; situation: string; task: string; action: string;
  result: string; reflection: string; tags: Competency[]; questionIds: string[]; updatedAt: string;
}
export interface TranscriptEvent {id: string; role: "interviewer" | "candidate"; text: string; timestamp: string}
export interface Feedback {
  source: "mock" | "agent";
  summary: string;
  strengths: string[];
  improvements: string[];
  evidence: string[];
  nextActions: string[];
  dimensions: {name: string; observation: string; score?: number; maxScore?: number}[];
}
export interface InterviewSession {
  id: string; type: InterviewType; roleId: string; questionId: string;
  durationMinutes: number; timed: boolean; language: Language;
  status: "active" | "completed" | "interrupted";
  startedAt: string; endedAt?: string; lastActiveAt: string; elapsedSeconds: number;
  scratchpad: string; transcript: TranscriptEvent[]; feedback?: Feedback;
  // "mock" is retained only to read historical sessions; all new/resumed sessions use "agent".
  adapter: "mock" | "agent";
}
export interface TestResult {name: string; input?: string; passed: boolean; actual?: Json; expected?: Json; error?: string}
export interface ExecutionResult {
  status: "queued" | "running" | "passed" | "failed" | "reviewed" | "error" | "timeout";
  tests: TestResult[]; stdout: string; error?: string;
  runtimeMs?: number; memoryKb?: number;
  assessment?: {method: "llm-review" | "llm-generated-execution"; verdict: "likely-correct" | "incorrect" | "inconclusive"; summary: string};
}
export interface Attempt {
  id: string; problemId: string; problemVersion: number; language: Language;
  code: string; mode: "run" | "submit"; sessionId?: string;
  createdAt: string; provider?: "openai-code-interpreter" | "openai-judge"; providerJobId?: string; result: ExecutionResult;
}
export interface Profile {displayName: string; targetRole: string; weeklyGoal: number}
export interface WorkspaceData {
  profile: Profile;
  progress: Record<string, ProblemProgress>;
  drafts: Record<string, CodeDraft>;
  stories: Story[];
  sessions: InterviewSession[];
  attempts: Attempt[];
}
export type WorkspaceMutation =
  | {kind: "profile"; value: Profile}
  | {kind: "progress"; value: ProblemProgress}
  | {kind: "draft"; value: CodeDraft}
  | {kind: "story"; value: Story}
  | {kind: "delete-story"; id: string}
  | {kind: "session"; value: InterviewSession}
  | {kind: "delete-session"; id: string};

export function emptyWorkspace(): WorkspaceData {
  return {profile: {displayName: "", targetRole: "Software engineer", weeklyGoal: 5}, progress: {}, drafts: {}, stories: [], sessions: [], attempts: []};
}
export const draftKey = (problemId: string, language: Language) => `${problemId}:${language}`;
export function applyMutation(data: WorkspaceData, mutation: WorkspaceMutation): WorkspaceData {
  switch (mutation.kind) {
    case "profile": return {...data, profile: mutation.value};
    case "progress": return {...data, progress: {...data.progress, [mutation.value.problemId]: mutation.value}};
    case "draft": return {...data, drafts: {...data.drafts, [draftKey(mutation.value.problemId, mutation.value.language)]: mutation.value}};
    case "story": return {...data, stories: [mutation.value, ...data.stories.filter(s => s.id !== mutation.value.id)]};
    case "delete-story": return {...data, stories: data.stories.filter(s => s.id !== mutation.id)};
    case "session": return {...data, sessions: [mutation.value, ...data.sessions.filter(s => s.id !== mutation.value.id)]};
    case "delete-session": return {...data, sessions: data.sessions.filter(s => s.id !== mutation.id), attempts: data.attempts.map(a => a.sessionId === mutation.id ? {...a, sessionId: undefined} : a)};
  }
}
