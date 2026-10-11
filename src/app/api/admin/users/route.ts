import { adminForRequest, adminPageOffset, checkAdminResult } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const {supabase} = await adminForRequest(request);
    const users = checkAdminResult(await supabase.rpc("admin_list_users", {page_offset: adminPageOffset(request)}));
    return Response.json({users}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
