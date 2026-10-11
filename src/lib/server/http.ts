import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return Response.json({error: error.message}, {status: error.status});
  if (error instanceof ZodError) return Response.json({error: error.issues[0]?.message || "Invalid request."}, {status: 400});
  // Log only classification, not query payloads, credentials, or transcript text.
  console.error(JSON.stringify({event: "request_failed", errorType: error instanceof Error ? error.name : "unknown"}));
  return Response.json({error: "Unable to save your data. Please retry."}, {status: 500});
}
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next can normalize request.url to localhost while preserving the browser's Host.
  const host = request.headers.get("host") || url.host;
  if (!origin || origin !== `${url.protocol}//${host}`) throw new HttpError(403, "This request must come from the Interview Pal website.");
}
export async function readJson(request: Request, maxBytes = 500000): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Request is too large.");
  if (!request.body) throw new HttpError(400, "A JSON request body is required.");
  const reader = request.body.getReader();
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const {value, done} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new HttpError(400, "Request body must be valid JSON."); }
}
