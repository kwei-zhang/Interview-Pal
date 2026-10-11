import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { HttpError } from "./http";
import type { Account } from "../auth";
import { basePath } from "../paths";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export async function serverSupabase() {
  if (!supabaseConfigured()) throw new HttpError(503, "Configure Supabase to enable your private cloud workspace.");
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: {path: basePath || "/"},
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: values => { try { values.forEach(({name, value, options}) => cookieStore.set(name, value, options)); } catch { /* Server component: proxy refreshes cookies. */ } },
    },
  });
}
export async function requireIdentity() {
  const supabase = await serverSupabase();
  const {data: {user}, error} = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in to access your private workspace.", "unauthenticated");
  return {supabase, user};
}
export function assertAccountBinding(expectedUserId: unknown, actualUserId: string) {
  if (typeof expectedUserId !== "string" || expectedUserId !== actualUserId) {
    throw new HttpError(409, "Your signed-in account changed. Reload to open the current workspace.", "account_changed");
  }
}
export async function requireUser() {
  const auth = await requireIdentity();
  if (!auth.user.email_confirmed_at || auth.user.is_anonymous) throw new HttpError(403, "Verify your email before opening your workspace.", "access_denied");
  const {data, error} = await auth.supabase.from("app_accounts").select("user_id,role,status,created_at").eq("user_id", auth.user.id).maybeSingle();
  if (error) throw new HttpError(503, "Account access could not be checked. Apply the invite-only database migration and retry.");
  const account = data as Account | null;
  if (!account || account.status !== "active") throw new HttpError(403, "Your account does not have active access. Contact the administrator.", "access_denied");
  return {...auth, account};
}
export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.account.role !== "admin") throw new HttpError(403, "Admin access is required.");
  return auth;
}
