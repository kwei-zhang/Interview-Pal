import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-forms";
import { requireIdentity } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage() {
  const auth = await requireIdentity().catch(() => null);
  if (!auth) redirect("/forgot-password");
  return <AuthForm mode="reset-password" configured userId={auth.user.id} accountEmail={auth.user.email}/>;
}
