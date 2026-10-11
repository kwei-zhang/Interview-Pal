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
export function authFailure(error: {status?: number; code?: string}, message: string): never {
  if (error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit")
    throw new HttpError(429, "Too many attempts. Please wait before trying again.");
  if (error.status && error.status >= 500) throw new HttpError(503, "Account service is unavailable. Please retry shortly.");
  throw new HttpError(400, message);
}
