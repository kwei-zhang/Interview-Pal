import type { SupabaseClient } from "@supabase/supabase-js";
import { emptyWorkspace, draftKey, type WorkspaceData, type WorkspaceMutation, type InterviewSession, type Story } from "../types";
import { HttpError } from "./http";

function checked<T>(result: {data: T; error: unknown}): T {
  if (result.error) throw new HttpError(500, "Could not sync your workspace. Check that the database migrations are applied.");
  return result.data;
}
// Supabase limits each response; a long history must not lose older events.
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{data: T[] | null; error: unknown}>): Promise<T[]> {
  const rows: T[] = [], size = 500;
  for (let from = 0; ; from += size) {
    const batch = checked(await page(from, from + size - 1)) || [];
    rows.push(...batch);
    if (batch.length < size) return rows;
  }
}
export async function loadWorkspace(db: SupabaseClient, userId: string): Promise<WorkspaceData> {
  const [profiles, progress, drafts, stories, links, sessions, events, feedback, attempts] = await Promise.all([
    db.from("profiles").select("data").eq("user_id", userId).maybeSingle(),
    allRows((from, to) => db.from("problem_progress").select("data").eq("user_id", userId).order("problem_id").range(from, to)),
    allRows((from, to) => db.from("code_drafts").select("data").eq("user_id", userId).order("problem_id").order("language").range(from, to)),
    allRows((from, to) => db.from("stories").select("id,data").eq("user_id", userId).order("updated_at", {ascending: false}).order("id").range(from, to)),
    allRows((from, to) => db.from("story_question_links").select("story_id,question_id").eq("user_id", userId).order("story_id").order("question_id").range(from, to)),
    allRows((from, to) => db.from("interview_sessions").select("id,data").eq("user_id", userId).order("updated_at", {ascending: false}).order("id").range(from, to)),
    allRows((from, to) => db.from("interview_events").select("session_id,data").eq("user_id", userId).order("session_id").order("position").order("id").range(from, to)),
    allRows((from, to) => db.from("session_feedback").select("session_id,data").eq("user_id", userId).order("session_id").range(from, to)),
    db.from("attempts").select("data,session_id").eq("user_id", userId).order("created_at", {ascending: false}).limit(200),
  ]);
  const base = emptyWorkspace();
  const profile = checked(profiles);
  const progressRows = progress, draftRows = drafts;
  const storyRows = stories, linkRows = links;
  const sessionRows = sessions, eventRows = events, feedbackRows = feedback;
  const attemptRows = checked(attempts) || [];
  return {
    profile: profile?.data || base.profile,
    progress: Object.fromEntries(progressRows.map(row => [row.data.problemId, row.data])),
    drafts: Object.fromEntries(draftRows.map(row => [draftKey(row.data.problemId, row.data.language), row.data])),
    stories: storyRows.map(row => ({...row.data, questionIds: linkRows.filter(link => link.story_id === row.id).map(link => link.question_id)} as Story)),
    sessions: sessionRows.map(row => ({...row.data, transcript: eventRows.filter(event => event.session_id === row.id).map(event => event.data), feedback: feedbackRows.find(f => f.session_id === row.id)?.data} as InterviewSession)),
    attempts: attemptRows.map(row => {const {testCases: _testCases, ...attempt} = row.data; return {...attempt, sessionId: row.session_id || undefined};}),
  };
}
export async function saveMutation(db: SupabaseClient, userId: string, mutation: WorkspaceMutation): Promise<void> {
  switch (mutation.kind) {
    case "profile":
      checked(await db.from("profiles").upsert({user_id: userId, data: mutation.value}, {onConflict: "user_id"})); return;
    case "progress":
      checked(await db.from("problem_progress").upsert({user_id: userId, problem_id: mutation.value.problemId, data: mutation.value, updated_at: mutation.value.updatedAt}, {onConflict: "user_id,problem_id"})); return;
    case "draft":
      checked(await db.from("code_drafts").upsert({user_id: userId, problem_id: mutation.value.problemId, language: mutation.value.language, data: mutation.value, updated_at: mutation.value.updatedAt}, {onConflict: "user_id,problem_id,language"})); return;
    case "story": {
      const {questionIds, ...story} = mutation.value;
      // One database transaction keeps the story and links consistent on failure.
      checked(await db.rpc("save_story", {story_id: story.id, story_data: story, question_ids: questionIds, modified_at: story.updatedAt})); return;
    }
    case "delete-story": checked(await db.from("stories").delete().eq("user_id", userId).eq("id", mutation.id)); return;
    case "session": {
      const {transcript, feedback, ...session} = mutation.value;
      checked(await db.rpc("save_interview_session", {session_id: session.id, session_data: session, transcript_data: transcript, feedback_data: feedback || null, modified_at: session.lastActiveAt})); return;
    }
    case "delete-session": checked(await db.from("interview_sessions").delete().eq("user_id", userId).eq("id", mutation.id)); return;
  }
}
