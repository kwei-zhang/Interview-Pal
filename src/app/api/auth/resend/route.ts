import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { serverAuth } from "@/lib/server/neon-auth";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {email} = z.object({email: emailSchema}).strict().parse(await readJson(request, 1000));
    const auth = await serverAuth(true);
    const {error} = await auth.emailOtp.sendVerificationOtp({email, type: "email-verification"});
    if (error && (error.status === 429 || error.status >= 500)) authFailure(error, "Unable to resend confirmation.");
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
