import { adminForRequest, adminPageOffset } from "@/lib/server/admin";
import { errorResponse } from "@/lib/server/http";
export async function GET(request: Request) {
  try {
    const {db} = await adminForRequest(request);
    const users = await db(async connection => (await connection.query("select * from public.admin_list_users($1)", [adminPageOffset(request)])).rows);
    return Response.json({users}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
