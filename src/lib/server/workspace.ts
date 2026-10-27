import type { Database } from "./database";
import { databaseFunction } from "./database";
import { emptyWorkspace, draftKey, type WorkspaceData, type WorkspaceMutation, type InterviewSession, type Story,
  type Profile, type ProblemProgress, type CodeDraft, type TranscriptEvent, type Feedback, type Attempt } from "../types";

export async function loadWorkspace(db: Database, userId: string): Promise<WorkspaceData> {
  // One network round trip and one PostgreSQL snapshot for the entire workspace.
  // Every subquery still has an explicit owner parameter and is subject to RLS.
  const {rows: [data]} = await db.query<{
    profiles: {data: Profile}[]; progress: {data: ProblemProgress}[]; drafts: {data: CodeDraft}[];
    stories: {id: string; data: Story}[]; links: {story_id: string; question_id: string}[];
    sessions: {id: string; data: InterviewSession}[]; events: {session_id: string; data: TranscriptEvent}[];
    feedback: {session_id: string; data: Feedback}[]; attempts: {data: Attempt & {testCases?: unknown}; session_id: string | null}[];
  }>(`select
    coalesce((select jsonb_agg(t) from (select data from public.profiles where user_id=$1) t),'[]') as profiles,
    coalesce((select jsonb_agg(t) from (select data from public.problem_progress where user_id=$1 order by problem_id) t),'[]') as progress,
    coalesce((select jsonb_agg(t) from (select data from public.code_drafts where user_id=$1 order by problem_id,language) t),'[]') as drafts,
    coalesce((select jsonb_agg(t) from (select id,data from public.stories where user_id=$1 order by updated_at desc,id) t),'[]') as stories,
    coalesce((select jsonb_agg(t) from (select story_id,question_id from public.story_question_links where user_id=$1 order by story_id,question_id) t),'[]') as links,
    coalesce((select jsonb_agg(t) from (select id,data from public.interview_sessions where user_id=$1 order by updated_at desc,id) t),'[]') as sessions,
    coalesce((select jsonb_agg(t) from (select session_id,data from public.interview_events where user_id=$1 order by session_id,position,id) t),'[]') as events,
    coalesce((select jsonb_agg(t) from (select session_id,data from public.session_feedback where user_id=$1 order by session_id) t),'[]') as feedback,
    coalesce((select jsonb_agg(t) from (select data,session_id from public.attempts where user_id=$1 order by created_at desc,id) t),'[]') as attempts`, [userId]);
  return {
    profile: data.profiles[0]?.data || emptyWorkspace().profile,
    progress: Object.fromEntries(data.progress.map(row => [row.data.problemId, row.data])),
    drafts: Object.fromEntries(data.drafts.map(row => [draftKey(row.data.problemId, row.data.language), row.data])),
    stories: data.stories.map(row => ({...row.data, questionIds: data.links.filter(link => link.story_id === row.id).map(link => link.question_id)})),
    sessions: data.sessions.map(row => ({...row.data, transcript: data.events.filter(event => event.session_id === row.id).map(event => event.data), feedback: data.feedback.find(f => f.session_id === row.id)?.data})),
    attempts: data.attempts.map(row => {const {testCases: _testCases, ...attempt} = row.data; return {...attempt, sessionId: row.session_id || undefined};}),
  };
}
export async function saveMutation(db: Database, userId: string, mutation: WorkspaceMutation): Promise<void> {
  switch (mutation.kind) {
    case "profile":
      await db.query("insert into public.profiles(user_id,data) values($1,$2) on conflict(user_id) do update set data=excluded.data", [userId, mutation.value]); return;
    case "progress":
      await db.query("insert into public.problem_progress(user_id,problem_id,data,updated_at) values($1,$2,$3,$4) on conflict(user_id,problem_id) do update set data=excluded.data,updated_at=excluded.updated_at where public.problem_progress.updated_at<=excluded.updated_at", [userId, mutation.value.problemId, mutation.value, mutation.value.updatedAt]); return;
    case "draft":
      await db.query("insert into public.code_drafts(user_id,problem_id,language,data,updated_at) values($1,$2,$3,$4,$5) on conflict(user_id,problem_id,language) do update set data=excluded.data,updated_at=excluded.updated_at where public.code_drafts.updated_at<=excluded.updated_at", [userId, mutation.value.problemId, mutation.value.language, mutation.value, mutation.value.updatedAt]); return;
    case "story": {
      const {questionIds, ...story} = mutation.value;
      await databaseFunction(db, "public.save_story", [story.id, story, questionIds, story.updatedAt]); return;
    }
    case "delete-story": await db.query("delete from public.stories where user_id=$1 and id=$2", [userId, mutation.id]); return;
    case "session": {
      const {transcript, feedback, ...session} = mutation.value;
      await databaseFunction(db, "public.save_interview_session", [session.id, session, JSON.stringify(transcript), feedback || null, session.lastActiveAt]); return;
    }
    case "delete-session": await db.query("delete from public.interview_sessions where user_id=$1 and id=$2", [userId, mutation.id]); return;
  }
}
