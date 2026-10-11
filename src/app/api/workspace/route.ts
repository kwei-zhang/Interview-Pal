import { requireUser } from "@/lib/server/supabase";
import { errorResponse, assertSameOrigin, readJson } from "@/lib/server/http";
import { loadWorkspace, saveMutation } from "@/lib/server/workspace";
import { mutationSchema } from "@/lib/validation";
import { problems } from "@/lib/data/catalog";
import { HttpError } from "@/lib/server/http";

export async function GET() {
  try {
    const {supabase, user} = await requireUser();
    return Response.json(await loadWorkspace(supabase, user.id), {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const {supabase, user} = await requireUser();
    const mutation = mutationSchema.parse(await readJson(request));
    if ((mutation.kind === "progress" || mutation.kind === "draft") && !problems.some(p => p.id === mutation.value.problemId)) throw new HttpError(400, "Unknown problem.");
    await saveMutation(supabase, user.id, mutation);
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
