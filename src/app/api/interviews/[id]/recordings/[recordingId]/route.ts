import { z } from "zod";
import { assertAccountBinding, requireUser } from "@/lib/server/accounts";
import { assertSameOrigin, errorResponse, HttpError } from "@/lib/server/http";
import { getRecording, markRecordingReady, removeRecording } from "@/lib/server/recordings";
import { recordingStorage } from "@/lib/server/recording-storage";
import { recordingFilename } from "@/lib/recordings/types";

type Context = {params:Promise<{id:string;recordingId:string}>};
async function owned(request:Request, context:Context) {
  const auth=await requireUser();
  assertAccountBinding(request.headers.get("x-workspace-user-id"),auth.user.id);
  const params=z.object({id:z.uuid(),recordingId:z.uuid()}).parse(await context.params);
  const recording=await auth.db(db=>getRecording(db,auth.user.id,params.id,params.recordingId));
  return {...auth,recording};
}
export async function GET(request:Request,context:Context) {
  try {
    const {recording}=await owned(request,context);
    if(recording.status!=="ready") throw new HttpError(409,"This recording has not finished uploading.");
    const download=new URL(request.url).searchParams.get("download")==="true";
    const filename=recordingFilename(recording.sessionId,recording.id,recording.mimeType);
    return Response.json({url:await recordingStorage().read(recording.objectKey,download?filename:undefined)}, {headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
export async function POST(request:Request,context:Context) {
  try {
    assertSameOrigin(request);
    const {user,db,recording}=await owned(request,context);
    const actual=await recordingStorage().head(recording.objectKey);
    if(actual.bytes!==recording.sizeBytes || actual.mime!==recording.mimeType) throw new HttpError(409,"The uploaded recording is incomplete. Retry uploading your local copy.");
    await db(connection=>markRecordingReady(connection,user.id,recording.sessionId,recording.id));
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
export async function DELETE(request:Request,context:Context) {
  try {
    assertSameOrigin(request);
    const {user,db,recording}=await owned(request,context);
    await recordingStorage().delete(recording.objectKey);
    await db(connection=>removeRecording(connection,user.id,recording.sessionId,recording.id));
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return errorResponse(error);}
}
