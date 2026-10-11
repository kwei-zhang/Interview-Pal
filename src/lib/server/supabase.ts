import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { HttpError } from "./http";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export async function serverSupabase() {
  if (!supabaseConfigured()) throw new HttpError(503, "Configure Supabase to enable your private cloud workspace.");
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: values => { try { values.forEach(({name, value, options}) => cookieStore.set(name, value, options)); } catch { /* Server component: proxy refreshes cookies. */ } },
    },
  });
}
export async function requireUser() {
  const supabase = await serverSupabase();
  const {data: {user}, error} = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in to access your private workspace.");
  return {supabase, user};
}
