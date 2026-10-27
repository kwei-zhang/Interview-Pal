import { z } from "zod";
import { passwordSchema } from "@/lib/auth";
import { serverAuth } from "@/lib/server/neon-auth";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { authFailure } from "@/lib/server/auth";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const {password, token} = z.object({password: passwordSchema, token: z.string().min(1).max(1000)}).strict().parse(await readJson(request, 2000));
    const auth = await serverAuth(true);
    const {error} = await auth.resetPassword({newPassword: password, token});
    if (error) authFailure(error, "Could not update your password. Request a new recovery link and retry.");
    await auth.signOut();
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
