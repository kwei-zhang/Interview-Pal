import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { HttpError } from "./http";

export function recordingStorageConfigured(env: Record<string,string|undefined> = process.env) {
  return Boolean(env.RECORDINGS_S3_ENDPOINT && env.RECORDINGS_S3_REGION && env.RECORDINGS_S3_BUCKET && env.RECORDINGS_S3_ACCESS_KEY_ID && env.RECORDINGS_S3_SECRET_ACCESS_KEY);
}
export interface RecordingStorage {
  upload(key: string, mime: string, bytes: number): Promise<{url: string; fields: Record<string,string>}>;
  head(key: string): Promise<{bytes?: number; mime?: string}>;
  read(key: string, filename?: string): Promise<string>;
  delete(key: string): Promise<void>;
}
export function recordingStorage(): RecordingStorage {
  if (!recordingStorageConfigured()) throw new HttpError(503, "Cloud recording storage is not connected. Your recording remains on this browser; retry uploading later.");
  const Bucket = process.env.RECORDINGS_S3_BUCKET!;
  const client = new S3Client({endpoint: process.env.RECORDINGS_S3_ENDPOINT, region: process.env.RECORDINGS_S3_REGION, forcePathStyle: true,
    credentials: {accessKeyId: process.env.RECORDINGS_S3_ACCESS_KEY_ID!, secretAccessKey: process.env.RECORDINGS_S3_SECRET_ACCESS_KEY!}, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED"});
  return {
    upload: (Key, mime, bytes) => createPresignedPost(client, {Bucket, Key, Expires: 300, Fields: {"Content-Type": mime}, Conditions: [["content-length-range", bytes, bytes], ["eq", "$Content-Type", mime]]}),
    head: async Key => {const value = await client.send(new HeadObjectCommand({Bucket, Key})); return {bytes: value.ContentLength, mime: value.ContentType};},
    read: (Key, filename) => getSignedUrl(client, new GetObjectCommand({Bucket, Key, ...(filename ? {ResponseContentDisposition: `attachment; filename="${filename}"`} : {})}), {expiresIn: 900}),
    delete: async Key => {await client.send(new DeleteObjectCommand({Bucket, Key}));},
  };
}
