import { cookies, headers } from "next/headers";
import { createAuthServer, handleAuthRequest, resolveNeonAuthLogging } from "@neondatabase/auth/server";
import { basePath } from "../paths";
import { HttpError } from "./http";

export function neonConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

function authBaseUrl() {
  if (!neonConfigured()) throw new HttpError(503, "Configure Neon to enable private login.");
  const url = new URL(process.env.NEON_AUTH_BASE_URL!);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new HttpError(503, "Neon Auth must use HTTPS.");
  return url.href.replace(/\/$/, "");
}

export async function signupWithAdmission(credentials: {email: string; password: string; name: string}, admissionToken: string, origin: string) {
  // The hosted service drops extra signup body fields. Its documented, signed
  // user_agent request metadata carries our one-use email-bound admission instead.
  // This header is generated here, never copied from the browser or logged.
  return handleAuthRequest(authBaseUrl(), new Request(`${origin}/api/auth/signup`, {
    method: "POST",
    headers: {"Content-Type": "application/json", Origin: origin, "User-Agent": `InterviewPal-Admission/1 ${admissionToken}`},
    body: JSON.stringify(credentials),
  }), "sign-up/email", resolveNeonAuthLogging({logLevel: "silent"}));
}

// Use the SDK's documented framework adapter to scope cookies to /interview.
// Session reads always reach Auth: revoked sessions cannot survive a cached cookie.
export async function serverAuth(writable = false) {
  const baseUrl = authBaseUrl();
  const cookieStore = await cookies(), headerStore = await headers();
  return createAuthServer({
    baseUrl,
    cookieSecret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sameSite: "lax",
    log: resolveNeonAuthLogging({logLevel: "silent"}),
    context: () => ({
      getCookies: () => cookieStore.getAll().filter(c => c.name.startsWith("__Secure-neon-auth.") && !c.name.endsWith("session_data"))
        .map(c => `${c.name}=${c.value}`).join("; "),
      setCookie: (name, value, options) => {
        if (!writable || name.endsWith("session_data")) return;
        cookieStore.set(name, value, {...options, domain: undefined, path: basePath || "/", httpOnly: true});
      },
      getHeader: name => headerStore.get(name),
      getOrigin: () => process.env.AUTH_SITE_URL ? new URL(process.env.AUTH_SITE_URL).origin : headerStore.get("origin") || "",
      getFramework: () => "nextjs",
    }),
  });
}
