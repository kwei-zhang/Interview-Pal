import { z } from "zod";
import { passwordSchema } from "@/lib/auth";
import { assertAccountBinding, requireIdentity } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {supabase, user} = await requireIdentity();
    assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id);
    const {password} = z.object({password: passwordSchema}).strict().parse(await readJson(request, 1000));
    const {error} = await supabase.auth.updateUser({password});
    if (error) authFailure(error, "Could not update your password. Request a new recovery link and retry.");
    await supabase.auth.signOut({scope: "global"});
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
