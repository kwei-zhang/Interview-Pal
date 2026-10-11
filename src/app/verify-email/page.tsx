import { AuthForm } from "@/components/auth-forms";
import { supabaseConfigured } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default function VerifyEmailPage() { return <AuthForm mode="resend" configured={supabaseConfigured()}/>; }
