import { problems } from "../data/catalog";
import { behavioralQuestions } from "../data/behavioral";
import type { InterviewType, Feedback } from "../types";

interface InterviewModule {
  id: InterviewType;
  roleId: string;
  title: string;
  description: string;
  defaultDuration: number;
  capabilities: ("voice" | "code" | "scratchpad")[];
  questions: {id: string; title: string; topic: string}[];
  feedbackSections: (keyof Pick<Feedback, "strengths" | "improvements" | "evidence" | "nextActions" | "dimensions">)[];
}
export const interviewModules: Record<InterviewType, InterviewModule> = {
  coding: {id: "coding", roleId: "software-engineer", title: "Coding interview", description: "Think aloud, explore an approach, and write a working solution.", defaultDuration: 45, capabilities: ["voice", "code"], questions: problems.map(p => ({id: p.id, title: p.title, topic: p.topic})), feedbackSections: ["strengths", "improvements", "evidence", "nextActions", "dimensions"]},
  behavioral: {id: "behavioral", roleId: "software-engineer", title: "Behavioral interview", description: "Practice telling clear stories about your experience and impact.", defaultDuration: 30, capabilities: ["voice", "scratchpad"], questions: behavioralQuestions.map(q => ({id: q.id, title: q.question, topic: q.competency})), feedbackSections: ["strengths", "improvements", "evidence", "nextActions", "dimensions"]},
};
