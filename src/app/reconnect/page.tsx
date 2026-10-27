import { AuthForm } from "@/components/auth-forms";
import { neonConfigured } from "@/lib/server/neon-auth";
export const dynamic = "force-dynamic";
export default function ReconnectPage() {return <AuthForm mode="reconnect" configured={neonConfigured()}/>;}
