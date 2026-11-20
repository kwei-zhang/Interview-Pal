import { problems, problemById } from "../data/catalog";
import { behavioralQuestions, questionById } from "../data/behavioral";
import { systemDesignTopics, systemDesignTopicById } from "../data/system-design";
import type { InterviewType, Feedback, InterviewSession, ProjectInterviewSnapshot } from "../types";

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
  project: {id: "project", roleId: "software-engineer", title: "Project interview", description: "Go deeper into your projects, technical decisions, and resume bullet points.", defaultDuration: 30, capabilities: ["voice", "scratchpad"], questions: [{id: "project-overview", title: "Walk through your project", topic: "Project experience"}], feedbackSections: ["strengths", "improvements", "evidence", "nextActions", "dimensions"]},
  "system-design": {
    id: "system-design", roleId: "software-engineer", title: "System design interview",
    description: "Design a system and explain the tradeoffs behind your decisions.",
    defaultDuration: 45, capabilities: ["voice", "scratchpad"],
    questions: systemDesignTopics.filter(topic => !topic.archived).map(({id, title}) => ({id, title, topic: title})),
    feedbackSections: ["strengths", "improvements", "evidence", "nextActions", "dimensions"],
  },
};

export const interviewTypeLabels: Record<InterviewType, string> = {coding: "Coding", behavioral: "Behavioral", project: "Project", "system-design": "System design"};
export function interviewSessionTitle(session: InterviewSession): string {
  if (session.type === "project") return session.project?.name || "Project interview";
  if (session.type === "system-design") return systemDesignTopicById(session.questionId)?.title || "System design interview";
  return (session.type === "coding" ? problemById(session.questionId)?.title : questionById(session.questionId)?.question) || interviewModules[session.type].title;
}
export function interviewOpening(session: InterviewSession): string {
  switch (session.type) {
    case "coding": return `Let's work on ${interviewSessionTitle(session)}.`;
    case "behavioral": return interviewSessionTitle(session);
    case "project": return projectOpening(session.project);
    case "system-design": return systemDesignTopicById(session.questionId)!.prompt;
  }
}
export function projectOpening(project?: ProjectInterviewSnapshot): string {
  return `Could you walk me through ${project?.name || "your project"}, focusing on your own contribution?`;
}
