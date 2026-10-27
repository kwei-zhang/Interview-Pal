import { AuthForm } from "@/components/auth-forms";
import { neonConfigured } from "@/lib/server/accounts";
export const dynamic = "force-dynamic";
export default function ForgotPasswordPage() { return <AuthForm mode="forgot-password" configured={neonConfigured()}/>; }
