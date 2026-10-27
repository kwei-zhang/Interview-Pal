import { AuthForm } from "@/components/auth-forms";
import { neonConfigured } from "@/lib/server/accounts";
export const dynamic = "force-dynamic";
export default function VerifyEmailPage() { return <AuthForm mode="resend" configured={neonConfigured()}/>; }
