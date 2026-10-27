import { databaseFunction } from "@/lib/server/database";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { adminForRequest, adminPageOffset } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const {db} = await adminForRequest(request);
    const invitations = await db(async connection => (await connection.query("select * from public.admin_list_invitations($1)", [adminPageOffset(request)])).rows);
    return Response.json({invitations}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {db} = await adminForRequest(request);
    const {email} = z.object({email: emailSchema}).strict().parse(await readJson(request, 1000));
    const code = randomBytes(16).toString("hex").toUpperCase();
    const invitation = await db(connection => databaseFunction(connection, "public.admin_create_invitation", [email, createHash("sha256").update(code).digest("hex")]));
    return Response.json({invitation, code: code.match(/.{8}/g)!.join("-")}, {status: 201, headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
