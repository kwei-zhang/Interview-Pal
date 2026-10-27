import { databaseFunction } from "@/lib/server/database";
import { z } from "zod";
import { adminForRequest } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
export async function PATCH(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    assertSameOrigin(request);
    const {db} = await adminForRequest(request);
    const id = z.uuid().parse((await context.params).id);
    const {status} = z.object({status: z.enum(["active", "suspended"])}).strict().parse(await readJson(request, 1000));
    await db(connection => databaseFunction(connection, "public.admin_set_user_status", [id, status]));
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
