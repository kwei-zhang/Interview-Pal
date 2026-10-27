import { ZodError } from "zod";
import { verifyNeonWebhook, webhookAdmissionToken } from "@/lib/server/neon-webhook";
import { databaseFunction, withDatabase } from "@/lib/server/database";
import { secretHash } from "@/lib/server/admissions";
import { HttpError, errorResponse, readBody } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    const raw = await readBody(request, 20000);
    const event = await verifyNeonWebhook(raw, request.headers);
    if (event.event_data.auth_provider !== "credential" || event.user.is_anonymous) return Response.json({allowed: false, error_message: "An email invitation is required."});
    const token = webhookAdmissionToken(event.event_data.user_agent);
    if (event.event_type === "user.before_create") console.info(JSON.stringify({event: "signup_admission_check", admissionPresent: Boolean(token)}));
    const result = await withDatabase(db => databaseFunction(db, "private.process_auth_event", [
      event.event_id, event.event_type, event.user.id || null, event.user.email, token ? secretHash(token) : null, secretHash(raw),
    ]));
    return Response.json(result, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    console.warn(JSON.stringify({event: "neon_webhook_rejected", code: error instanceof HttpError ? error.code : "invalid_payload",
      ...(error instanceof ZodError ? {fields: error.issues.map(issue => issue.path.join("."))} : {})}));
    return errorResponse(error);
  }
}
