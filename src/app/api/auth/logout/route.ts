import { assertAccountBinding, requireIdentity } from "@/lib/server/accounts";
import { serverAuth } from "@/lib/server/neon-auth";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/server/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request); const {user} = await requireIdentity();
    assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id);
    const auth = await serverAuth(true);
    const {error} = await auth.signOut(); if (error) throw new HttpError(503, "Could not sign out. Please retry.");
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {return errorResponse(error);}
}
