import { z } from "zod";
import { requireUser } from "@/lib/server/accounts";
import { serverAuth } from "@/lib/server/neon-auth";
import { emailSchema } from "@/lib/auth";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = z.object({email: emailSchema, password: z.string().min(1).max(200)}).strict().parse(await readJson(request, 2000));
    const auth = await serverAuth(true);
    const {error} = await auth.signIn.email(input);
    if (error) throw new HttpError(error.status === 429 ? 429 : error.status >= 500 ? 503 : 401,
      error.status === 429 ? "Too many sign-in attempts. Please try again later." : error.code === "email_not_confirmed" ? "Verify your email first. You can request a new code below." : "Could not sign in. Check your email and password. Existing users must reconnect once after the migration.");
    try { await requireUser(); } catch (accessError) { await auth.signOut(); throw accessError; }
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {return errorResponse(error);}
}
