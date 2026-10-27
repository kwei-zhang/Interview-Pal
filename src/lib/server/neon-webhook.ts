import { createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { z } from "zod";
import { HttpError } from "./http";

const payloadSchema = z.object({
  event_id: z.uuid(), event_type: z.enum(["user.before_create", "user.created"]),
  context: z.object({endpoint_id: z.string().min(1)}),
  user: z.object({id: z.string().min(1).max(200).optional(), email: z.email().max(254), is_anonymous: z.boolean().optional()}),
  event_data: z.object({auth_provider: z.string(), user_agent: z.string().max(2000).optional()}),
});

export function webhookAdmissionToken(userAgent?: string): string | undefined {
  return /^InterviewPal-Admission\/1 ([a-f0-9]{64})$/.exec(userAgent || "")?.[1];
}
type SigningKey = JsonWebKey & {kid?: string; alg?: string; use?: string};
let cached: {url: string; keys: SigningKey[]; expires: number; refreshed: number} | undefined;
async function signingKeys(url: string, unknownKey: boolean): Promise<SigningKey[]> {
  const now = Date.now();
  if (cached?.url === url && cached.expires > now && (!unknownKey || now - cached.refreshed < 30000)) return cached.keys;
  const response = await fetch(url, {signal: AbortSignal.timeout(5000), redirect: "error", cache: "no-store"});
  if (!response.ok) throw new HttpError(503, "Webhook verification is unavailable.");
  const body = await response.json() as {keys?: SigningKey[]};
  if (!Array.isArray(body.keys) || body.keys.length > 20) throw new HttpError(503, "Webhook verification is unavailable.");
  cached = {url, keys: body.keys, expires: now + 300000, refreshed: now};
  return cached.keys;
}

export async function verifyNeonWebhook(raw: string, headers: Headers, options?: {baseUrl: string; keys: SigningKey[]; now?: number}) {
  const rejected = (reason: string) => new HttpError(401, "Invalid webhook signature.", `webhook_${reason}`);
  const base = new URL(options?.baseUrl || process.env.NEON_AUTH_BASE_URL || "https://unconfigured.invalid");
  const timestamp = headers.get("x-neon-timestamp") || "";
  if (!/^\d{13}$/.test(timestamp) || Math.abs((options?.now ?? Date.now()) - Number(timestamp)) > 300000) throw rejected("timestamp");
  const pieces = (headers.get("x-neon-signature") || "").split(".");
  if (pieces.length !== 3 || pieces[1] !== "" || !/^[\w-]+$/.test(pieces[0]) || !/^[\w-]+$/.test(pieces[2])) throw rejected("format");
  let protectedHeader: {alg?: string; kid?: string; crit?: unknown};
  try { protectedHeader = JSON.parse(Buffer.from(pieces[0], "base64url").toString()); } catch { throw rejected("header"); }
  const kid = headers.get("x-neon-signature-kid");
  if (!kid || protectedHeader.kid !== kid || protectedHeader.alg !== "EdDSA" || protectedHeader.crit) throw rejected("algorithm");
  const url = `${base.href.replace(/\/$/, "")}/.well-known/jwks.json`;
  let keys = options?.keys || await signingKeys(url, false);
  if (!options && !keys.some(k => k.kid === kid)) keys = await signingKeys(url, true);
  const key = keys.find(k => k.kid === kid && k.kty === "OKP" && k.crv === "Ed25519" && (!k.use || k.use === "sig"));
  if (!key) throw rejected("key");
  const signed = Buffer.from(`${timestamp}.${Buffer.from(raw).toString("base64url")}`).toString("base64url");
  if (!verify(null, Buffer.from(`${pieces[0]}.${signed}`), createPublicKey({key, format: "jwk"}), Buffer.from(pieces[2], "base64url"))) throw rejected("signature");
  const payload = payloadSchema.parse(JSON.parse(raw));
  if (payload.event_type === "user.created" && !payload.user.id) throw rejected("missing_identity");
  if (payload.context.endpoint_id !== base.hostname.split(".")[0] || headers.get("x-neon-event-type") !== payload.event_type
    || headers.get("x-neon-event-id") !== payload.event_id) throw rejected("context");
  return payload;
}
