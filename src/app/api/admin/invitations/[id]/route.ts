import { databaseFunction } from "@/lib/server/database";
import { z } from "zod";
import { adminForRequest } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse } from "@/lib/server/http";
export async function DELETE(request: Request, context: {params: Promise<{id: string}>}) {
  try {
    assertSameOrigin(request);
    const {db} = await adminForRequest(request);
    const id = z.uuid().parse((await context.params).id);
    await db(connection => databaseFunction(connection, "public.admin_revoke_invitation", [id]));
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
