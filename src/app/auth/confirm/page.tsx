import { ConfirmEmail } from "@/components/auth-forms";
export const dynamic = "force-dynamic";
export const metadata = {referrer: "no-referrer", robots: {index: false, follow: false}};
export default async function ConfirmPage({searchParams}: {searchParams: Promise<{token_hash?: string; type?: string}>}) {
  const params = await searchParams;
  return <ConfirmEmail tokenHash={typeof params.token_hash === "string" && params.token_hash.length <= 500 ? params.token_hash : ""}
    type={params.type === "email" || params.type === "recovery" ? params.type : null}/>;
}
