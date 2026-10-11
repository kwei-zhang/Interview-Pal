import { HttpError } from "./http";
import { basePath } from "../paths";

export function authSiteUrl(request: Request): string {
  const configured = process.env.AUTH_SITE_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname)))
      throw new HttpError(503, "Configure an HTTPS AUTH_SITE_URL before sending account emails.");
    if (url.pathname !== "/" && url.pathname.replace(/\/$/, "") !== basePath)
      throw new HttpError(503, "AUTH_SITE_URL must use the website origin or its configured base path.");
    return `${url.origin}${basePath}`;
  }
  const url = new URL(request.url);
  if (process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1"].includes(url.hostname)) return `${url.origin}${basePath}`;
  throw new HttpError(503, "Configure AUTH_SITE_URL before sending account emails.");
}
const authErrors: Record<string, {status: number; message: string}> = {
  email_address_not_authorized: {status: 503, message: "Confirmation emails cannot be sent to this address with the current email service. The administrator needs to configure custom SMTP in Supabase."},
  email_address_invalid: {status: 400, message: "This email address is not supported. Use a valid email address that matches your invitation."},
  signup_disabled: {status: 503, message: "Registration is disabled in Supabase. Ask the administrator to enable email signup after configuring invitation checks."},
  email_provider_disabled: {status: 503, message: "Email registration is disabled in Supabase. Ask the administrator to enable the Email provider."},
  weak_password: {status: 400, message: "This password does not meet the account password requirements. Use at least 12 characters with uppercase and lowercase letters, numbers, and symbols; avoid common or compromised passwords."},
  captcha_failed: {status: 400, message: "The signup security check could not be completed. Contact the administrator to check the CAPTCHA configuration."},
  over_email_send_rate_limit: {status: 429, message: "Too many account emails have been requested. Wait before trying again; the administrator can check Supabase email rate limits."},
  over_request_rate_limit: {status: 429, message: "Too many attempts. Please wait before trying again."},
  hook_timeout: {status: 503, message: "The invitation check timed out. Please retry shortly."},
  hook_timeout_after_retry: {status: 503, message: "The invitation check timed out. Please retry shortly."},
};

export function authFailure(error: {status?: number; code?: string}, message: string, operation: "auth" | "signup" = "auth"): never {
  const known = error.code && Object.hasOwn(authErrors, error.code) ? authErrors[error.code] : undefined;
  // Never log the raw provider error: messages can contain emails or signup data.
  // Even unknown provider codes are excluded from logs and client responses.
  console.warn(JSON.stringify({event: "auth_request_failed", provider: "supabase", operation,
    status: typeof error.status === "number" && Number.isFinite(error.status) ? error.status : null,
    code: known ? error.code : "unclassified"}));
  if (known) throw new HttpError(known.status, known.message, error.code);
  if (error.status === 429) throw new HttpError(429, "Too many attempts. Please wait before trying again.", "auth_rate_limited");
  if (error.status && error.status >= 500) throw new HttpError(503, "Account service is unavailable. Please retry shortly.", "auth_service_unavailable");
  throw new HttpError(400, message, "auth_request_rejected");
}
