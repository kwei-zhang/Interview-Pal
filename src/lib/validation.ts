import { z } from "zod";
import { behavioralQuestions } from "./data/behavioral";
import { problemById } from "./data/catalog";
import { competencies, languages } from "./types";

const shortText = z.string().max(200);
const notes = z.string().max(20000);
const timestamp = z.iso.datetime();
const uuid = z.uuid();
const problemId = z.string().max(100).regex(/^[a-z0-9-]+$/);
const language = z.enum(languages);
const questionId = z.string().max(100);
const profileSchema = z.object({displayName: shortText, targetRole: shortText, weeklyGoal: z.number().int().min(1).max(50)}).strict();
const progressSchema = z.object({problemId, status: z.enum(["not-started", "practicing", "solved"]), reviewLater: z.boolean(), notes, updatedAt: timestamp}).strict();
const draftSchema = z.object({problemId, language, code: z.string().max(50000), updatedAt: timestamp}).strict();
export const resumeBulletSchema = z.object({
  id: uuid, project: z.string().trim().max(200), projectId: uuid.optional(), position: z.number().int().min(0).optional(),
  text: z.string().trim().min(1, "Enter a resume bullet point.").max(4000, "Keep each bullet point under 4,000 characters."),
  updatedAt: timestamp,
}).strict();
export const storySchema = z.object({
  id: uuid, title: z.string().min(1).max(200), situation: notes, task: notes, action: notes,
  result: notes, reflection: notes, tags: z.array(z.enum(competencies)).max(8),
  questionIds: z.array(z.string().refine(id => behavioralQuestions.some(q => q.id === id))).max(20), updatedAt: timestamp,
}).strict();
const transcriptSchema = z.object({id: uuid, role: z.enum(["interviewer", "candidate"]), text: z.string().min(1).max(10000), timestamp}).strict();
export const feedbackSchema = z.object({
  source: z.enum(["mock", "agent"]), summary: z.string().max(10000),
  strengths: z.array(notes).max(50), improvements: z.array(notes).max(50), evidence: z.array(notes).max(50), nextActions: z.array(notes).max(50),
  dimensions: z.array(z.object({name: shortText, observation: notes, score: z.number().optional(), maxScore: z.number().positive().optional()}).strict()).max(30),
}).strict();
export const projectInterviewSchema = z.object({
  id: z.string().min(1).max(250), name: z.string().trim().min(1).max(200),
  bullets: z.array(z.string().trim().min(1).max(4000)).min(1).max(100),
}).strict().refine(project => project.bullets.reduce((sum, text) => sum + text.length, 0) <= 20000, {message: "Keep the selected project's bullet points under 20,000 characters for an interview."});
export const sessionSchema = z.object({
  id: uuid, type: z.enum(["coding", "behavioral", "project"]), roleId: z.literal("software-engineer"), questionId,
  durationMinutes: z.number().int().min(5).max(120), timed: z.boolean(), language,
  status: z.enum(["active", "completed", "interrupted"]), startedAt: timestamp, endedAt: timestamp.optional(), lastActiveAt: timestamp, elapsedSeconds: z.number().int().min(0).max(86400),
  scratchpad: notes, transcript: z.array(transcriptSchema).max(500), feedback: feedbackSchema.optional(), adapter: z.enum(["mock", "agent"]), project: projectInterviewSchema.optional(),
}).strict().refine(s => s.type === "project" ? s.questionId === "project-overview" && Boolean(s.project) : !s.project && (s.type === "coding" ? Boolean(problemById(s.questionId)) : behavioralQuestions.some(q => q.id === s.questionId)), {message: "Choose an available interview question or a saved project."});
export const mutationSchema = z.discriminatedUnion("kind", [
  z.object({kind: z.literal("profile"), value: profileSchema}).strict(),
  z.object({kind: z.literal("progress"), value: progressSchema}).strict(),
  z.object({kind: z.literal("draft"), value: draftSchema}).strict(),
  z.object({kind: z.literal("story"), value: storySchema}).strict(),
  z.object({kind: z.literal("delete-story"), id: uuid}).strict(),
  z.object({kind: z.literal("resume-bullet"), value: resumeBulletSchema}).strict(),
  z.object({kind: z.literal("delete-resume-bullet"), id: uuid}).strict(),
  z.object({kind: z.literal("session"), value: sessionSchema}).strict(),
  z.object({kind: z.literal("delete-session"), id: uuid}).strict(),
]);
