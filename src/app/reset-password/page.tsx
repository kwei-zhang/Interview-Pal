import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-forms";
import { neonConfigured } from "@/lib/server/accounts";
export const dynamic = "force-dynamic";
export const metadata = {referrer: "no-referrer", robots: {index: false, follow: false}};
export default async function ResetPasswordPage({searchParams}: {searchParams: Promise<{token?: string; error?: string}>}) {
  const {token, error} = await searchParams;
  if (error || typeof token !== "string" || !token || token.length > 500) redirect("/forgot-password");
  // Rendering this page never consumes a token. Only the submitted POST resets it.
  return <AuthForm mode="reset-password" configured={neonConfigured()} token={token}/>;
}
