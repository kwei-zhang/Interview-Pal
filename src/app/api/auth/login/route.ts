import { z } from "zod";
import { requireUser, serverSupabase } from "@/lib/server/supabase";
import { emailSchema } from "@/lib/auth";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = z.object({email: emailSchema, password: z.string().min(1).max(200)}).strict().parse(await readJson(request, 2000));
    const supabase = await serverSupabase();
    const {error} = await supabase.auth.signInWithPassword(input);
    if (error) throw new HttpError(error.status === 429 ? 429 : 401, error.status === 429 ? "Too many sign-in attempts. Please try again later." : error.code === "email_not_confirmed" ? "Verify your email first. You can resend the confirmation below." : "Could not sign in. Check your email and password.");
    try { await requireUser(); } catch (accessError) { await supabase.auth.signOut({scope: "local"}); throw accessError; }
    return Response.json({ok: true});
  } catch (error) {return errorResponse(error);}
}
