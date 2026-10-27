import { LoginForm } from "@/components/login-form";
import { neonConfigured } from "@/lib/server/accounts";
export const dynamic = "force-dynamic";
export default async function LoginPage({searchParams}: {searchParams: Promise<{notice?: string}>}) {
  const {notice} = await searchParams;
  return <LoginForm configured={neonConfigured()} notice={notice === "password-updated" || notice === "account-changed" || notice === "email-verified" ? notice : undefined}/>;
}
