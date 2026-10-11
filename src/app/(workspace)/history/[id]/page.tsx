import { SessionReview } from "@/components/session-review";
export default async function ReviewPage({params}: {params: Promise<{id: string}>}) { return <SessionReview id={(await params).id}/>; }
