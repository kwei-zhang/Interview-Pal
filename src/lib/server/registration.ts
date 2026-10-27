import { signupSchema, reconnectSchema } from "../auth";
import { createAdmission, secretHash } from "./admissions";
import { withDatabase, databaseFunction } from "./database";
import { signupWithAdmission } from "./neon-auth";
import { authFailure, authSiteUrl } from "./auth";
import { assertSameOrigin, errorResponse, HttpError, readJson } from "./http";

export async function register(request: Request, reconnect: boolean) {
  try {
    assertSameOrigin(request);
    const value = await readJson(request, 3000);
    const input = reconnect ? reconnectSchema.parse(value) : signupSchema.parse(value);
    const admissionToken = await createAdmission(input, reconnect);
    const credentials = {email: input.email, password: input.password, name: input.displayName};
    const response = await signupWithAdmission(credentials, admissionToken, new URL(authSiteUrl(request)).origin);
    if (!response.ok) authFailure({status: response.status}, "Registration could not be completed. Check your invitation and email, or use sign in / verification resend if you already registered.", "signup");
    const data = await response.json();
    if (typeof data?.user?.id !== "string" || !data.user.id || data.user.id.length > 200 || data.user.email?.toLowerCase() !== input.email)
      throw new HttpError(503, "Registration could not be confirmed. Please retry or use verification resend if you already registered.");
    await withDatabase(async db => {
      const bound = await databaseFunction<boolean>(db, "private.bind_admission", [secretHash(admissionToken), input.email, data.user.id]);
      // Better Auth can mask a denied signup with an enumeration-safe 200.
      if (!bound) throw new HttpError(400, "Registration was not admitted. Check your invitation or reconnect your existing account.");
      await databaseFunction(db, "private.resolve_identity", [data.user.id, input.email, false]);
    });
    return Response.json({ok: true}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}
