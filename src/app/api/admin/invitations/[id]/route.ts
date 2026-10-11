import { z } from "zod";
import { adminForRequest, checkAdminResult } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
export async function DELETE(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    assertSameOrigin(request);
    const {supabase} = await adminForRequest(request);
    const id = z.uuid().parse((await context.params).id);
    checkAdminResult(await supabase.rpc("admin_revoke_invitation", {invitation_id: id}));
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
