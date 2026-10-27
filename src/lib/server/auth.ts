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

export function passwordRecoverySiteUrl(request: Request): string {
  // A preview may use a different identity provider from production during a
  // migration. Take its destination from Vercel's server environment, never Host
  // or forwarding headers supplied by a request.
  if (process.env.VERCEL_ENV === "preview") {
    const hostname = process.env.VERCEL_URL;
    if (!hostname || !/^[a-z0-9-]+\.vercel\.app$/.test(hostname))
      throw new HttpError(503, "The password recovery preview URL is not configured.");
    return `https://${hostname}${basePath}`;
  }
  return authSiteUrl(request);
}
const authErrors: Record<string, {status: number; message: string}> = {
  email_not_confirmed: {status: 403, message: "Verify your email before signing in."},
  weak_password: {status: 400, message: "This password does not meet the account password requirements. Use at least 12 characters."},
  over_request_rate_limit: {status: 429, message: "Too many account emails or sign-in requests. Wait before trying again."},
  over_email_send_rate_limit: {status: 429, message: "Too many account emails. Wait before trying again."},
};

export function authFailure(error: {status?: number; code?: string}, message: string, operation: "auth" | "signup" = "auth"): never {
  const known = error.code && Object.hasOwn(authErrors, error.code) ? authErrors[error.code] : undefined;
  // Never log the raw provider error: messages can contain emails or signup data.
  // Even unknown provider codes are excluded from logs and client responses.
  console.warn(JSON.stringify({event: "auth_request_failed", provider: "neon", operation,
    status: typeof error.status === "number" && Number.isFinite(error.status) ? error.status : null,
    code: known ? error.code : "unclassified"}));
  if (known) throw new HttpError(known.status, known.message, error.code);
  if (error.status === 429) throw new HttpError(429, "Too many attempts. Please wait before trying again.", "auth_rate_limited");
  if (error.status && error.status >= 500) throw new HttpError(503, "Account service is unavailable. Please retry shortly.", "auth_service_unavailable");
  throw new HttpError(400, message, "auth_request_rejected");
}
