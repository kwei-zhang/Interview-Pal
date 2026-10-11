import { redirect } from "next/navigation";
import { AccountAccess } from "@/components/auth-forms";
import { requireIdentity } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function AccessPage() {
  const auth = await requireIdentity().catch(() => null);
  if (!auth) redirect("/login");
  return <AccountAccess userId={auth.user.id}/>;
}
