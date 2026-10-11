import { LoginForm } from "@/components/login-form";
import { supabaseConfigured } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function LoginPage({searchParams}: {searchParams: Promise<{notice?: string}>}) {
  const {notice} = await searchParams;
  return <LoginForm configured={supabaseConfigured()} notice={notice === "password-updated" || notice === "account-changed" ? notice : undefined}/>;
}
