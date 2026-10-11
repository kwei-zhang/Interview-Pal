import { headers } from "next/headers";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "@/lib/server/http";
import { assertAccountBinding, requireUser, supabaseConfigured } from "@/lib/server/supabase";
import { agentRequestSchema, callInterviewer } from "@/lib/server/openai-interviewer";

export const maxDuration = 210;
const localRequests = new Map<string, number[]>();
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const auth = supabaseConfigured() ? await requireUser() : undefined;
    if (auth) assertAccountBinding(request.headers.get("x-workspace-user-id"), auth.user.id);
    if (!auth) {
      const host = (await headers()).get("host")?.split(":")[0];
      if (process.env.NODE_ENV !== "development" || (host !== "localhost" && host !== "127.0.0.1")) throw new HttpError(401, "Sign in to use the AI interviewer.");
    }
    const input = agentRequestSchema.parse(await readJson(request, 120000));
    if (auth) {
      const {data: record, error} = await auth.supabase.from("interview_sessions").select("data").eq("id", input.session.id).eq("user_id", auth.user.id).maybeSingle();
      if (error) throw new HttpError(503, "The saved session could not be checked. Retry saving before connecting.");
      if (!record) throw new HttpError(404, "Interview session not found.");
      const session = record.data;
      if (session.status === "completed" || session.questionId !== input.session.questionId || session.type !== input.session.type || session.adapter !== "agent") throw new HttpError(409, "Save an active AI session before connecting the interviewer.");
      const {data: allowed, error: quotaError} = await auth.supabase.rpc("claim_agent_slot");
      if (quotaError) throw new HttpError(503, "Apply the AI interviewer database migration before connecting.");
      if (!allowed) throw new HttpError(429, "Interview request limit reached. Please wait a minute before retrying.");
    } else {
      const now = Date.now(), recent = (localRequests.get("loopback") || []).filter(time => now - time < 60000);
      if (recent.length >= 30) throw new HttpError(429, "Interview request limit reached. Please retry in a minute.");
      localRequests.set("loopback", [...recent, now]);
    }
    return Response.json(await callInterviewer(input, undefined, undefined, async attempt => {
      if (!auth) return;
      if (attempt.result.status === "queued") {
        const {data: allowed, error: quotaError} = await auth.supabase.rpc("claim_execution_slot");
        if (quotaError || !allowed) throw new HttpError(429, "Code verification limit reached. Retry later.");
        const {error} = await auth.supabase.from("attempts").insert({id: attempt.id, user_id: auth.user.id, problem_id: attempt.problemId, session_id: attempt.sessionId, data: attempt, created_at: attempt.createdAt});
        if (error) throw new HttpError(503, "Could not save the code snapshot. No verification was started.");
      } else {
        const {error} = await auth.supabase.from("attempts").update({data: attempt, provider_job_id: attempt.providerJobId || null}).eq("id", attempt.id).eq("user_id", auth.user.id);
        if (error) throw new HttpError(503, "The code snapshot is saved, but verification results could not sync. Please retry later.");
      }
    }), {headers: {"Cache-Control": "no-store"}});
  } catch (error) {return errorResponse(error);}
}
