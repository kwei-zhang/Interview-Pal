import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { serverAuth } from "@/lib/server/neon-auth";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {email, code} = z.object({email: emailSchema, code: z.string().regex(/^\d{6}$/, "Enter the six-digit code from your email.")}).strict().parse(await readJson(request, 1000));
    const auth = await serverAuth(true);
    const {error} = await auth.emailOtp.verifyEmail({email, otp: code});
    if (error) authFailure(error, "This code is invalid or expired. Request a new email and try again.");
    // Verification does not need to establish a session; explicit sign-in proves
    // the new password and resolves any delayed membership finalization.
    return Response.json({ok: true, redirectTo: "/login?notice=email-verified"}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
