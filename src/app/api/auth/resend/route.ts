import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { serverSupabase } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure, authSiteUrl } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {email} = z.object({email: emailSchema}).strict().parse(await readJson(request, 1000));
    const supabase = await serverSupabase();
    const {error} = await supabase.auth.resend({type: "signup", email, options: {emailRedirectTo: `${authSiteUrl(request)}/auth/confirm`}});
    if (error && (error.status === 429 || (error.status || 0) >= 500)) authFailure(error, "Unable to resend confirmation.");
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
