import { headers } from "next/headers";
import { assertAccountBinding, requireUser, neonConfigured } from "@/lib/server/accounts";
import { errorResponse, HttpError } from "@/lib/server/http";
import { openAIConfig } from "@/lib/server/openai-interviewer";
export async function GET(request: Request) {
  try {
    if (neonConfigured()) { const {user} = await requireUser(); assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id); }
    else {
      const host = (await headers()).get("host")?.split(":")[0];
      if (process.env.NODE_ENV !== "development" || (host !== "localhost" && host !== "127.0.0.1")) throw new HttpError(401, "Sign in to view workspace configuration.");
    }
    let agentConfigured = false;
    try {openAIConfig(); agentConfigured = true;} catch { /* Never expose credentials. */ }
    return Response.json({verificationConfigured: agentConfigured, agentConfigured, agentProvider: "openai"}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {return errorResponse(error);}
}
