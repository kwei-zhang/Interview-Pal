import { z } from "zod";
import { assertAccountBinding, requireUser } from "@/lib/server/accounts";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/server/http";
import { listRecordings, prepareRecording, recordingUploadSchema } from "@/lib/server/recordings";
import { recordingStorage, recordingStorageConfigured } from "@/lib/server/recording-storage";

type Context = {params: Promise<{id: string}>};
export async function GET(request: Request, context: Context) {
  try {
    const {user,db} = await requireUser();
    assertAccountBinding(request.headers.get("x-workspace-user-id"),user.id);
    const id = z.uuid().parse((await context.params).id);
    const rows = await db(connection => listRecordings(connection,user.id,id));
    return Response.json({configured: recordingStorageConfigured(), recordings: rows.map(({objectKey: _key,...info})=>info)}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
export async function POST(request: Request, context: Context) {
  try {
    assertSameOrigin(request);
    const {user,db} = await requireUser();
    assertAccountBinding(request.headers.get("x-workspace-user-id"),user.id);
    const id = z.uuid().parse((await context.params).id);
    const value = recordingUploadSchema.parse(await readJson(request,4000));
    const storage = recordingStorage();
    const row = await db(connection => prepareRecording(connection,user.id,id,value));
    return Response.json({ready:row.status === "ready", ...(row.status === "ready" ? {} : {upload:await storage.upload(row.objectKey,row.mimeType,row.sizeBytes)})}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
