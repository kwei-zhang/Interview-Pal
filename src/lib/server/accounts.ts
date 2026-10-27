import type { Account } from "../auth";
import { serverAuth } from "./neon-auth";
import { databaseFunction, userDatabase, withDatabase } from "./database";
import { HttpError } from "./http";
export { neonConfigured } from "./neon-auth";

type StoredAccount = Account & {email: string; verified_at: string | null; legacy: boolean};
async function resolveIdentity(providerId: string, email: string, verified: boolean, createdAt?: string | Date) {
  return withDatabase(db => databaseFunction<StoredAccount | null>(db, "private.resolve_verified_identity", [providerId, email, verified, createdAt || null]));
}
export async function requireIdentity() {
  const auth = await serverAuth();
  const {data, error} = await auth.getSession();
  if (error && error.status >= 500) throw new HttpError(503, "Account service is unavailable. Please retry shortly.");
  if (error || !data?.user || !data.session) throw new HttpError(401, "Sign in to access your private workspace.", "unauthenticated");
  const identity = data.user;
  const account = await resolveIdentity(identity.id, identity.email, identity.emailVerified === true, identity.createdAt);
  return {identity, account, user: {id: account?.user_id || identity.id, email: identity.email}, db: userDatabase(account?.user_id || "")};
}
export function assertAccountBinding(expectedUserId: unknown, actualUserId: string) {
  if (typeof expectedUserId !== "string" || expectedUserId !== actualUserId)
    throw new HttpError(409, "Your signed-in account changed. Reload to open the current workspace.", "account_changed");
}
export async function requireUser() {
  const auth = await requireIdentity();
  if (!auth.identity.emailVerified || !auth.account || auth.account.status !== "active")
    throw new HttpError(403, "Your account needs verified, active access. Verify your email or contact the administrator.", "access_denied");
  return {...auth, account: auth.account};
}
export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.account.role !== "admin") throw new HttpError(403, "Admin access is required.");
  return auth;
}
