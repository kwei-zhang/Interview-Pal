import type { InterviewSession, Language } from "../../types";

export interface InterviewPromptContext {
  session: InterviewSession;
  context?: {language?: Language; code?: string; testSummary?: string};
}

export interface InterviewPrompt {
  instructions(request: InterviewPromptContext): string;
  opening: string;
  resume: string;
  feedback: string;
}
