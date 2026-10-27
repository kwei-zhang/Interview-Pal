import { databaseFunction } from "@/lib/server/database";
import type { InterviewSession } from "@/lib/types";
import { headers } from "next/headers";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { assertAccountBinding, requireUser, neonConfigured } from "@/lib/server/accounts";
import { agentRequestSchema, callInterviewer } from "@/lib/server/openai-interviewer";

export const maxDuration = 210;
const localRequests = new Map<string, number[]>();
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = neonConfigured() ? await requireUser() : undefined;
    if (auth) assertAccountBinding(request.headers.get("x-workspace-user-id"), auth.user.id);
    if (!auth) {
      const host = (await headers()).get("host")?.split(":")[0];
      if (process.env.NODE_ENV !== "development" || (host !== "localhost" && host !== "127.0.0.1")) throw new HttpError(401, "Sign in to use the AI interviewer.");
    }
    const input = agentRequestSchema.parse(await readJson(request, 120000));
    if (auth) {
      const record = await auth.db(async db => (await db.query<{data: InterviewSession}>("select data from public.interview_sessions where id=$1 and user_id=$2", [input.session.id, auth.user.id])).rows[0]);
      if (!record) throw new HttpError(404, "Interview session not found.");
      const session = record.data;
      if (session.status === "completed" || session.questionId !== input.session.questionId || session.type !== input.session.type || session.adapter !== "agent") throw new HttpError(409, "Save an active AI session before connecting the interviewer.");
      const allowed = await auth.db(db => databaseFunction<boolean>(db, "public.claim_agent_slot"));
      if (!allowed) throw new HttpError(429, "Interview request limit reached. Please wait a minute before retrying.");
    } else {
      const now = Date.now(), recent = (localRequests.get("loopback") || []).filter(time => now - time < 60000);
      if (recent.length >= 30) throw new HttpError(429, "Interview request limit reached. Please retry in a minute.");
      localRequests.set("loopback", [...recent, now]);
    }
    return Response.json(await callInterviewer(input, undefined, undefined, async attempt => {
      if (!auth) return;
      if (attempt.result.status === "queued") {
        const allowed = await auth.db(db => databaseFunction<boolean>(db, "public.claim_execution_slot"));
        if (!allowed) throw new HttpError(429, "Code verification limit reached. Retry later.");
        await auth.db(db => db.query("insert into public.attempts(id,user_id,problem_id,session_id,data,created_at) values($1,$2,$3,$4,$5,$6)", [attempt.id, auth.user.id, attempt.problemId, attempt.sessionId, attempt, attempt.createdAt]));
      } else {
        await auth.db(db => db.query("update public.attempts set data=$1,provider_job_id=$2 where id=$3 and user_id=$4", [attempt, attempt.providerJobId || null, attempt.id, auth.user.id]));
      }
    }), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {return errorResponse(error);}
}
