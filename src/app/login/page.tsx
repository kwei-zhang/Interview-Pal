import { LoginForm } from "@/components/login-form";
import { supabaseConfigured } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default function LoginPage() {return <LoginForm configured={supabaseConfigured()}/>;}
