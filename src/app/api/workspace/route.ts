import { assertAccountBinding, requireUser } from "@/lib/server/accounts";
import { errorResponse, assertSameOrigin, readJson } from "@/lib/server/http";
import { loadWorkspace, saveMutation } from "@/lib/server/workspace";
import { mutationSchema } from "@/lib/validation";
import { problems } from "@/lib/data/catalog";
import { HttpError } from "@/lib/server/http";
import { listRecordings, removeRecording } from "@/lib/server/recordings";
import { recordingStorage } from "@/lib/server/recording-storage";
import { z } from "zod";

export async function GET(request: Request) {
  try {
    const {db, user} = await requireUser();
    assertAccountBinding(request.headers.get("x-workspace-user-id"), user.id);
    return Response.json(await db(connection => loadWorkspace(connection, user.id)), {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);
    const {db, user} = await requireUser();
    const {userId, mutation} = z.object({userId: z.uuid(), mutation: mutationSchema}).strict().parse(await readJson(request));
    assertAccountBinding(userId, user.id);
    if ((mutation.kind === "progress" || mutation.kind === "draft") && !problems.some(p => p.id === mutation.value.problemId)) throw new HttpError(400, "Unknown problem.");
    if (mutation.kind === "delete-session") {
      const recordings = await db(connection => listRecordings(connection,user.id,mutation.id,false));
      for (const recording of recordings) {
        await recordingStorage().delete(recording.objectKey);
        await db(connection => removeRecording(connection,user.id,mutation.id,recording.id));
      }
    }
    await db(connection => saveMutation(connection, user.id, mutation));
    return Response.json({ok: true});
  } catch (error) { return errorResponse(error); }
}
