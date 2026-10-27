import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { serverAuth } from "@/lib/server/neon-auth";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure, passwordRecoverySiteUrl } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {email} = z.object({email: emailSchema}).strict().parse(await readJson(request, 1000));
    const auth = await serverAuth(true);
    const {error} = await auth.requestPasswordReset({email, redirectTo: `${passwordRecoverySiteUrl(request)}/reset-password`});
    // Unknown email addresses already receive the provider's generic success.
    // Configuration and transport errors must not look like successful delivery.
    if (error) authFailure(error, "Unable to request password recovery. Please retry shortly.");
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
