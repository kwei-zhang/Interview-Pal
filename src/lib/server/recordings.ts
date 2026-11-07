import { z } from "zod";
import type { Database } from "./database";
import { HttpError } from "./http";
import { MAX_RECORDING_BYTES, recordingMimeTypes, type RecordingInfo } from "../recordings/types";

export const recordingUploadSchema = z.object({id: z.uuid(), mimeType: z.enum(recordingMimeTypes), sizeBytes: z.number().int().min(1).max(MAX_RECORDING_BYTES), durationMs: z.number().int().min(0).max(86400000)}).strict();
export type StoredRecording = RecordingInfo & {objectKey: string};
const columns = 'id, session_id as "sessionId", object_key as "objectKey", mime_type as "mimeType", size_bytes::float8 as "sizeBytes", duration_ms as "durationMs", created_at as "createdAt", status';
export async function assertRecordingSession(db: Database, userId: string, sessionId: string) {
  if (!(await db.query("select id from public.interview_sessions where id=$1 and user_id=$2", [sessionId,userId])).rows.length) throw new HttpError(404,"Interview session not found.");
}
export async function listRecordings(db: Database, userId: string, sessionId: string, verifySession = true) {
  if (verifySession) await assertRecordingSession(db,userId,sessionId);
  return (await db.query<StoredRecording>(`select ${columns} from public.interview_recordings where user_id=$1 and session_id=$2 order by created_at,id`,[userId,sessionId])).rows;
}
export async function getRecording(db: Database, userId: string, sessionId: string, recordingId: string) {
  const row = (await db.query<StoredRecording>(`select ${columns} from public.interview_recordings where user_id=$1 and session_id=$2 and id=$3`,[userId,sessionId,recordingId])).rows[0];
  if (!row) throw new HttpError(404,"Recording not found.");
  return row;
}
export async function prepareRecording(db: Database, userId: string, sessionId: string, value: z.infer<typeof recordingUploadSchema>) {
  await assertRecordingSession(db,userId,sessionId);
  const objectKey = `recordings/${userId}/${sessionId}/${value.id}`;
  await db.query(`insert into public.interview_recordings(id,user_id,session_id,object_key,mime_type,size_bytes,duration_ms) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing`,[value.id,userId,sessionId,objectKey,value.mimeType,value.sizeBytes,value.durationMs]);
  const row = await getRecording(db,userId,sessionId,value.id);
  if (row.mimeType!==value.mimeType || row.sizeBytes!==value.sizeBytes || row.durationMs!==value.durationMs) throw new HttpError(409,"This recording has different saved metadata. Keep your local copy and retry.");
  return row;
}
export async function markRecordingReady(db: Database, userId: string, sessionId: string, id: string) {
  await db.query("update public.interview_recordings set status='ready' where id=$1 and user_id=$2 and session_id=$3",[id,userId,sessionId]);
}
export async function removeRecording(db: Database, userId: string, sessionId: string, id: string) {
  await db.query("delete from public.interview_recordings where id=$1 and user_id=$2 and session_id=$3",[id,userId,sessionId]);
}
