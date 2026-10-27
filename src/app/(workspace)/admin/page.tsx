import { redirect } from "next/navigation";
import { requireAdmin, neonConfigured } from "@/lib/server/accounts";
import { HttpError } from "@/lib/server/http";
import { AdminPanel } from "@/components/admin-panel";
export const dynamic = "force-dynamic";
export default async function AdminPage() {
  if (!neonConfigured()) redirect("/login");
  try { await requireAdmin(); }
  catch (error) { if (error instanceof HttpError && [401, 403].includes(error.status)) redirect("/"); throw error; }
  return <AdminPanel/>;
}
