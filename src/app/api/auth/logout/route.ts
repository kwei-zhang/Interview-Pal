import { assertAccountBinding, requireIdentity } from "@/lib/server/supabase";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const {supabase, user} = await requireIdentity();
    assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id);
    const {error} = await supabase.auth.signOut({scope: "local"}); if (error) throw new HttpError(500, "Could not sign out.");
    return Response.json({ok: true});
  } catch (error) {return errorResponse(error);}
}
