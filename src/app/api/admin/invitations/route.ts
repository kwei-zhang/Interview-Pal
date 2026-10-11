import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { emailSchema } from "@/lib/auth";
import { adminForRequest, adminPageOffset, checkAdminResult } from "@/lib/server/admin";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const {supabase} = await adminForRequest(request);
    const invitations = checkAdminResult(await supabase.rpc("admin_list_invitations", {page_offset: adminPageOffset(request)}));
    return Response.json({invitations}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {supabase} = await adminForRequest(request);
    const {email} = z.object({email: emailSchema}).strict().parse(await readJson(request, 1000));
    const code = randomBytes(16).toString("hex").toUpperCase();
    const invitation = checkAdminResult(await supabase.rpc("admin_create_invitation", {recipient_email: email, token_hash: createHash("sha256").update(code).digest("hex")}));
    return Response.json({invitation, code: code.match(/.{8}/g)!.join("-")}, {status: 201, headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
