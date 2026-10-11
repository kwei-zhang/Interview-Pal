import { z } from "zod";
import { adminForRequest, checkAdminResult } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
export async function PATCH(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    assertSameOrigin(request);
    const {supabase} = await adminForRequest(request);
    const id = z.uuid().parse((await context.params).id);
    const {status} = z.object({status: z.enum(["active", "suspended"])}).strict().parse(await readJson(request, 1000));
    checkAdminResult(await supabase.rpc("admin_set_user_status", {target_user_id: id, new_status: status}));
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
