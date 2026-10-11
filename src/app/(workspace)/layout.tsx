import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { requireUser, supabaseConfigured } from "@/lib/server/supabase";
import { HttpError } from "@/lib/server/http";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({children}: {children: React.ReactNode}) {
  if (!supabaseConfigured()) {
    const hostname = (await headers()).get("host")?.split(":")[0];
    const local = hostname === "127.0.0.1" || hostname === "localhost";
    if (process.env.NODE_ENV !== "development" || !local) return <div className="setup-page"><div className="setup-card"><span className="eyebrow">INTERVIEW PAL</span><h1>Connect your private workspace.</h1><p>Configure Supabase, apply the database migrations and seed, and designate your admin account to enable this deployment.</p><p>The README contains the setup steps. Registration requires an invitation.</p><Link className="button button-secondary" href="/login">Go to sign in</Link></div></div>;
    return <WorkspaceProvider mode="demo"><AppShell>{children}</AppShell></WorkspaceProvider>;
  }
  let auth;
  try { auth = await requireUser(); }
  catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect("/login");
    if (error instanceof HttpError && error.status === 403) redirect("/account-access");
    return <div className="setup-page"><div className="setup-card"><h1>Account access unavailable</h1><p>Check the connection and apply the invite-only database migration before continuing.</p><Link className="button button-secondary" href="/login">Back to sign in</Link></div></div>;
  }
  return <WorkspaceProvider key={auth.user.id} userId={auth.user.id} mode="cloud"><AppShell email={auth.user.email} admin={auth.account.role === "admin"}>{children}</AppShell></WorkspaceProvider>;
}
