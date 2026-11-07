export const MAX_RECORDING_BYTES = 128 * 1024 * 1024;
export const recordingMimeTypes = ["audio/webm", "audio/ogg", "audio/mp4"] as const;
export type RecordingMime = typeof recordingMimeTypes[number];
export interface RecordingInfo {
  id: string; sessionId: string; mimeType: RecordingMime; sizeBytes: number;
  durationMs: number; createdAt: string; status: "pending" | "ready";
}
export function recordingExtension(mime: string) {return mime.startsWith("audio/mp4") ? "m4a" : mime.startsWith("audio/ogg") ? "ogg" : "webm";}
export function recordingFilename(sessionId: string, recordingId: string, mime: string) {return `interview-${sessionId}-${recordingId}.${recordingExtension(mime)}`;}
