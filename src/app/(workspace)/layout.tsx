import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { serverSupabase, supabaseConfigured } from "@/lib/server/supabase";
import { AppShell } from "@/components/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({children}: {children: React.ReactNode}) {
  if (!supabaseConfigured()) {
    const hostname = (await headers()).get("host")?.split(":")[0];
    const local = hostname === "127.0.0.1" || hostname === "localhost";
    if (process.env.NODE_ENV !== "development" || !local) return <div className="setup-page"><div className="setup-card"><span className="eyebrow">INTERVIEW PAL</span><h1>Connect your private workspace.</h1><p>Configure Supabase, apply the database migration and seed, and provision your account to enable this deployment.</p><p>The README contains the setup steps. Public signup is disabled.</p><Link className="button button-secondary" href="/login">Go to sign in</Link></div></div>;
    return <WorkspaceProvider mode="demo"><AppShell>{children}</AppShell></WorkspaceProvider>;
  }
  const supabase = await serverSupabase();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <WorkspaceProvider mode="cloud"><AppShell email={user.email}>{children}</AppShell></WorkspaceProvider>;
}
