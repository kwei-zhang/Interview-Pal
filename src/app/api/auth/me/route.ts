import { assertAccountBinding, requireUser } from "@/lib/server/supabase";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const {user, account} = await requireUser();
    assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id);
    return Response.json({userId: user.id, role: account.role}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
