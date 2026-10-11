import { z } from "zod";
import { serverSupabase } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = z.object({token_hash: z.string().min(1).max(500), type: z.enum(["email", "recovery"])}).strict().parse(await readJson(request, 1000));
    const supabase = await serverSupabase();
    const {error} = await supabase.auth.verifyOtp(input);
    if (error) authFailure(error, "This link is invalid or expired. Request a new email and try again.");
    return Response.json({ok: true, redirectTo: input.type === "recovery" ? "/reset-password" : "/"}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
