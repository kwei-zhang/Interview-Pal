import { signupSchema } from "@/lib/auth";
import { serverSupabase } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure, authSiteUrl } from "@/lib/server/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = signupSchema.parse(await readJson(request, 3000));
    const supabase = await serverSupabase();
    const {error} = await supabase.auth.signUp({email: input.email, password: input.password,
      options: {emailRedirectTo: `${authSiteUrl(request)}/auth/confirm`, data: {display_name: input.displayName, invite_code: input.inviteCode}}});
    if (error) authFailure(error, "Registration could not be completed. Check your invitation and email, or use sign in / verification resend if you already registered.", "signup");
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
